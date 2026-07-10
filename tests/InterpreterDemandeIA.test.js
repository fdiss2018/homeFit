import { describe, it, expect } from 'vitest';
import { construireRequeteGemini, validerCriteresIA } from '../public/utils/InterpreterDemandeIA.js';

describe('construireRequeteGemini', () => {
  it("inclut la description de l'utilisateur dans le prompt", () => {
    const requete = construireRequeteGemini('20 minutes, jambes, débutant');
    expect(requete.contents[0].parts[0].text).toContain('20 minutes, jambes, débutant');
  });

  it('force une réponse JSON conforme au schéma des critères', () => {
    const requete = construireRequeteGemini('peu importe');
    expect(requete.generationConfig.responseMimeType).toBe('application/json');
    expect(requete.generationConfig.responseSchema.required).toEqual(['dureeMinutes', 'niveau']);
    expect(requete.generationConfig.responseSchema.properties.niveau.enum).toEqual(['debutant', 'intermediaire', 'avance']);
  });

  it("ne déclare jamais un enum sur un champ qui n'est pas STRING (l'API Gemini rejette ces requêtes en 400)", () => {
    const { properties } = construireRequeteGemini('peu importe').generationConfig.responseSchema;
    for (const [nom, schema] of Object.entries(properties)) {
      const cible = schema.type === 'ARRAY' ? schema.items : schema;
      if (cible.enum) expect(cible.type, `propriété "${nom}"`).toBe('STRING');
    }
  });

  it('exprime le repos entre exercices en enum de chaînes (contournement de la contrainte Gemini)', () => {
    const { reposEntreExercicesSecondes } = construireRequeteGemini('peu importe').generationConfig.responseSchema.properties;
    expect(reposEntreExercicesSecondes.type).toBe('STRING');
    expect(reposEntreExercicesSecondes.enum).toEqual(['15', '30', '60', '90', '120']);
  });
});

describe('validerCriteresIA', () => {
  it('accepte une réponse IA bien formée telle quelle', () => {
    const criteres = validerCriteresIA({
      dureeMinutes: 30,
      groupesMusculaires: ['quadriceps', 'abdominaux'],
      materielDisponible: ['halteres'],
      niveau: 'avance',
      preferenceType: 'duree',
      enchainementAutomatique: true,
      reposEntreExercicesSecondes: 90
    });
    expect(criteres).toEqual({
      dureeMinutes: 30,
      groupesMusculaires: ['quadriceps', 'abdominaux'],
      materielDisponible: ['halteres'],
      niveau: 'avance',
      preferenceType: 'duree',
      enchainementAutomatique: true,
      reposEntreExercicesSecondes: 90
    });
  });

  it('retombe sur des valeurs par défaut sûres si la réponse est vide ou absente', () => {
    expect(validerCriteresIA({})).toEqual({
      dureeMinutes: 20,
      groupesMusculaires: [],
      materielDisponible: [],
      niveau: 'intermediaire',
      preferenceType: 'repetitions',
      enchainementAutomatique: false,
      reposEntreExercicesSecondes: 60
    });
    expect(validerCriteresIA(null)).toEqual(validerCriteresIA({}));
  });

  it('ignore les groupes musculaires ou le matériel hallucinés (hors vocabulaire connu)', () => {
    const criteres = validerCriteresIA({
      groupesMusculaires: ['quadriceps', 'muscles-imaginaires'],
      materielDisponible: ['halteres', 'trampoline']
    });
    expect(criteres.groupesMusculaires).toEqual(['quadriceps']);
    expect(criteres.materielDisponible).toEqual(['halteres']);
  });

  it('convertit un repos entre exercices renvoyé en chaîne (forme réelle renvoyée par Gemini)', () => {
    expect(validerCriteresIA({ reposEntreExercicesSecondes: '90' }).reposEntreExercicesSecondes).toBe(90);
    expect(validerCriteresIA({ reposEntreExercicesSecondes: '15' }).reposEntreExercicesSecondes).toBe(15);
  });

  it('ramène une durée hors liste à la valeur disponible la plus proche', () => {
    expect(validerCriteresIA({ dureeMinutes: 25 }).dureeMinutes).toBe(20);
    expect(validerCriteresIA({ dureeMinutes: 38 }).dureeMinutes).toBe(45);
    expect(validerCriteresIA({ dureeMinutes: 'pas un nombre' }).dureeMinutes).toBe(20);
  });

  it('rejette un niveau ou un preferenceType invalide au profit du défaut', () => {
    expect(validerCriteresIA({ niveau: 'expert' }).niveau).toBe('intermediaire');
    expect(validerCriteresIA({ preferenceType: 'les-deux' }).preferenceType).toBe('repetitions');
  });
});
