import { Seance } from '../models/Seance.js';

const RANG_NIVEAU = { debutant: 1, intermediaire: 2, avance: 3 };

const SERIES_PAR_EXERCICE     = 3;
const REPOS_ENTRE_SERIES      = 30; // secondes
const REPOS_ENTRE_EXERCICES   = 60; // secondes
const SECONDES_PAR_REPETITION = 3;  // estimation du temps d'effort pour un exercice en répétitions
const MAX_BLOCS               = 30; // garde-fou anti-boucle infinie

function dureeEffortSecondes(exercice) {
  return exercice.type === 'duree'
    ? exercice.valeurDefaut
    : exercice.valeurDefaut * SECONDES_PAR_REPETITION;
}

function dureeBlocSecondes(exercice) {
  return SERIES_PAR_EXERCICE * dureeEffortSecondes(exercice)
    + (SERIES_PAR_EXERCICE - 1) * REPOS_ENTRE_SERIES;
}

function melanger(tableau) {
  const copie = [...tableau];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

// Filtre la bibliothèque selon le niveau (un niveau donné inclut les niveaux
// plus faciles), les groupes musculaires ciblés (vide = tous) et le matériel
// disponible (un exercice ne nécessitant aucun matériel passe toujours).
export function filtrerExercices(exercices, criteres) {
  const niveauMax = RANG_NIVEAU[criteres.niveau] || RANG_NIVEAU.avance;
  const materielDispo = new Set(criteres.materielDisponible || []);

  return exercices.filter(ex => {
    if (RANG_NIVEAU[ex.niveau] > niveauMax) return false;
    if (criteres.groupesMusculaires?.length && !criteres.groupesMusculaires.includes(ex.groupeMusculaire)) return false;
    if (ex.materiel?.length && !ex.materiel.every(m => materielDispo.has(m))) return false;
    return true;
  });
}

// Génère une séance en piochant (sans répétition tant que possible) dans la
// bibliothèque filtrée, jusqu'à atteindre la durée cible demandée.
// criteres : { dureeMinutes, groupesMusculaires: [], materielDisponible: [], niveau }
export function genererSeance(exercicesDisponibles, criteres) {
  const exercicesEligibles = filtrerExercices(exercicesDisponibles, criteres);
  if (exercicesEligibles.length === 0) {
    throw new Error('Aucun exercice ne correspond aux critères sélectionnés.');
  }

  const pool = melanger(exercicesEligibles);
  const dureeCibleSecondes = criteres.dureeMinutes * 60;

  const blocs = [];
  let dureeTotale = 0;
  let index = 0;

  while (dureeTotale < dureeCibleSecondes && blocs.length < MAX_BLOCS) {
    const exercice = pool[index % pool.length];
    index++;

    blocs.push({
      exercice,
      series: SERIES_PAR_EXERCICE,
      valeur: exercice.valeurDefaut,
      type: exercice.type,
      reposSecondes: REPOS_ENTRE_SERIES
    });
    dureeTotale += dureeBlocSecondes(exercice) + REPOS_ENTRE_EXERCICES;
  }
  dureeTotale -= REPOS_ENTRE_EXERCICES; // pas de repos après le dernier exercice

  return new Seance({
    criteres,
    blocs,
    dureeEstimeeMinutes: Math.round(dureeTotale / 60)
  });
}
