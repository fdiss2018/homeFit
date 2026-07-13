// Point d'entrée unique vers le backend : attache automatiquement le token
// Firebase ID de l'utilisateur connecté en Authorization: Bearer, sérialise le
// JSON, et remonte une erreur exploitable (message du backend si présent) en
// cas de réponse non-2xx. Les services (ExerciceService, MesSeancesService,
// SeanceService, GeminiService) passent tous par ce client plutôt que d'appeler
// fetch() directement.
import { API_BASE_URL } from '../api-config.js';
import { AuthService } from './AuthService.js';

async function requete(methode, chemin, corps) {
  const enTetes = { 'Content-Type': 'application/json' };

  const utilisateur = AuthService.utilisateurActuel();
  if (utilisateur) {
    enTetes['Authorization'] = `Bearer ${await utilisateur.getIdToken()}`;
  }

  const reponse = await fetch(`${API_BASE_URL}${chemin}`, {
    method: methode,
    headers: enTetes,
    body: corps !== undefined ? JSON.stringify(corps) : undefined
  });

  if (!reponse.ok) {
    const donnees = await reponse.json().catch(() => null);
    throw new Error(donnees?.erreur || `Erreur serveur (${reponse.status}).`);
  }

  if (reponse.status === 204) return null;
  return reponse.json();
}

export const ApiClient = {
  get:    (chemin)       => requete('GET', chemin),
  post:   (chemin, corps) => requete('POST', chemin, corps),
  put:    (chemin, corps) => requete('PUT', chemin, corps),
  delete: (chemin)       => requete('DELETE', chemin)
};
