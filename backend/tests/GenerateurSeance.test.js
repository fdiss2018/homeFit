import { describe, it, expect } from 'vitest';
import { Exercice } from '../src/domain/Exercice.js';
import { filtrerExercices, genererSeance, calculerDureeEstimeeMinutes } from '../src/domain/GenerateurSeance.js';

function creerExercice(overrides = {}) {
  return new Exercice({
    id: 'ex-1',
    nom: 'Pompes',
    groupeMusculaire: 'pectoraux',
    materiel: [],
    niveau: 'debutant',
    valeurDefautRepetitions: 10,
    valeurDefautDuree: 30,
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

  it('exclut un exercice sans illustration quand avecIllustration est demandé', () => {
    const exercices = [creerExercice({ id: 'sans-image', image: '' })];
    const resultat = filtrerExercices(exercices, { niveau: 'avance', avecIllustration: true });
    expect(resultat).toHaveLength(0);
  });

  it('inclut un exercice avec illustration quand avecIllustration est demandé', () => {
    const exercices = [creerExercice({ id: 'avec-image', image: 'https://example.com/img.jpg' })];
    const resultat = filtrerExercices(exercices, { niveau: 'avance', avecIllustration: true });
    expect(resultat).toHaveLength(1);
  });

  it("n'applique aucun filtre d'illustration quand avecIllustration est absent ou faux", () => {
    const exercices = [creerExercice({ id: 'sans-image', image: '' }), creerExercice({ id: 'avec-image', image: 'x.jpg' })];
    expect(filtrerExercices(exercices, { niveau: 'avance' })).toHaveLength(2);
    expect(filtrerExercices(exercices, { niveau: 'avance', avecIllustration: false })).toHaveLength(2);
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
    const criteres = {
      dureeMinutes: 15,
      niveau: 'debutant',
      groupesMusculaires: [],
      materielDisponible: [],
      reposEntreExercicesSecondes: 90,
      preferenceType: 'duree',
      enchainementAutomatique: false
    };
    const seance = genererSeance(exercices, criteres);
    expect(seance.criteres).toEqual(criteres);
  });

  it('retombe sur les valeurs par défaut avec un critères minimal (sans les nouveaux champs)', () => {
    const exercices = [creerExercice()];
    expect(() => genererSeance(exercices, { dureeMinutes: 15, niveau: 'debutant' })).not.toThrow();
  });

  it("l'enchaînement automatique force le type 'duree' partout, même si preferenceType demande des répétitions", () => {
    const exercices = [creerExercice({ valeurDefautRepetitions: 12, valeurDefautDuree: 40 })];
    const seance = genererSeance(exercices, {
      dureeMinutes: 10,
      niveau: 'debutant',
      preferenceType: 'repetitions',
      enchainementAutomatique: true
    });
    expect(seance.blocs.every(b => b.type === 'duree')).toBe(true);
    expect(seance.blocs.every(b => b.valeur === 40)).toBe(true);
  });

  it("preferenceType 'duree' (sans enchaînement) exprime les blocs en durée", () => {
    const exercices = [creerExercice({ valeurDefautRepetitions: 12, valeurDefautDuree: 40 })];
    const seance = genererSeance(exercices, { dureeMinutes: 10, niveau: 'debutant', preferenceType: 'duree' });
    expect(seance.blocs.every(b => b.type === 'duree' && b.valeur === 40)).toBe(true);
  });

  it("preferenceType 'repetitions' (ou absent) exprime les blocs en répétitions", () => {
    const exercices = [creerExercice({ valeurDefautRepetitions: 12, valeurDefautDuree: 40 })];
    const seance = genererSeance(exercices, { dureeMinutes: 10, niveau: 'debutant' });
    expect(seance.blocs.every(b => b.type === 'repetitions' && b.valeur === 12)).toBe(true);
  });

  it('reporte le repos entre exercices demandé sur chaque bloc', () => {
    const exercices = [creerExercice()];
    const seance = genererSeance(exercices, { dureeMinutes: 10, niveau: 'debutant', reposEntreExercicesSecondes: 90 });
    expect(seance.blocs.every(b => b.reposApresSecondes === 90)).toBe(true);
  });

  it('reporte le repos entre séries demandé sur chaque bloc', () => {
    const exercices = [creerExercice()];
    const seance = genererSeance(exercices, { dureeMinutes: 10, niveau: 'debutant', reposEntreSeriesSecondes: 15 });
    expect(seance.blocs.every(b => b.reposSecondes === 15)).toBe(true);
  });
});

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
