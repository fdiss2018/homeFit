import { GROUPES_MUSCULAIRES, NIVEAUX } from './Exercice.js';
import { MATERIEL_DISPONIBLE } from './constantes.js';

export const DUREES_DISPONIBLES = [10, 20, 30, 45, 60];
export const REPOS_DISPONIBLES = [15, 30, 60, 90, 120];

// Repli sur l'option disponible la plus proche — utile car Gemini renvoie parfois une valeur hors
// liste, ou une chaîne là où un nombre est attendu (voir REPOS_DISPONIBLES plus bas).
export function plusProche(valeur, options, defaut) {
  const nombre = Number(valeur);
  if (!Number.isFinite(nombre)) return defaut;
  return options.reduce((a, b) => (Math.abs(b - nombre) < Math.abs(a - nombre) ? b : a));
}

// Ne fait jamais confiance aveuglément à la sortie du modèle : chaque champ est
// validé/ramené à une valeur sûre et cohérente avec le domaine de l'app. Réutilisée par
// InterpreterSeanceIA.js (génération directe par IA), qui construit sa propre requête Gemini
// combinant ces critères avec la sélection des exercices.
export function validerCriteresIA(brut) {
  const groupesMusculaires = Array.isArray(brut?.groupesMusculaires)
    ? brut.groupesMusculaires.filter(g => GROUPES_MUSCULAIRES.includes(g))
    : [];

  const materielDisponible = Array.isArray(brut?.materielDisponible)
    ? brut.materielDisponible.filter(m => MATERIEL_DISPONIBLE.includes(m))
    : [];

  return {
    dureeMinutes: plusProche(brut?.dureeMinutes, DUREES_DISPONIBLES, 20),
    groupesMusculaires,
    materielDisponible,
    avecIllustration: brut?.avecIllustration === true,
    niveau: NIVEAUX.includes(brut?.niveau) ? brut.niveau : 'intermediaire',
    preferenceType: brut?.preferenceType === 'duree' ? 'duree' : 'repetitions',
    enchainementAutomatique: brut?.enchainementAutomatique === true,
    reposEntreSeriesSecondes: plusProche(brut?.reposEntreSeriesSecondes, REPOS_DISPONIBLES, 30),
    reposEntreExercicesSecondes: plusProche(brut?.reposEntreExercicesSecondes, REPOS_DISPONIBLES, 60)
  };
}
