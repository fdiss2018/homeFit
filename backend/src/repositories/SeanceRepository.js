import { db } from '../firebaseAdmin.js';
import { Seance } from '../domain/Seance.js';

function seancesCollection(uid) {
  return db.collection('joueurs').doc(uid).collection('seances');
}

export const SeanceRepository = {
  async ajouter(uid, seance) {
    const donnees = { ...seance.toFirestore(), date: seance.date || new Date().toISOString() };
    const ref = await seancesCollection(uid).add(donnees);
    return ref.id;
  },

  async lister(uid) {
    const snap = await seancesCollection(uid).orderBy('date', 'desc').get();
    return snap.docs.map(d => Seance.fromFirestore(d.id, d.data()));
  },

  async mettreAJour(uid, id, seance) {
    await seancesCollection(uid).doc(id).update(seance.toFirestore());
  },

  async supprimer(uid, id) {
    await seancesCollection(uid).doc(id).delete();
  }
};
