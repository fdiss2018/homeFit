// Frontière réseau vers l'API Gemini — la construction de chaque requête et la
// validation de la réponse sont déléguées à utils/InterpreterDemandeIA.js et
// utils/InterpreterExerciceIA.js (logique pure, testable sans réseau) ; ce
// fichier ne fait que l'appel HTTP et la gestion d'erreur communs aux deux.
import { GEMINI_API_KEY, GEMINI_MODEL } from '../gemini-config.js';
import { construireRequeteGemini, validerCriteresIA } from '../utils/InterpreterDemandeIA.js';
import { construireRequeteGeminiExercice, validerExerciceIA } from '../utils/InterpreterExerciceIA.js';

async function appelerGemini(requete) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const reponse = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requete)
  });

  if (!reponse.ok) {
    if (reponse.status === 429) throw new Error('Quota gratuit de l\'IA atteint pour le moment, réessaie plus tard.');
    if (reponse.status === 404) {
      throw new Error(`Modèle IA "${GEMINI_MODEL}" indisponible (retiré par Google) — mets à jour GEMINI_MODEL dans gemini-config.js (voir ai.google.dev/gemini-api/docs/models).`);
    }
    throw new Error(`Erreur de l'API Gemini (${reponse.status}).`);
  }

  const donnees = await reponse.json();
  const texte = donnees.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texte) throw new Error("Réponse de l'IA vide ou inattendue.");

  return JSON.parse(texte);
}

export const GeminiService = {
  async interpreterDemande(description) {
    return validerCriteresIA(await appelerGemini(construireRequeteGemini(description)));
  },

  async interpreterExercice(description) {
    return validerExerciceIA(await appelerGemini(construireRequeteGeminiExercice(description)));
  }
};
