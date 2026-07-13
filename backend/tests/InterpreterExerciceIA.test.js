import { describe, it, expect } from 'vitest';
import { Exercice } from '../src/domain/Exercice.js';
import { construireRequeteExercicesIA, validerExercicesIA } from '../src/domain/InterpreterExerciceIA.js';

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

describe('construireRequeteExercicesIA', () => {
  it("inclut la description de l'utilisateur dans le prompt", () => {
    const requete = construireRequeteExercicesIA('renforcement genoux', []);
    expect(requete.contents[0].parts[0].text).toContain('renforcement genoux');
  });

  it('liste le catalogue existant fourni dans le prompt', () => {
    const exercices = [creerExercice({ id: 'abc123', nom: 'Squats', materiel: ['tapis'] })];
    const requete = construireRequeteExercicesIA('peu importe', exercices);
    expect(requete.contents[0].parts[0].text).toContain('abc123 | Squats | pectoraux | debutant | matériel: tapis');
  });

  it('déclare exerciceExistantId en STRING libre (pas de enum géant)', () => {
    const exercices = [creerExercice({ id: 'ex-1' }), creerExercice({ id: 'ex-2' })];
    const requete = construireRequeteExercicesIA('peu importe', exercices);
    // Volontairement pas d'enum ici malgré les ~150+ ids possibles : mesuré empiriquement qu'un
    // enum de cette taille fait dériver ce modèle vers une génération dégénérée bien plus souvent
    // — validerExercicesIA() est la seule ligne de défense contre un id halluciné.
    expect(requete.generationConfig.responseSchema.properties.exercices.items.properties.exerciceExistantId)
      .toEqual({ type: 'STRING' });
  });

  it('mentionne le sentinel "nouveau" dans le prompt pour un nouvel exercice', () => {
    const requete = construireRequeteExercicesIA('peu importe', []);
    expect(requete.contents[0].parts[0].text).toContain('"nouveau"');
  });

  it('exige description et instructions dans le schéma, pas seulement nom/groupeMusculaire', () => {
    const requete = construireRequeteExercicesIA('peu importe', []);
    expect(requete.generationConfig.responseSchema.properties.exercices.items.required)
      .toEqual(['nom', 'groupeMusculaire', 'description', 'instructions']);
  });
});

describe('validerExercicesIA', () => {
  it('classe une proposition sans exerciceExistantId parmi les nouveaux', () => {
    const { nouveaux, existants } = validerExercicesIA({
      exercices: [{ exerciceExistantId: 'nouveau', nom: 'Extension genou élastique', groupeMusculaire: 'quadriceps' }]
    }, []);
    expect(existants).toEqual([]);
    expect(nouveaux).toHaveLength(1);
    expect(nouveaux[0].nom).toBe('Extension genou élastique');
    expect(nouveaux[0].groupeMusculaire).toBe('quadriceps');
  });

  it('classe une proposition référençant un id valide parmi les existants, avec nomActuel', () => {
    const exercices = [creerExercice({ id: 'abc123', nom: 'Pont fessier' })];
    const { nouveaux, existants } = validerExercicesIA({
      exercices: [{ exerciceExistantId: 'abc123', nom: 'Pont fessier (variante genou fragile)', groupeMusculaire: 'fessiers' }]
    }, exercices);
    expect(nouveaux).toEqual([]);
    expect(existants).toHaveLength(1);
    expect(existants[0]).toMatchObject({ id: 'abc123', nomActuel: 'Pont fessier', nom: 'Pont fessier (variante genou fragile)' });
  });

  it('traite un exerciceExistantId halluciné (hors catalogue) comme un nouvel exercice', () => {
    const { nouveaux, existants } = validerExercicesIA({
      exercices: [{ exerciceExistantId: 'id-invente', nom: 'Exercice X', groupeMusculaire: 'abdominaux' }]
    }, [creerExercice({ id: 'ex-1' })]);
    expect(existants).toEqual([]);
    expect(nouveaux).toHaveLength(1);
  });

  it('ignore un item sans nom ou groupeMusculaire invalide sans faire échouer le lot', () => {
    const { nouveaux } = validerExercicesIA({
      exercices: [
        { exerciceExistantId: 'nouveau', nom: '', groupeMusculaire: 'quadriceps' },
        { exerciceExistantId: 'nouveau', nom: 'Squats sautés', groupeMusculaire: 'groupe-invente' },
        { exerciceExistantId: 'nouveau', nom: 'Fentes', groupeMusculaire: 'fessiers' }
      ]
    }, []);
    expect(nouveaux).toHaveLength(1);
    expect(nouveaux[0].nom).toBe('Fentes');
  });

  it('propose plusieurs exercices pour une demande de programme plus large', () => {
    const { nouveaux } = validerExercicesIA({
      exercices: [
        { exerciceExistantId: 'nouveau', nom: 'Extension genou élastique', groupeMusculaire: 'quadriceps' },
        { exerciceExistantId: 'nouveau', nom: 'Pont fessier', groupeMusculaire: 'fessiers' },
        { exerciceExistantId: 'nouveau', nom: 'Gainage planche', groupeMusculaire: 'abdominaux' }
      ]
    }, []);
    expect(nouveaux).toHaveLength(3);
  });

  it("lève une erreur explicite si aucune proposition n'est exploitable", () => {
    expect(() => validerExercicesIA({ exercices: [] }, [])).toThrow();
    expect(() => validerExercicesIA({}, [])).toThrow();
    expect(() => validerExercicesIA({ exercices: [{ nom: '', groupeMusculaire: 'pectoraux' }] }, [])).toThrow();
  });

  it('retombe sur des valeurs par défaut sûres pour les champs manquants ou invalides', () => {
    const { nouveaux } = validerExercicesIA({
      exercices: [{ exerciceExistantId: 'nouveau', nom: 'Squats', groupeMusculaire: 'quadriceps', materiel: ['trampoline'] }]
    }, []);
    expect(nouveaux[0]).toEqual({
      nom: 'Squats',
      groupeMusculaire: 'quadriceps',
      materiel: [],
      niveau: 'debutant',
      valeurDefautRepetitions: 10,
      valeurDefautDuree: 30,
      description: '',
      instructions: ''
    });
  });
});
