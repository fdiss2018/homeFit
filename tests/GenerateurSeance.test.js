import { describe, it, expect } from 'vitest';
import { Exercice } from '../public/models/Exercice.js';
import { filtrerExercices, genererSeance } from '../public/utils/GenerateurSeance.js';

function creerExercice(overrides = {}) {
  return new Exercice({
    id: 'ex-1',
    nom: 'Pompes',
    groupeMusculaire: 'pectoraux',
    materiel: [],
    niveau: 'debutant',
    type: 'repetitions',
    valeurDefaut: 10,
    ...overrides
  });
}

describe('filtrerExercices', () => {
  it("exclut les exercices d'un niveau supérieur au niveau demandé", () => {
    const exercices = [
      creerExercice({ id: 'facile', niveau: 'debutant' }),
      creerExercice({ id: 'dur', niveau: 'avance' })
    ];
    const resultat = filtrerExercices(exercices, { niveau: 'debutant' });
    expect(resultat.map(e => e.id)).toEqual(['facile']);
  });

  it('inclut les niveaux plus faciles que le niveau demandé', () => {
    const exercices = [
      creerExercice({ id: 'facile', niveau: 'debutant' }),
      creerExercice({ id: 'moyen', niveau: 'intermediaire' })
    ];
    const resultat = filtrerExercices(exercices, { niveau: 'intermediaire' });
    expect(resultat.map(e => e.id).sort()).toEqual(['facile', 'moyen']);
  });

  it('filtre par groupe musculaire quand la liste est non vide', () => {
    const exercices = [
      creerExercice({ id: 'pecs', groupeMusculaire: 'pectoraux' }),
      creerExercice({ id: 'jambes', groupeMusculaire: 'jambes' })
    ];
    const resultat = filtrerExercices(exercices, { niveau: 'avance', groupesMusculaires: ['jambes'] });
    expect(resultat.map(e => e.id)).toEqual(['jambes']);
  });

  it("n'applique aucun filtre de groupe musculaire quand la liste est vide", () => {
    const exercices = [creerExercice({ id: 'pecs' }), creerExercice({ id: 'jambes', groupeMusculaire: 'jambes' })];
    const resultat = filtrerExercices(exercices, { niveau: 'avance', groupesMusculaires: [] });
    expect(resultat).toHaveLength(2);
  });

  it('exclut un exercice si le matériel requis n\'est pas disponible', () => {
    const exercices = [creerExercice({ id: 'halteres', materiel: ['halteres'] })];
    const resultat = filtrerExercices(exercices, { niveau: 'avance', materielDisponible: [] });
    expect(resultat).toHaveLength(0);
  });

  it('inclut un exercice sans matériel même si aucun matériel n\'est disponible', () => {
    const exercices = [creerExercice({ id: 'poids-du-corps', materiel: [] })];
    const resultat = filtrerExercices(exercices, { niveau: 'avance', materielDisponible: [] });
    expect(resultat).toHaveLength(1);
  });

  it('inclut un exercice dont tout le matériel requis est disponible', () => {
    const exercices = [creerExercice({ id: 'halteres', materiel: ['halteres'] })];
    const resultat = filtrerExercices(exercices, { niveau: 'avance', materielDisponible: ['halteres', 'tapis'] });
    expect(resultat).toHaveLength(1);
  });
});

describe('genererSeance', () => {
  it('lève une erreur si aucun exercice ne correspond aux critères', () => {
    const exercices = [creerExercice({ materiel: ['kettlebell'] })];
    expect(() => genererSeance(exercices, { dureeMinutes: 20, materielDisponible: [] })).toThrow();
  });

  it('génère une séance dont la durée estimée approche la durée demandée', () => {
    const exercices = Array.from({ length: 6 }, (_, i) =>
      creerExercice({ id: `ex-${i}`, nom: `Exercice ${i}`, niveau: 'avance' })
    );
    const seance = genererSeance(exercices, { dureeMinutes: 20, niveau: 'avance' });

    expect(seance.blocs.length).toBeGreaterThan(0);
    expect(seance.dureeEstimeeMinutes).toBeGreaterThan(0);
    // Approximation : on tolère un écart raisonnable autour de la cible.
    expect(Math.abs(seance.dureeEstimeeMinutes - 20)).toBeLessThanOrEqual(10);
  });

  it('ne dépasse pas la limite de sécurité de blocs même avec un pool réduit et une longue durée', () => {
    const exercices = [creerExercice()];
    const seance = genererSeance(exercices, { dureeMinutes: 500, niveau: 'debutant' });
    expect(seance.blocs.length).toBeLessThanOrEqual(30);
  });

  it('conserve les critères fournis sur la séance générée', () => {
    const exercices = [creerExercice()];
    const criteres = { dureeMinutes: 15, niveau: 'debutant', groupesMusculaires: [], materielDisponible: [] };
    const seance = genererSeance(exercices, criteres);
    expect(seance.criteres).toEqual(criteres);
  });
});
