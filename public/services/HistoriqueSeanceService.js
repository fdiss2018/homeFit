// Façade transparente : historique en localStorage pour un utilisateur anonyme,
// dans Firestore (joueurs/{uid}/seances) pour un utilisateur connecté.
// Les pages appelantes n'ont pas à connaître le mode de stockage utilisé.
import { db } from '../firebase-config.js';
import {
  collection, addDoc, getDocs, query, orderBy, doc, deleteDoc
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { AuthService } from './AuthService.js';
import { Seance } from '../models/Seance.js';

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

export const HistoriqueSeanceService = {

  async ajouter(seance) {
    const utilisateur = AuthService.utilisateurActuel();
    const donnees = { ...seance.toFirestore(), date: seance.date || new Date().toISOString() };

    if (utilisateur) {
      await addDoc(collection(db, 'joueurs', utilisateur.uid, 'seances'), donnees);
      return;
    }

    const seances = lireLocalStorage();
    seances.unshift({ id: crypto.randomUUID(), ...donnees });
    ecrireLocalStorage(seances.slice(0, MAX_SEANCES_LOCALES));
  },

  async lister() {
    const utilisateur = AuthService.utilisateurActuel();

    if (utilisateur) {
      const snap = await getDocs(
        query(collection(db, 'joueurs', utilisateur.uid, 'seances'), orderBy('date', 'desc'))
      );
      return snap.docs.map(d => Seance.fromFirestore(d.id, d.data()));
    }

    return lireLocalStorage()
      .map(s => Seance.fromFirestore(s.id, s))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  async supprimer(id) {
    const utilisateur = AuthService.utilisateurActuel();

    if (utilisateur) {
      await deleteDoc(doc(db, 'joueurs', utilisateur.uid, 'seances', id));
      return;
    }

    ecrireLocalStorage(lireLocalStorage().filter(s => s.id !== id));
  },

  // Importe l'historique local dans Firestore lors de la première connexion
  // sur un device, sans écraser les séances déjà présentes côté serveur.
  async migrerDepuisLocalStorage(uid) {
    const seancesLocales = lireLocalStorage();
    if (seancesLocales.length === 0) return;

    for (const { id, ...donnees } of seancesLocales) {
      await addDoc(collection(db, 'joueurs', uid, 'seances'), donnees);
    }
    ecrireLocalStorage([]);
  }
};
