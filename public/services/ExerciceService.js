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
  },

  async televerserImage(id, imageBase64, mimeType) {
    return ApiClient.post(`/api/exercices/${id}/image`, { imageBase64, mimeType });
  },

  async supprimerImage(id) {
    await ApiClient.delete(`/api/exercices/${id}/image`);
  },

  async listerImagesOrphelines() {
    return ApiClient.get('/api/exercices/images-orphelines');
  },

  async supprimerImageOrpheline(nom) {
    await ApiClient.delete(`/api/exercices/images-orphelines/${encodeURIComponent(nom)}`);
  }
};
