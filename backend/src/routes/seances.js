import { Router } from 'express';
import { SeanceRepository } from '../repositories/SeanceRepository.js';
import { ExerciceRepository } from '../repositories/ExerciceRepository.js';
import { Seance } from '../domain/Seance.js';
import { genererSeance, calculerDureeEstimeeMinutes } from '../domain/GenerateurSeance.js';
import { requireUid } from '../middleware/requireUid.js';

export const seancesRouter = Router();

// Génère une séance à partir de critères — ne persiste rien, disponible sans
// compte (comme la génération côté client aujourd'hui) ; l'utilisateur
// valide/édite le résultat avant d'appeler POST /api/seances pour l'enregistrer.
seancesRouter.post('/generer', async (req, res, next) => {
  try {
    const exercices = await ExerciceRepository.listerTous();
    const seance = genererSeance(exercices, req.body);
    res.json(seance);
  } catch (err) { next(err); }
});

// Recalcule la durée estimée d'une liste de blocs déjà construits (après une
// édition manuelle côté front) — logique pure, pas besoin non plus d'un compte.
seancesRouter.post('/recalculer-duree', (req, res) => {
  res.json({ dureeEstimeeMinutes: calculerDureeEstimeeMinutes(req.body.blocs || []) });
});

// Séances personnelles : nécessite un utilisateur résolu (Firebase ID token ou
// bearer statique + X-Test-Uid).
seancesRouter.use(requireUid);

seancesRouter.get('/', async (req, res, next) => {
  try {
    res.json(await SeanceRepository.lister(req.uid));
  } catch (err) { next(err); }
});

// Réutilisé tel quel pour la migration localStorage → backend (le front appelle
// cette même route une fois par séance locale, en conservant sa date d'origine).
seancesRouter.post('/', async (req, res, next) => {
  try {
    const id = await SeanceRepository.ajouter(req.uid, new Seance(req.body));
    res.status(201).json({ id });
  } catch (err) { next(err); }
});

seancesRouter.put('/:id', async (req, res, next) => {
  try {
    await SeanceRepository.mettreAJour(req.uid, req.params.id, new Seance(req.body));
    res.status(204).end();
  } catch (err) { next(err); }
});

seancesRouter.delete('/:id', async (req, res, next) => {
  try {
    await SeanceRepository.supprimer(req.uid, req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});
