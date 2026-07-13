import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// FIREBASE_SERVICE_ACCOUNT_JSON contient le JSON complet de la clé de compte de
// service (téléchargée depuis Console Firebase > Paramètres du projet > Comptes
// de service), sur une seule ligne. Jamais committé — variable d'environnement
// uniquement (voir .env.example), comme gemini-config.js/firebase-config.js
// côté front.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

const app = initializeApp({
  credential: cert(serviceAccount)
});

// Le SDK Admin contourne entièrement firestore.rules : lui seul doit avoir
// accès à Firestore désormais (le front ne l'appelle plus directement).
export const db = getFirestore(app);
export const auth = getAuth(app);
