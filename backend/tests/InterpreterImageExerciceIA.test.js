import { describe, it, expect } from 'vitest';
import { construireRequeteImageExerciceIA } from '../src/domain/InterpreterImageExerciceIA.js';

describe('construireRequeteImageExerciceIA', () => {
  it('inclut le gabarit de prompt fixe, le nom et la description dans le prompt', () => {
    const requete = construireRequeteImageExerciceIA('Pompes', 'Exercice de poussée au poids du corps.');
    const texte = requete.contents[0].parts[0].text;
    expect(texte).toContain('grille 3x3');
    expect(texte).toContain('mannequin 3D minimaliste');
    expect(texte).toContain('Pompes');
    expect(texte).toContain('Exercice de poussée au poids du corps.');
  });

  it("ne déclare ni responseSchema ni responseMimeType (sortie image, pas JSON)", () => {
    const requete = construireRequeteImageExerciceIA('Pompes', 'description');
    expect(requete.generationConfig).toBeUndefined();
  });
});
