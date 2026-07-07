import { auth } from '../firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';

export const AuthService = {

  async sInscrire(email, motDePasse, nom) {
    const cred = await createUserWithEmailAndPassword(auth, email, motDePasse);
    if (nom) await updateProfile(cred.user, { displayName: nom });
    return cred.user;
  },

  async seConnecter(email, motDePasse) {
    const cred = await signInWithEmailAndPassword(auth, email, motDePasse);
    return cred.user;
  },

  async seConnecterAvecGoogle() {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  },

  async seDeconnecter() {
    await signOut(auth);
  },

  async mettreAJourPseudo(nom) {
    if (!auth.currentUser || !nom) return;
    await updateProfile(auth.currentUser, { displayName: nom });
  },

  utilisateurActuel() {
    return auth.currentUser;
  },

  ecouterAuth(callback) {
    return onAuthStateChanged(auth, callback);
  },
};
