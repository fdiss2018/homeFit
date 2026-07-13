import { ApiClient } from './ApiClient.js';
import { Exercice } from '../models/Exercice.js';

export const ExerciceService = {

  async creer(exercice) {
    const { id } = await ApiClient.post('/api/exercices', exercice.toFirestore());
    return id;
  },

  async listerTous() {
    const donnees = await ApiClient.get('/api/exercices');
    return donnees.map(d => new Exercice(d));
  },

  async mettreAJour(id, exercice) {
    await ApiClient.put(`/api/exercices/${id}`, exercice.toFirestore());
  },

  async supprimer(id) {
    await ApiClient.delete(`/api/exercices/${id}`);
  }
};
