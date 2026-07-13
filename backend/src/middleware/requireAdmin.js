export function requireAdmin(req, res, next) {
  if (!req.isAdmin) {
    return res.status(403).json({ erreur: 'Accès réservé à l\'administrateur.' });
  }
  next();
}
