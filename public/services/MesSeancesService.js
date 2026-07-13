// Façade transparente : séances en localStorage pour un utilisateur anonyme,
// via le backend (/api/seances, Firestore joueurs/{uid}/seances côté serveur)
// pour un utilisateur connecté. Les pages appelantes n'ont pas à connaître le
// mode de stockage utilisé.
import { ApiClient } from './ApiClient.js';
import { AuthService } from './AuthService.js';
import { Seance } from '../models/Seance.js';

// Clé de stockage historique ("hf_historique") volontairement inchangée : c'est le format de
// persistance réel des séances déjà enregistrées localement par les utilisateurs anonymes — la
// renommer ferait perdre l'accès à ces données existantes, ce n'est pas qu'un nom de code.
const CLE_LOCALSTORAGE = 'hf_historique';
const MAX_SEANCES_LOCALES = 30;

function lireLocalStorage() {
  try {
    return JSON.parse(localStorage.getItem(CLE_LOCALSTORAGE)) || [];
  } catch {
    return [];
  }
}

function ecrireLocalStorage(seances) {
  localStorage.setItem(CLE_LOCALSTORAGE, JSON.stringify(seances));
}

export const MesSeancesService = {

  async ajouter(seance) {
    const utilisateur = AuthService.utilisateurActuel();
    const date = seance.date || new Date().toISOString();

    if (utilisateur) {
      // Le backend attend la forme "constructeur" (blocs[].exercice imbriqué) : c'est
      // lui qui applique toFirestore() une seule fois, juste avant l'écriture Firestore.
      await ApiClient.post('/api/seances', { ...seance, date });
      return;
    }

    const donnees = { ...seance.toFirestore(), date };
    const seances = lireLocalStorage();
    seances.unshift({ id: crypto.randomUUID(), ...donnees });
    ecrireLocalStorage(seances.slice(0, MAX_SEANCES_LOCALES));
  },

  async lister() {
    const utilisateur = AuthService.utilisateurActuel();

    if (utilisateur) {
      const donnees = await ApiClient.get('/api/seances');
      return donnees.map(d => new Seance(d));
    }

    return lireLocalStorage()
      .map(s => Seance.fromFirestore(s.id, s))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  // Met à jour une séance déjà enregistrée (édition depuis mes-seances.html) —
  // remplace ses champs (nom, blocs, dureeEstimeeMinutes...) sans changer sa date d'origine.
  async mettreAJour(id, seance) {
    const utilisateur = AuthService.utilisateurActuel();

    if (utilisateur) {
      // Idem ajouter() : forme "constructeur", le backend flatten avant l'écriture.
      await ApiClient.put(`/api/seances/${id}`, seance);
      return;
    }

    const donnees = seance.toFirestore();
    const seances = lireLocalStorage();
    const index = seances.findIndex(s => s.id === id);
    if (index !== -1) {
      seances[index] = { id, ...donnees };
      ecrireLocalStorage(seances);
    }
  },

  async supprimer(id) {
    const utilisateur = AuthService.utilisateurActuel();

    if (utilisateur) {
      await ApiClient.delete(`/api/seances/${id}`);
      return;
    }

    ecrireLocalStorage(lireLocalStorage().filter(s => s.id !== id));
  },

  // Importe les séances locales dans Firestore lors de la première connexion
  // sur un device, sans écraser les séances déjà présentes côté serveur.
  // Chaque séance est retirée du localStorage dès sa migration réussie (plutôt
  // qu'à la toute fin) : si une migration échoue en cours de route (réseau...),
  // les séances déjà migrées ne seront pas re-migrées en double au prochain essai.
  // uid n'est plus nécessaire en paramètre : le backend le dérive lui-même du
  // token Firebase envoyé par ApiClient, il n'est jamais accepté depuis le client.
  async migrerDepuisLocalStorage() {
    const seancesLocales = lireLocalStorage();

    for (const { id, ...donnees } of seancesLocales) {
      // Les séances stockées en localStorage sont déjà "aplaties" (blocs[].exerciceId/nom) ;
      // on les reconstruit sous la forme "constructeur" attendue par le backend (voir ajouter()).
      await ApiClient.post('/api/seances', Seance.fromFirestore(null, donnees));
      ecrireLocalStorage(lireLocalStorage().filter(s => s.id !== id));
    }
  }
};
