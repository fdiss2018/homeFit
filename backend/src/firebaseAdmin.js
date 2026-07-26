import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

// FIREBASE_SERVICE_ACCOUNT_JSON contient le JSON complet de la clé de compte de
// service (téléchargée depuis Console Firebase > Paramètres du projet > Comptes
// de service), sur une seule ligne. Jamais committé — variable d'environnement
// uniquement (voir .env.example), comme gemini-config.js/firebase-config.js
// côté front.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

// Le SDK Admin contourne entièrement firestore.rules : lui seul doit avoir
// accès à Firestore désormais (le front ne l'appelle plus directement).
export const db = getFirestore(app);
export const auth = getAuth(app);

// Paresseux plutôt qu'exporté directement : FIREBASE_STORAGE_BUCKET est optionnel (comme
// GEMINI_API_KEY) tant qu'on n'utilise pas les illustrations d'exercice — .bucket() lève une
// exception si la variable est absente, qui ne doit faire échouer que l'appel qui en a besoin
// (ImageRepository), pas planter tout le serveur au démarrage.
export function obtenirBucketStorage() {
  return getStorage(app).bucket();
}
