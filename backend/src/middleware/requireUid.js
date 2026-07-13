export function requireUid(req, res, next) {
  if (!req.uid) {
    return res.status(400).json({ erreur: 'Utilisateur non résolu (uid manquant — X-Test-Uid requis avec le bearer statique).' });
  }
  next();
}
