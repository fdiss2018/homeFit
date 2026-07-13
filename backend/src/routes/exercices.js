import { Router } from 'express';
import { ExerciceRepository } from '../repositories/ExerciceRepository.js';
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
    res.status(204).end();
  } catch (err) { next(err); }
});
