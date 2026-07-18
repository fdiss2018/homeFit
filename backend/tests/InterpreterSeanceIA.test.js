import { describe, it, expect } from 'vitest';
import { Exercice } from '../src/domain/Exercice.js';
import { construireRequeteCriteresIA, construireRequeteSeanceIA, validerSeanceIA } from '../src/domain/InterpreterSeanceIA.js';

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

describe('construireRequeteCriteresIA', () => {
  it("inclut la description de l'utilisateur dans le prompt, sans catalogue", () => {
    const requete = construireRequeteCriteresIA('20 minutes, jambes, débutant');
    expect(requete.contents[0].parts[0].text).toContain('20 minutes, jambes, débutant');
  });

  it('désactive le thinking et force une sortie JSON conforme au schéma des critères', () => {
    const requete = construireRequeteCriteresIA('peu importe');
    expect(requete.generationConfig.responseMimeType).toBe('application/json');
    expect(requete.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(requete.generationConfig.responseSchema.required).toEqual(['dureeMinutes', 'niveau']);
  });
});

describe('construireRequeteSeanceIA', () => {
  it("inclut la description de l'utilisateur dans le prompt", () => {
    const requete = construireRequeteSeanceIA('20 minutes, jambes, débutant', [creerExercice()]);
    expect(requete.contents[0].parts[0].text).toContain('20 minutes, jambes, débutant');
  });

  it('liste le catalogue fourni avec un index court plutôt que l\'id (nom, groupe, niveau, matériel)', () => {
    const exercices = [creerExercice({ id: 'abc123', nom: 'Squats sautés', materiel: ['tapis'] })];
    const requete = construireRequeteSeanceIA('peu importe', exercices);
    expect(requete.contents[0].parts[0].text).toContain('0 | Squats sautés | pectoraux | debutant | matériel: tapis');
    expect(requete.contents[0].parts[0].text).not.toContain('abc123');
  });

  // Schéma volontairement proche de l'ancien format à un seul appel (voir le commentaire détaillé
  // dans InterpreterSeanceIA.js) : mesuré empiriquement (essais répétés contre l'API réelle, pas un
  // aléa) que retirer "criteres" du schéma OU typer "exerciceId" en INTEGER fait déraper ce modèle
  // vers une génération dégénérée de façon quasi systématique. Ces deux tests figent ce choix pour
  // qu'une régression future soit détectée immédiatement.
  it('conserve "criteres" dans le schéma de réponse (nécessaire à la stabilité du modèle)', () => {
    const requete = construireRequeteSeanceIA('peu importe', [creerExercice()]);
    expect(requete.generationConfig.responseSchema.properties.criteres).toBeDefined();
    expect(requete.generationConfig.responseSchema.properties.criteres.required).toEqual(['dureeMinutes', 'niveau']);
  });

  it('force "exerciceId" en STRING (jamais INTEGER, jamais enum) et désactive le thinking', () => {
    const exercices = [creerExercice({ id: 'ex-1' }), creerExercice({ id: 'ex-2' })];
    const requete = construireRequeteSeanceIA('peu importe', exercices);
    expect(requete.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(requete.generationConfig.responseSchema.properties.blocs.items.properties.exerciceId)
      .toEqual({ type: 'STRING' });
  });
});

describe('validerSeanceIA', () => {
  it('résout chaque bloc valide (exerciceId = index sous forme de chaîne) en y embarquant l\'exercice complet', () => {
    const exercices = [creerExercice({ id: 'ex-1', nom: 'Pompes' })];
    const { blocs } = validerSeanceIA({
      blocs: [{ exerciceId: '0', series: 4, valeur: 15, type: 'repetitions', reposSecondes: 20, reposApresSecondes: 45 }]
    }, exercices);

    expect(blocs).toEqual([{
      exercice: exercices[0],
      series: 4,
      valeur: 15,
      type: 'repetitions',
      reposSecondes: 20,
      reposApresSecondes: 45
    }]);
  });

  it('ignore un bloc référençant un exerciceId hors bornes ou non numérique (hallucination)', () => {
    const exercices = [creerExercice({ id: 'ex-1' })];
    const { blocs } = validerSeanceIA({
      blocs: [
        { exerciceId: '0', series: 3, valeur: 10, type: 'repetitions', reposSecondes: 30, reposApresSecondes: 60 },
        { exerciceId: '5', series: 3, valeur: 10, type: 'repetitions', reposSecondes: 30, reposApresSecondes: 60 },
        { exerciceId: '-1', series: 3, valeur: 10, type: 'repetitions', reposSecondes: 30, reposApresSecondes: 60 },
        { exerciceId: 'invente-par-ia', series: 3, valeur: 10, type: 'repetitions', reposSecondes: 30, reposApresSecondes: 60 }
      ]
    }, exercices);
    expect(blocs).toHaveLength(1);
    expect(blocs[0].exercice.id).toBe('ex-1');
  });

  it('lève une erreur explicite si aucun bloc ne référence un index valide', () => {
    const exercices = [creerExercice({ id: 'ex-1' })];
    expect(() => validerSeanceIA({ blocs: [{ exerciceId: '3' }] }, exercices)).toThrow();
    expect(() => validerSeanceIA({ blocs: [] }, exercices)).toThrow();
    expect(() => validerSeanceIA({}, exercices)).toThrow();
  });

  it('retombe sur des valeurs par défaut sûres pour série/valeur/type/repos manquants ou invalides', () => {
    const exercices = [creerExercice({ id: 'ex-1', valeurDefautRepetitions: 12, valeurDefautDuree: 40 })];
    const { blocs } = validerSeanceIA({ blocs: [{ exerciceId: '0' }] }, exercices);

    expect(blocs[0]).toEqual({
      exercice: exercices[0],
      series: 3,
      valeur: 12,
      type: 'repetitions',
      reposSecondes: 30,
      reposApresSecondes: 60
    });
  });

  it("utilise la valeur par défaut en durée quand type vaut 'duree'", () => {
    const exercices = [creerExercice({ id: 'ex-1', valeurDefautRepetitions: 12, valeurDefautDuree: 40 })];
    const { blocs } = validerSeanceIA({ blocs: [{ exerciceId: '0', type: 'duree' }] }, exercices);
    expect(blocs[0].type).toBe('duree');
    expect(blocs[0].valeur).toBe(40);
  });

  it('valide les critères comme validerCriteresIA (retombe sur les défauts si absents/invalides)', () => {
    const exercices = [creerExercice({ id: 'ex-1' })];
    const { criteres } = validerSeanceIA({ blocs: [{ exerciceId: '0' }], criteres: { niveau: 'expert' } }, exercices);
    expect(criteres.niveau).toBe('intermediaire');
    expect(criteres.dureeMinutes).toBe(20);
  });
});
