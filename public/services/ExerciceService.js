import { db } from '../firebase-config.js';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { Exercice } from '../models/Exercice.js';

const COLLECTION = 'exercices';

export const ExerciceService = {

  async creer(exercice) {
    const ref = await addDoc(collection(db, COLLECTION), exercice.toFirestore());
    return ref.id;
  },

  async listerTous() {
    const snap = await getDocs(collection(db, COLLECTION));
    return snap.docs.map(d => Exercice.fromFirestore(d.id, d.data()));
  },

  async mettreAJour(id, exercice) {
    await updateDoc(doc(db, COLLECTION, id), exercice.toFirestore());
  },

  async supprimer(id) {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  ecouterTous(callback) {
    return onSnapshot(collection(db, COLLECTION), snap => {
      callback(snap.docs.map(d => Exercice.fromFirestore(d.id, d.data())));
    });
  }
};
