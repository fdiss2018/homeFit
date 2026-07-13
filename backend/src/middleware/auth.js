import { auth } from '../firebaseAdmin.js';

// Identifie l'appelant sans jamais bloquer à ce stade — comme côté Firestore
// aujourd'hui, plusieurs routes (bibliothèque d'exercices en lecture, génération
// de séance, IA "Décris ta séance") restent utilisables sans compte. Ce sont les
// middlewares requireAdmin/requireUid, posés route par route, qui imposent une
// exigence précise là où c'est nécessaire.
// Deux formes de token acceptées quand un en-tête Authorization est présent :
// - le token statique STATIC_API_TOKEN (secret serveur) : accès admin complet,
//   pensé pour les tests Postman sans navigateur. Dans ce cas uniquement, l'en-tête
//   X-Test-Uid permet de se placer dans le contexte d'un utilisateur donné pour
//   exercer les routes /api/seances (qui ont besoin d'un uid) — cet en-tête est
//   ignoré sur toute autre forme d'authentification.
// - un vrai ID token Firebase (émis par Firebase Auth côté front) : vérifié via
//   le SDK Admin, req.isAdmin dérivé de l'email (comparé à ADMIN_EMAIL serveur,
//   jamais au client).
export async function authentifier(req, res, next) {
  req.uid = null;
  req.isAdmin = false;

  const enTete = req.get('Authorization') || '';
  const token = enTete.startsWith('Bearer ') ? enTete.slice('Bearer '.length) : null;
  if (!token) return next();

  if (token === process.env.STATIC_API_TOKEN) {
    req.isAdmin = true;
    req.uid = req.get('X-Test-Uid') || null;
    return next();
  }

  try {
    const decode = await auth.verifyIdToken(token);
    req.uid = decode.uid;
    req.isAdmin = decode.email === process.env.ADMIN_EMAIL;
    next();
  } catch {
    res.status(401).json({ erreur: 'Token invalide ou expiré.' });
  }
}
