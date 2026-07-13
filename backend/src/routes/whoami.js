import { Router } from 'express';

// Route de diagnostic : confirme comment le middleware d'authentification a
// résolu la requête (utile pour valider un token depuis Postman avant de
// toucher aux routes métier).
export const whoamiRouter = Router();

whoamiRouter.get('/whoami', (req, res) => {
  res.json({ uid: req.uid, isAdmin: req.isAdmin });
});
