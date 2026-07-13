import { describe, it, expect } from 'vitest';
import { validerCriteresIA } from '../src/domain/InterpreterDemandeIA.js';

// construireRequeteGemini (requête Gemini autonome pour les seuls critères) a été supprimée : la
// génération par IA passe désormais par un seul appel combiné (voir InterpreterSeanceIA.js /
// InterpreterSeanceIA.test.js), qui réutilise validerCriteresIA ci-dessous pour la partie critères.
describe('validerCriteresIA', () => {
  it('accepte une réponse IA bien formée telle quelle', () => {
    const criteres = validerCriteresIA({
      dureeMinutes: 30,
      groupesMusculaires: ['quadriceps', 'abdominaux'],
      materielDisponible: ['halteres'],
      niveau: 'avance',
      preferenceType: 'duree',
      enchainementAutomatique: true,
      reposEntreSeriesSecondes: 15,
      reposEntreExercicesSecondes: 90
    });
    expect(criteres).toEqual({
      dureeMinutes: 30,
      groupesMusculaires: ['quadriceps', 'abdominaux'],
      materielDisponible: ['halteres'],
      niveau: 'avance',
      preferenceType: 'duree',
      enchainementAutomatique: true,
      reposEntreSeriesSecondes: 15,
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
      reposEntreSeriesSecondes: 30,
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

  it('convertit un repos renvoyé en chaîne (forme réelle renvoyée par Gemini)', () => {
    expect(validerCriteresIA({ reposEntreSeriesSecondes: '15' }).reposEntreSeriesSecondes).toBe(15);
    expect(validerCriteresIA({ reposEntreExercicesSecondes: '90' }).reposEntreExercicesSecondes).toBe(90);
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
