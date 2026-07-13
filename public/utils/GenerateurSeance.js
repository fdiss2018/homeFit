import { SECONDES_PAR_REPETITION } from './constantes.js';

export const SERIES_PAR_EXERCICE = 3;
export const REPOS_ENTRE_SERIES  = 30; // secondes, repli si criteres.reposEntreSeriesSecondes absent

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
// rafraîchir l'estimation affichée sans regénérer la séance. Reste en local
// (recalculée à chaque frappe pendant l'édition) : la sélection des exercices
// elle-même est une décision métier déléguée au backend, voir
// services/SeanceService.js et backend/src/domain/GenerateurSeance.js.
export function calculerDureeTotaleSecondes(blocs) {
  return blocs.reduce((total, bloc, i) => {
    const reposApres = i < blocs.length - 1 ? (bloc.reposApresSecondes || 0) : 0;
    return total + dureeBlocSecondes(bloc) + reposApres;
  }, 0);
}

export function calculerDureeEstimeeMinutes(blocs) {
  return Math.round(calculerDureeTotaleSecondes(blocs) / 60);
}
