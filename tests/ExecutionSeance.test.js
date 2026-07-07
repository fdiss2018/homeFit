import { describe, it, expect } from 'vitest';
import { construireEtapes } from '../public/utils/ExecutionSeance.js';

function creerSeance(overrides = {}) {
  return {
    criteres: {},
    blocs: [],
    ...overrides
  };
}

function creerBloc(overrides = {}) {
  return {
    exercice: { id: 'ex-1', nom: 'Pompes' },
    series: 3,
    valeur: 10,
    type: 'repetitions',
    reposSecondes: 30,
    reposApresSecondes: 60,
    ...overrides
  };
}

describe('construireEtapes', () => {
  it('crée une étape par série de chaque bloc', () => {
    const seance = creerSeance({ blocs: [creerBloc({ series: 3 }), creerBloc({ series: 2 })] });
    const etapes = construireEtapes(seance);
    expect(etapes).toHaveLength(5);
    expect(etapes.filter(e => e.blocIndex === 0)).toHaveLength(3);
    expect(etapes.filter(e => e.blocIndex === 1)).toHaveLength(2);
  });

  it("porte l'id de l'exercice pour permettre de retrouver sa description complète", () => {
    const seance = creerSeance({ blocs: [creerBloc({ exercice: { id: 'ex-42', nom: 'Pompes' } })] });
    const etapes = construireEtapes(seance);
    expect(etapes[0].exerciceId).toBe('ex-42');
  });

  it('marque un bloc de type durée comme automatique même sans enchaînement global', () => {
    const seance = creerSeance({ blocs: [creerBloc({ type: 'duree', valeur: 30 })] });
    const etapes = construireEtapes(seance);
    expect(etapes.every(e => e.estAuto)).toBe(true);
    expect(etapes.every(e => e.dureeEffortSecondes === 30)).toBe(true);
  });

  it("marque un bloc de type répétitions comme manuel si l'enchaînement automatique est désactivé", () => {
    const seance = creerSeance({ blocs: [creerBloc({ type: 'repetitions' })] });
    const etapes = construireEtapes(seance);
    expect(etapes.every(e => !e.estAuto)).toBe(true);
  });

  it("l'enchaînement automatique force estAuto=true même pour un bloc en répétitions, avec une durée d'effort estimée", () => {
    const seance = creerSeance({
      criteres: { enchainementAutomatique: true },
      blocs: [creerBloc({ type: 'repetitions', valeur: 10 })]
    });
    const etapes = construireEtapes(seance);
    expect(etapes.every(e => e.estAuto)).toBe(true);
    expect(etapes[0].dureeEffortSecondes).toBe(30); // 10 reps * 3s
  });

  it('applique le repos entre séries sauf sur la dernière série du bloc', () => {
    const seance = creerSeance({ blocs: [creerBloc({ series: 3, reposSecondes: 15 }), creerBloc({ series: 1 })] });
    const etapes = construireEtapes(seance);
    expect(etapes[0].reposApresSecondes).toBe(15);
    expect(etapes[1].reposApresSecondes).toBe(15);
    // Dernière série du 1er bloc → repos entre exercices, pas repos entre séries
    expect(etapes[2].reposApresSecondes).toBe(60);
  });

  it("n'ajoute aucun repos après la toute dernière série de la séance", () => {
    const seance = creerSeance({ blocs: [creerBloc({ series: 1 })] });
    const etapes = construireEtapes(seance);
    expect(etapes.at(-1).reposApresSecondes).toBe(0);
  });

  it('utilise reposApresSecondes = 0 par défaut si absent (rétrocompatibilité anciennes séances)', () => {
    const seance = creerSeance({
      blocs: [creerBloc({ series: 1, reposApresSecondes: undefined }), creerBloc({ series: 1 })]
    });
    const etapes = construireEtapes(seance);
    expect(etapes[0].reposApresSecondes).toBe(0);
  });
});
