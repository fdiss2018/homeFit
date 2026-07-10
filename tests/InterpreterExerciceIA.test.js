import { describe, it, expect } from 'vitest';
import { construireRequeteGeminiExercice, validerExerciceIA } from '../public/utils/InterpreterExerciceIA.js';

describe('construireRequeteGeminiExercice', () => {
  it("inclut la description de l'utilisateur dans le prompt", () => {
    const requete = construireRequeteGeminiExercice('pompes diamant, triceps, avancé');
    expect(requete.contents[0].parts[0].text).toContain('pompes diamant, triceps, avancé');
  });

  it('force une réponse JSON conforme au schéma Exercice, nom et groupe requis', () => {
    const requete = construireRequeteGeminiExercice('peu importe');
    expect(requete.generationConfig.responseMimeType).toBe('application/json');
    expect(requete.generationConfig.responseSchema.required).toEqual(['nom', 'groupeMusculaire']);
  });
});

describe('validerExerciceIA', () => {
  it('accepte une fiche bien formée telle quelle', () => {
    const exercice = validerExerciceIA({
      nom: 'Pompes diamant',
      groupeMusculaire: 'triceps',
      materiel: [],
      niveau: 'avance',
      valeurDefautRepetitions: 12,
      valeurDefautDuree: 36,
      description: 'Pompes mains jointes en losange.',
      instructions: 'Coudes proches du corps.'
    });
    expect(exercice).toEqual({
      nom: 'Pompes diamant',
      groupeMusculaire: 'triceps',
      materiel: [],
      niveau: 'avance',
      valeurDefautRepetitions: 12,
      valeurDefautDuree: 36,
      description: 'Pompes mains jointes en losange.',
      instructions: 'Coudes proches du corps.'
    });
  });

  it('rejette une réponse sans nom exploitable', () => {
    expect(() => validerExerciceIA({ groupeMusculaire: 'triceps' })).toThrow();
    expect(() => validerExerciceIA({ nom: '   ', groupeMusculaire: 'triceps' })).toThrow();
  });

  it('rejette une réponse sans groupe musculaire valide', () => {
    expect(() => validerExerciceIA({ nom: 'Super exercice' })).toThrow();
    expect(() => validerExerciceIA({ nom: 'Super exercice', groupeMusculaire: 'muscle-imaginaire' })).toThrow();
  });

  it('ignore le matériel halluciné et retombe sur des valeurs par défaut sûres', () => {
    const exercice = validerExerciceIA({
      nom: 'Squat',
      groupeMusculaire: 'quadriceps',
      materiel: ['halteres', 'trampoline'],
      niveau: 'expert-galactique',
      valeurDefautRepetitions: -5,
      valeurDefautDuree: 'pas un nombre'
    });
    expect(exercice.materiel).toEqual(['halteres']);
    expect(exercice.niveau).toBe('debutant');
    expect(exercice.valeurDefautRepetitions).toBe(10);
    expect(exercice.valeurDefautDuree).toBe(30);
    expect(exercice.description).toBe('');
    expect(exercice.instructions).toBe('');
  });
});
