import { describe, it, expect } from 'vitest';
import { Exercice } from '../src/domain/Exercice.js';
import { construireRequeteSeanceIA, validerSeanceIA } from '../src/domain/InterpreterSeanceIA.js';

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

describe('construireRequeteSeanceIA', () => {
  it("inclut la description de l'utilisateur dans le prompt", () => {
    const requete = construireRequeteSeanceIA('20 minutes, jambes, débutant', [creerExercice()]);
    expect(requete.contents[0].parts[0].text).toContain('20 minutes, jambes, débutant');
  });

  it('liste le catalogue fourni dans le prompt (id, nom, groupe, niveau, matériel)', () => {
    const exercices = [creerExercice({ id: 'abc123', nom: 'Squats sautés', materiel: ['tapis'] })];
    const requete = construireRequeteSeanceIA('peu importe', exercices);
    expect(requete.contents[0].parts[0].text).toContain('abc123 | Squats sautés | pectoraux | debutant | matériel: tapis');
  });

  it('force une sortie JSON conforme au schéma (exerciceId en STRING libre)', () => {
    const exercices = [creerExercice({ id: 'ex-1' }), creerExercice({ id: 'ex-2' })];
    const requete = construireRequeteSeanceIA('peu importe', exercices);
    expect(requete.generationConfig.responseMimeType).toBe('application/json');
    // Volontairement pas d'enum sur exerciceId malgré les ~150+ ids possibles : mesuré
    // empiriquement qu'un enum de cette taille fait dériver ce modèle vers une génération
    // dégénérée bien plus souvent — validerSeanceIA() est la seule ligne de défense contre un
    // id halluciné (voir le commentaire dans InterpreterSeanceIA.js).
    expect(requete.generationConfig.responseSchema.properties.blocs.items.properties.exerciceId)
      .toEqual({ type: 'STRING' });
  });
});

describe('validerSeanceIA', () => {
  it('résout chaque bloc valide en y embarquant l\'exercice complet correspondant', () => {
    const exercices = [creerExercice({ id: 'ex-1', nom: 'Pompes' })];
    const { blocs } = validerSeanceIA({
      blocs: [{ exerciceId: 'ex-1', series: 4, valeur: 15, type: 'repetitions', reposSecondes: 20, reposApresSecondes: 45 }]
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

  it('ignore un bloc référençant un exerciceId hors bibliothèque (hallucination)', () => {
    const exercices = [creerExercice({ id: 'ex-1' })];
    const { blocs } = validerSeanceIA({
      blocs: [
        { exerciceId: 'ex-1', series: 3, valeur: 10, type: 'repetitions', reposSecondes: 30, reposApresSecondes: 60 },
        { exerciceId: 'invente-par-ia', series: 3, valeur: 10, type: 'repetitions', reposSecondes: 30, reposApresSecondes: 60 }
      ]
    }, exercices);
    expect(blocs).toHaveLength(1);
    expect(blocs[0].exercice.id).toBe('ex-1');
  });

  it('lève une erreur explicite si aucun bloc ne référence un exercice valide', () => {
    const exercices = [creerExercice({ id: 'ex-1' })];
    expect(() => validerSeanceIA({ blocs: [{ exerciceId: 'invente' }] }, exercices)).toThrow();
    expect(() => validerSeanceIA({ blocs: [] }, exercices)).toThrow();
    expect(() => validerSeanceIA({}, exercices)).toThrow();
  });

  it('retombe sur des valeurs par défaut sûres pour série/valeur/type/repos manquants ou invalides', () => {
    const exercices = [creerExercice({ id: 'ex-1', valeurDefautRepetitions: 12, valeurDefautDuree: 40 })];
    const { blocs } = validerSeanceIA({ blocs: [{ exerciceId: 'ex-1' }] }, exercices);

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
    const { blocs } = validerSeanceIA({ blocs: [{ exerciceId: 'ex-1', type: 'duree' }] }, exercices);
    expect(blocs[0].type).toBe('duree');
    expect(blocs[0].valeur).toBe(40);
  });

  it('valide les critères comme validerCriteresIA (retombe sur les défauts si absents/invalides)', () => {
    const exercices = [creerExercice({ id: 'ex-1' })];
    const { criteres } = validerSeanceIA({ blocs: [{ exerciceId: 'ex-1' }], criteres: { niveau: 'expert' } }, exercices);
    expect(criteres.niveau).toBe('intermediaire');
    expect(criteres.dureeMinutes).toBe(20);
  });
});
