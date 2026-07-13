// Copier ce fichier en "firebase-config.js" (ignoré par git) et renseigner
// la configuration de votre projet Firebase (console.firebase.google.com).
// Ne sert plus qu'à Firebase Auth : Firestore est désormais uniquement accédé
// par le backend (Admin SDK, voir backend/.env.example).
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "VOTRE_PROJET.firebaseapp.com",
  projectId: "VOTRE_PROJET",
  storageBucket: "VOTRE_PROJET.firebasestorage.app",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId: "VOTRE_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };
