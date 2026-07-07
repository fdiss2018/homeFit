import { SECONDES_PAR_REPETITION } from '../utils/constantes.js';

export const GROUPES_MUSCULAIRES = [
  'jambes', 'dos', 'pectoraux', 'epaules', 'bras', 'abdominaux', 'cardio', 'full-body'
];

export const NIVEAUX = ['debutant', 'intermediaire', 'avance'];

export class Exercice {
  constructor({
    id = null,
    nom,
    groupeMusculaire,
    materiel = [],
    niveau = 'debutant',
    valeurDefautRepetitions = 10,
    valeurDefautDuree = 30,
    description = '',
    instructions = '',
    image = ''
  }) {
    this.id = id;
    this.nom = nom;
    this.groupeMusculaire = groupeMusculaire;
    this.materiel = materiel;
    this.niveau = niveau;
    this.valeurDefautRepetitions = valeurDefautRepetitions;
    this.valeurDefautDuree = valeurDefautDuree;
    this.description = description;
    this.instructions = instructions;
    this.image = image;
  }

  toFirestore() {
    return {
      nom: this.nom,
      groupeMusculaire: this.groupeMusculaire,
      materiel: this.materiel,
      niveau: this.niveau,
      valeurDefautRepetitions: this.valeurDefautRepetitions,
      valeurDefautDuree: this.valeurDefautDuree,
      description: this.description,
      instructions: this.instructions,
      image: this.image
    };
  }

  // Rétrocompatibilité : les exercices créés avant l'ajout des deux valeurs par
  // défaut n'ont que l'ancien couple { type, valeurDefaut } — on dérive la
  // valeur manquante par conversion plutôt que de casser leur affichage.
  static fromFirestore(id, data) {
    let { valeurDefautRepetitions, valeurDefautDuree } = data;

    if (valeurDefautRepetitions === undefined || valeurDefautDuree === undefined) {
      const valeurLegacy = data.valeurDefaut ?? 10;
      if (data.type === 'duree') {
        valeurDefautDuree ??= valeurLegacy;
        valeurDefautRepetitions ??= Math.round(valeurLegacy / SECONDES_PAR_REPETITION);
      } else {
        valeurDefautRepetitions ??= valeurLegacy;
        valeurDefautDuree ??= Math.round(valeurLegacy * SECONDES_PAR_REPETITION);
      }
    }

    return new Exercice({ id, ...data, valeurDefautRepetitions, valeurDefautDuree });
  }
}
