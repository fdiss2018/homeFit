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
    type = 'repetitions',   // 'repetitions' | 'duree'
    valeurDefaut = 10,      // nb de répétitions, ou secondes si type === 'duree'
    description = '',
    instructions = '',
    image = ''
  }) {
    this.id = id;
    this.nom = nom;
    this.groupeMusculaire = groupeMusculaire;
    this.materiel = materiel;
    this.niveau = niveau;
    this.type = type;
    this.valeurDefaut = valeurDefaut;
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
      type: this.type,
      valeurDefaut: this.valeurDefaut,
      description: this.description,
      instructions: this.instructions,
      image: this.image
    };
  }

  static fromFirestore(id, data) {
    return new Exercice({ id, ...data });
  }
}
