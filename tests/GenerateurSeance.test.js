import { describe, it, expect } from 'vitest';
import { calculerDureeEstimeeMinutes } from '../public/utils/GenerateurSeance.js';

// filtrerExercices/genererSeance ont été déplacées côté backend (décision
// métier de sélection des exercices, voir backend/src/domain/GenerateurSeance.js
// et backend/tests/GenerateurSeance.test.js) — le front ne garde que le calcul
// de durée, recalculé localement pendant l'édition manuelle d'un bloc.
describe('calculerDureeEstimeeMinutes', () => {
  it('calcule la durée totale (effort + repos entre séries + repos entre exercices) en minutes', () => {
    const blocs = [
      { series: 3, valeur: 10, type: 'repetitions', reposSecondes: 30, reposApresSecondes: 60 },
      { series: 3, valeur: 30, type: 'duree', reposSecondes: 30, reposApresSecondes: 60 }
    ];
    // Bloc 1 (répétitions, 3s/rep) : 3*(10*3) + 2*30 = 90 + 60 = 150s, + 60s de repos vers le bloc suivant = 210s
    // Bloc 2 (durée) : 3*30 + 2*30 = 90 + 60 = 150s, pas de repos après (dernier bloc)
    // Total = 210 + 150 = 360s = 6 min
    expect(calculerDureeEstimeeMinutes(blocs)).toBe(6);
  });
});
