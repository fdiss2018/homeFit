import { Seance } from '../models/Seance.js';
import { SECONDES_PAR_REPETITION } from './constantes.js';

const RANG_NIVEAU = { debutant: 1, intermediaire: 2, avance: 3 };

export const SERIES_PAR_EXERCICE     = 3;
export const REPOS_ENTRE_SERIES      = 30; // secondes
const REPOS_ENTRE_EXERCICES_DEFAUT   = 60; // secondes, si non fourni dans criteres
const MAX_BLOCS                      = 30; // garde-fou anti-boucle infinie

function dureeEffortSecondes(bloc) {
  return bloc.type === 'duree'
    ? bloc.valeur
    : bloc.valeur * SECONDES_PAR_REPETITION;
}

function dureeBlocSecondes(bloc) {
  return bloc.series * dureeEffortSecondes(bloc)
    + (bloc.series - 1) * bloc.reposSecondes;
}

// Durée totale d'une liste de blocs déjà construits — pure, sans random, donc
// réutilisable après une édition manuelle d'un bloc (séries/valeur) pour
// rafraîchir l'estimation affichée sans regénérer la séance.
export function calculerDureeTotaleSecondes(blocs) {
  return blocs.reduce((total, bloc, i) => {
    const reposApres = i < blocs.length - 1 ? (bloc.reposApresSecondes || 0) : 0;
    return total + dureeBlocSecondes(bloc) + reposApres;
  }, 0);
}

export function calculerDureeEstimeeMinutes(blocs) {
  return Math.round(calculerDureeTotaleSecondes(blocs) / 60);
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
// criteres : { dureeMinutes, groupesMusculaires: [], materielDisponible: [], niveau,
//              reposEntreExercicesSecondes?, preferenceType?, enchainementAutomatique? }
export function genererSeance(exercicesDisponibles, criteres) {
  const exercicesEligibles = filtrerExercices(exercicesDisponibles, criteres);
  if (exercicesEligibles.length === 0) {
    throw new Error('Aucun exercice ne correspond aux critères sélectionnés.');
  }

  const type = criteres.enchainementAutomatique ? 'duree' : (criteres.preferenceType || 'repetitions');
  const reposApresSecondes = criteres.reposEntreExercicesSecondes ?? REPOS_ENTRE_EXERCICES_DEFAUT;

  const pool = melanger(exercicesEligibles);
  const dureeCibleSecondes = criteres.dureeMinutes * 60;

  const blocs = [];
  let index = 0;

  while (calculerDureeTotaleSecondes(blocs) < dureeCibleSecondes && blocs.length < MAX_BLOCS) {
    const exercice = pool[index % pool.length];
    index++;

    blocs.push({
      exercice,
      series: SERIES_PAR_EXERCICE,
      valeur: type === 'duree' ? exercice.valeurDefautDuree : exercice.valeurDefautRepetitions,
      type,
      reposSecondes: REPOS_ENTRE_SERIES,
      reposApresSecondes
    });
  }

  return new Seance({
    criteres,
    blocs,
    dureeEstimeeMinutes: calculerDureeEstimeeMinutes(blocs)
  });
}
