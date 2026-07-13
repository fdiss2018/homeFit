import { db } from '../firebaseAdmin.js';
import { Exercice } from '../domain/Exercice.js';

const COLLECTION = 'exercices';

export const ExerciceRepository = {
  async creer(exercice) {
    const ref = await db.collection(COLLECTION).add(exercice.toFirestore());
    return ref.id;
  },

  async listerTous() {
    const snap = await db.collection(COLLECTION).get();
    return snap.docs.map(d => Exercice.fromFirestore(d.id, d.data()));
  },

  async mettreAJour(id, exercice) {
    await db.collection(COLLECTION).doc(id).update(exercice.toFirestore());
  },

  async supprimer(id) {
    await db.collection(COLLECTION).doc(id).delete();
  }
};
