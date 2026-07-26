import { Router } from 'express';
import { GeminiClient } from '../services/GeminiClient.js';
import { ExerciceRepository } from '../repositories/ExerciceRepository.js';
import { ImageRepository } from '../repositories/ImageRepository.js';
import { Seance } from '../domain/Seance.js';
import { calculerDureeEstimeeMinutes } from '../domain/GenerateurSeance.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

export const iaRouter = Router();

// Public, comme la génération de séance manuelle qu'elle remplace pour ce cas d'usage (pas de
// compte requis aujourd'hui pour "Décris ta séance" côté front). L'IA choisit directement les
// exercices dans la bibliothèque (voir domain/InterpreterSeanceIA.js) plutôt que de se contenter de
// déduire des critères ensuite piochés au hasard par GenerateurSeance.genererSeance().
iaRouter.post('/generer-seance', async (req, res, next) => {
  try {
    const exercices = await ExerciceRepository.listerTous();
    if (exercices.length === 0) {
      throw new Error("Aucun exercice n'est encore disponible dans la bibliothèque.");
    }

    const { criteres, blocs } = await GeminiClient.genererSeanceParIA(req.body.description || '', exercices);
    res.json(new Seance({ criteres, blocs, dureeEstimeeMinutes: calculerDureeEstimeeMinutes(blocs) }));
  } catch (err) { next(err); }
});

// Réservée à l'admin (écrit potentiellement dans la bibliothèque partagée). Contrairement à
// /generer-seance, une bibliothèque vide n'est pas une erreur ici : tout revient simplement en
// "nouveaux" (voir domain/InterpreterExerciceIA.js).
iaRouter.post('/interpreter-exercices', requireAdmin, async (req, res, next) => {
  try {
    const exercices = await ExerciceRepository.listerTous();
    res.json(await GeminiClient.interpreterExercices(req.body.description || '', exercices));
  } catch (err) { next(err); }
});

// Réservée à l'admin, toujours sur un exercice déjà enregistré (voir CLAUDE.md — chemin Storage
// dérivé de l'id). Écrit directement en base plutôt qu'un flux "aperçu puis confirmation" : ne
// touche qu'un champ optionnel d'un exercice déjà identifié, l'admin voit le résultat immédiatement
// et peut regénérer/supprimer s'il n'est pas satisfait.
iaRouter.post('/generer-image-exercice', requireAdmin, async (req, res, next) => {
  try {
    const { id, nom, description } = req.body;
    if (!id) throw new Error("Enregistre d'abord l'exercice avant de générer son image.");
    const { base64, mimeType } = await GeminiClient.genererImageExercice(nom || '', description || '');
    const image = await ImageRepository.televerser(id, base64, mimeType);
    await ExerciceRepository.mettreAJourImage(id, image);
    res.json({ image });
  } catch (err) { next(err); }
});
