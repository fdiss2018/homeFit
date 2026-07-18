// Garde-fou anti-régression : bloque tout `firebase deploy` (manuel ou scripté) si
// public/api-config.js pointe encore vers localhost. Branché en hook "predeploy" dans
// firebase.json — se déclenche automatiquement, pas d'étape à se rappeler de lancer.
// Défense en profondeur : le pipeline CI/CD régénère normalement ce fichier depuis un secret à
// chaque déploiement (voir .github/workflows/deploy.yml), mais un déploiement manuel de secours
// reste possible et doit être protégé de la même façon.
import { readFileSync } from 'node:fs';

const chemin = 'public/api-config.js';
const contenu = readFileSync(chemin, 'utf8');

if (contenu.includes('localhost')) {
  console.error(`❌ ${chemin} pointe encore vers localhost — déploiement annulé.`);
  console.error('   Corrige API_BASE_URL vers le backend Cloud Run avant de redéployer.');
  process.exit(1);
}
