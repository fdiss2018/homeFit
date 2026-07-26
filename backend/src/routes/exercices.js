import { Router } from 'express';
import { ExerciceRepository } from '../repositories/ExerciceRepository.js';
import { ImageRepository } from '../repositories/ImageRepository.js';
import { Exercice } from '../domain/Exercice.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

export const exercicesRouter = Router();

// Lecture publique (tout utilisateur authentifié — front ou bearer statique),
// comme la règle Firestore actuelle (allow read: if true).
exercicesRouter.get('/', async (req, res, next) => {
  try {
    res.json(await ExerciceRepository.listerTous());
  } catch (err) { next(err); }
});

exercicesRouter.post('/', requireAdmin, async (req, res, next) => {
  try {
    const id = await ExerciceRepository.creer(new Exercice(req.body));
    res.status(201).json({ id });
  } catch (err) { next(err); }
});

exercicesRouter.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    await ExerciceRepository.mettreAJour(req.params.id, new Exercice(req.body));
    res.status(204).end();
  } catch (err) { next(err); }
});

exercicesRouter.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await ExerciceRepository.supprimer(req.params.id);
    await ImageRepository.supprimer(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

// Illustration d'exercice (upload manuel ou résultat de génération IA, voir routes/ia.js) —
// toujours sur un exercice déjà enregistré (chemin Storage dérivé de son id, voir ImageRepository).
exercicesRouter.post('/:id/image', requireAdmin, async (req, res, next) => {
  try {
    const { imageBase64, mimeType } = req.body;
    const image = await ImageRepository.televerser(req.params.id, imageBase64, mimeType);
    await ExerciceRepository.mettreAJourImage(req.params.id, image);
    res.json({ image });
  } catch (err) { next(err); }
});

exercicesRouter.delete('/:id/image', requireAdmin, async (req, res, next) => {
  try {
    await ImageRepository.supprimer(req.params.id);
    await ExerciceRepository.mettreAJourImage(req.params.id, '');
    res.status(204).end();
  } catch (err) { next(err); }
});

// Images du bucket dont le nom (dérivé d'un id d'exercice, voir ImageRepository) ne correspond à
// aucun exercice existant — peut arriver après une suppression antérieure au correctif ci-dessus,
// ou un import/suppression manuelle directement dans Storage.
exercicesRouter.get('/images-orphelines', requireAdmin, async (req, res, next) => {
  try {
    const exercices = await ExerciceRepository.listerTous();
    const idsValides = new Set(exercices.map(ex => ex.id));
    res.json(await ImageRepository.listerOrphelines(idsValides));
  } catch (err) { next(err); }
});

exercicesRouter.delete('/images-orphelines/:nom', requireAdmin, async (req, res, next) => {
  try {
    await ImageRepository.supprimerOrpheline(req.params.nom);
    res.status(204).end();
  } catch (err) { next(err); }
});
