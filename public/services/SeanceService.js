// Génération de séance : décision métier (sélection des exercices, mix des
// blocs) déléguée au backend (voir backend/src/domain/GenerateurSeance.js) —
// le front ne fait que soumettre les critères et afficher le résultat.
import { ApiClient } from './ApiClient.js';
import { Seance } from '../models/Seance.js';

export const SeanceService = {
  async generer(criteres) {
    return new Seance(await ApiClient.post('/api/seances/generer', criteres));
  },

  // Génération "Décris ta séance" : l'IA choisit elle-même les exercices adaptés à la
  // description (parmi la bibliothèque publique) ainsi que la durée et les temps de repos —
  // voir backend/src/domain/InterpreterSeanceIA.js. Un seul appel réseau, aucune étape
  // intermédiaire de pré-remplissage de critères côté front.
  async genererParIA(description) {
    return new Seance(await ApiClient.post('/api/ia/generer-seance', { description }));
  }
};
