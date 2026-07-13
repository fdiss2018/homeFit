// Une séance générée : liste de blocs d'exercices avec séries/répétitions/repos.
// `blocs[i].exercice` référence l'Exercice complet (pour l'affichage), le reste
// décrit comment il doit être exécuté pour cette séance précise.
export class Seance {
  constructor({
    id = null,
    date = null,
    nom = null,
    criteres = {},
    blocs = [],
    dureeEstimeeMinutes = 0
  }) {
    this.id = id;
    this.date = date;
    this.nom = nom;
    this.criteres = criteres;
    this.blocs = blocs;
    this.dureeEstimeeMinutes = dureeEstimeeMinutes;
  }

  toFirestore() {
    return {
      date: this.date,
      nom: this.nom,
      criteres: this.criteres,
      dureeEstimeeMinutes: this.dureeEstimeeMinutes,
      blocs: this.blocs.map(b => ({
        exerciceId: b.exercice.id,
        nom: b.exercice.nom,
        series: b.series,
        valeur: b.valeur,
        type: b.type,
        reposSecondes: b.reposSecondes,
        reposApresSecondes: b.reposApresSecondes
      }))
    };
  }

  static fromFirestore(id, data) {
    return new Seance({
      id,
      date: data.date,
      nom: data.nom || null,
      criteres: data.criteres,
      dureeEstimeeMinutes: data.dureeEstimeeMinutes,
      blocs: (data.blocs || []).map(b => ({
        exercice: { id: b.exerciceId, nom: b.nom },
        series: b.series,
        valeur: b.valeur,
        type: b.type,
        reposSecondes: b.reposSecondes,
        reposApresSecondes: b.reposApresSecondes ?? 60
      }))
    });
  }
}
