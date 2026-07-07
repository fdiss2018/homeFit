import { SECONDES_PAR_REPETITION } from './constantes.js';

// Transforme une Seance en une liste plate d'étapes (une par série), pour
// piloter l'écran d'exécution. Logique pure, testable sans Firebase ni DOM.
export function construireEtapes(seance) {
  const enchainementAuto = !!(seance.criteres && seance.criteres.enchainementAutomatique);
  const etapes = [];

  seance.blocs.forEach((bloc, blocIndex) => {
    const dernierBloc = blocIndex === seance.blocs.length - 1;
    const estAuto = enchainementAuto || bloc.type === 'duree';

    for (let serie = 1; serie <= bloc.series; serie++) {
      const derniereSerieDuBloc = serie === bloc.series;
      const dureeEffortSecondes = bloc.type === 'duree'
        ? bloc.valeur
        : bloc.valeur * SECONDES_PAR_REPETITION;

      let reposApresSecondes = 0;
      if (!derniereSerieDuBloc) {
        reposApresSecondes = bloc.reposSecondes || 0;
      } else if (!dernierBloc) {
        reposApresSecondes = bloc.reposApresSecondes || 0;
      }

      etapes.push({
        blocIndex,
        exerciceId: bloc.exercice.id,
        exerciceNom: bloc.exercice.nom,
        serie,
        totalSeries: bloc.series,
        type: bloc.type,
        valeur: bloc.valeur,
        estAuto,
        dureeEffortSecondes,
        reposApresSecondes
      });
    }
  });

  return etapes;
}
