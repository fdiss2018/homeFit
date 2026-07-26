// Frontière vers l'IA — appelle uniquement le backend (/api/ia/interpreter-exercices), qui seul
// détient la clé Gemini, récupère lui-même le catalogue existant et construit/valide la requête
// (voir backend/src/domain/InterpreterExerciceIA.js). La génération de séance par IA passe par
// SeanceService.genererParIA(), qui a sa propre route dédiée (/api/ia/generer-seance).
import { ApiClient } from './ApiClient.js';

export const GeminiService = {
  async interpreterExercices(description) {
    return ApiClient.post('/api/ia/interpreter-exercices', { description });
  },

  async genererImageExercice(id, nom, description) {
    return ApiClient.post('/api/ia/generer-image-exercice', { id, nom, description });
  }
};
