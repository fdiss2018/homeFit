// Frontière réseau vers l'API Gemini — la construction de chaque requête et la
// validation de la réponse sont déléguées à domain/InterpreterSeanceIA.js et
// domain/InterpreterExerciceIA.js (logique pure, testable sans réseau) ; ce
// fichier ne fait que l'appel HTTP et la gestion d'erreur communs aux deux.
// La clé n'existe plus que côté serveur (process.env.GEMINI_API_KEY) — elle
// n'est jamais envoyée au navigateur, contrairement à l'ancienne implémentation
// client-side restreinte uniquement par référent HTTP.
import { construireRequeteCriteresIA, construireRequeteSeanceIA, validerSeanceIA } from '../domain/InterpreterSeanceIA.js';
import { construireRequeteExercicesIA, validerExercicesIA } from '../domain/InterpreterExerciceIA.js';
import { validerCriteresIA } from '../domain/InterpreterDemandeIA.js';
import { filtrerExercices } from '../domain/GenerateurSeance.js';

// Délai maximum avant d'abandonner UN appel Gemini — vu en pratique un modèle flash-lite qui
// "dérape" de temps en temps (génération dégénérée : boucle de répétition produisant plusieurs Ko
// de texte au lieu d'un JSON de quelques centaines d'octets) : sans cette limite, l'utilisateur
// attend potentiellement plus d'une minute avant d'obtenir une erreur.
const DELAI_MAX_MS = 30_000;

// Une génération dégénérée est probabiliste et son taux varie fortement dans le temps (mesuré
// de ~10% à plus de 70% selon les moments, avec ce même prompt inchangé — cohérent avec une
// instabilité côté serveur Gemini, pas avec un bug déterministe de notre prompt/schéma). Un
// nombre de tentatives généreux amortit les périodes où le modèle est mauvais, quitte à faire
// attendre l'utilisateur plus longtemps dans le pire cas plutôt que d'échouer trop vite.
const TENTATIVES_MAX = 5;

async function appelerGeminiUneFois(requete) {
  const modele = process.env.GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  let reponse;
  try {
    reponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requete),
      signal: AbortSignal.timeout(DELAI_MAX_MS)
    });
  } catch (err) {
    if (err.name === 'TimeoutError') throw new Error('TIMEOUT');
    throw err;
  }

  if (!reponse.ok) {
    if (reponse.status === 429) throw new Error('Quota gratuit de l\'IA atteint pour le moment, réessaie plus tard.');
    if (reponse.status === 404) {
      throw new Error(`Modèle IA "${modele}" indisponible (retiré par Google) — mets à jour GEMINI_MODEL côté backend (voir ai.google.dev/gemini-api/docs/models).`);
    }
    throw new Error(`Erreur de l'API Gemini (${reponse.status}).`);
  }

  const donnees = await reponse.json();
  const finishReason = donnees.candidates?.[0]?.finishReason;
  const texte = donnees.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texte || finishReason === 'MAX_TOKENS') throw new Error('DEGENERE');

  try {
    return JSON.parse(texte);
  } catch {
    throw new Error('DEGENERE');
  }
}

// Un 429/404/autre échec HTTP n'a aucune raison de mieux se passer immédiatement après — seules
// les erreurs ci-dessous déclenchent une nouvelle tentative, chacune avec son propre budget :
// - DEGENERE : génération dégénérée, probabiliste, se reproduit rarement plusieurs fois de suite
//   → tentatives généreuses (TENTATIVES_MAX).
// - TIMEOUT : un vrai souci réseau/disponibilité a plus de chances de persister → un seul retry,
//   pour ne pas faire attendre l'utilisateur 5 × 30s dans le pire cas.
const BUDGETS_RETRY = { DEGENERE: TENTATIVES_MAX, TIMEOUT: 2 };

async function appelerGemini(requete) {
  let derniereErreur;
  for (let tentative = 1; tentative <= TENTATIVES_MAX; tentative++) {
    try {
      return await appelerGeminiUneFois(requete);
    } catch (err) {
      const budget = BUDGETS_RETRY[err.message];
      if (!budget) throw err; // erreur non transitoire : ne jamais retenter
      derniereErreur = err;
      if (tentative >= budget) break; // budget de cette erreur épuisé
    }
  }

  throw new Error(derniereErreur.message === 'TIMEOUT'
    ? "L'IA a mis trop de temps à répondre, réessaie."
    : "Réponse de l'IA invalide, réessaie.");
}

export const GeminiClient = {
  // Deux appels Gemini plutôt qu'un : le premier (léger, sans catalogue) déduit des critères
  // provisoires, utilisés UNIQUEMENT pour présélectionner la bibliothèque (filtrerExercices) avant
  // le second appel — qui choisit alors directement les exercices dans une liste bien plus courte
  // que la bibliothèque complète, et redérive son propre résumé "criteres" final (voir la note dans
  // InterpreterSeanceIA.construireRequeteSeanceIA sur pourquoi ce second appel ne peut pas se
  // contenter de réutiliser tel quel celui du premier). Le catalogue est le principal poste de
  // tokens du prompt (répété à chaque retry), donc le réduire compense largement le coût du premier
  // appel, en plus de réduire le risque de génération dégénérée (prompt plus court).
  async genererSeanceParIA(description, exercicesDisponibles) {
    const criteresPrefiltre = validerCriteresIA(await appelerGemini(construireRequeteCriteresIA(description)));

    // Ne doit jamais faire échouer la génération si les critères extraits sont trop restrictifs ou
    // ne correspondent à rien dans la bibliothèque : on retombe alors sur le catalogue complet
    // plutôt que d'exposer une séance vide au second appel.
    const exercicesFiltres = filtrerExercices(exercicesDisponibles, criteresPrefiltre);
    const catalogue = exercicesFiltres.length > 0 ? exercicesFiltres : exercicesDisponibles;

    return validerSeanceIA(await appelerGemini(construireRequeteSeanceIA(description, catalogue)), catalogue);
  },

  async interpreterExercices(description, exercicesDisponibles) {
    const requete = construireRequeteExercicesIA(description, exercicesDisponibles);
    return validerExercicesIA(await appelerGemini(requete), exercicesDisponibles);
  }
};
