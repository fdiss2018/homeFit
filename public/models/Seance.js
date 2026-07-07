// Une séance générée : liste de blocs d'exercices avec séries/répétitions/repos.
// `blocs[i].exercice` référence l'Exercice complet (pour l'affichage), le reste
// décrit comment il doit être exécuté pour cette séance précise.
export class Seance {
  constructor({
    id = null,
    date = null,
    criteres = {},
    blocs = [],
    dureeEstimeeMinutes = 0
  }) {
    this.id = id;
    this.date = date;
    this.criteres = criteres;
    this.blocs = blocs;
    this.dureeEstimeeMinutes = dureeEstimeeMinutes;
  }

  toFirestore() {
    return {
      date: this.date,
      criteres: this.criteres,
      dureeEstimeeMinutes: this.dureeEstimeeMinutes,
      blocs: this.blocs.map(b => ({
        exerciceId: b.exercice.id,
        nom: b.exercice.nom,
        series: b.series,
        valeur: b.valeur,
        type: b.type,
        reposSecondes: b.reposSecondes
      }))
    };
  }

  static fromFirestore(id, data) {
    return new Seance({
      id,
      date: data.date,
      criteres: data.criteres,
      dureeEstimeeMinutes: data.dureeEstimeeMinutes,
      blocs: (data.blocs || []).map(b => ({
        exercice: { id: b.exerciceId, nom: b.nom },
        series: b.series,
        valeur: b.valeur,
        type: b.type,
        reposSecondes: b.reposSecondes
      }))
    });
  }
}
