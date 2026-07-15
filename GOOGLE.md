# Configuration Google (Firebase + GCP) — HomeFit

Ce fichier regroupe tout ce qui touche aux comptes/services Google du projet : Firebase (front),
Google Cloud (backend), et l'API Gemini. `CLAUDE.md` reste la référence d'architecture ; ce
fichier est la référence opérationnelle pour retrouver un identifiant, refaire une configuration,
ou redéployer.

## Comptes et projet

- **Compte Google utilisé** : `fdiss093@gmail.com` — c'est à la fois le compte propriétaire du
  projet Firebase/GCP, l'email connecté par `gcloud auth login`, et la valeur d'`ADMIN_EMAIL` de
  l'application (`public/auth-config.js` + `backend/.env`).
- **Projet Firebase/GCP** : `homefit-sh56` — un seul et même projet des deux côtés (Firebase et
  Google Cloud Console pointent vers le même projet sous-jacent).
  - Console Firebase : [console.firebase.google.com/project/homefit-sh56](https://console.firebase.google.com/project/homefit-sh56)
  - Console Google Cloud : [console.cloud.google.com/home/dashboard?project=homefit-sh56](https://console.cloud.google.com/home/dashboard?project=homefit-sh56)

## Firebase

### Services activés
- **Hosting** : sert `public/` sur [homefit-sh56.web.app](https://homefit-sh56.web.app)
- **Firestore Database** : accédée **uniquement par le backend** (Admin SDK) depuis la migration
  vers un backend séparé — plus aucun accès direct depuis le navigateur
- **Authentication** : Email/mot de passe + Google, entièrement côté front

### Config web app (`public/firebase-config.js`)
Fichier gitignoré, à copier depuis `public/firebase-config.example.js`. Contient la config web
publique du projet (apiKey, authDomain, projectId...) — normal qu'elle soit visible côté
navigateur, elle ne sert plus qu'à Firebase Auth (Firestore n'est plus jamais initialisé côté
front). Récupérable dans Console Firebase → Paramètres du projet → Général → Vos applications →
config SDK.

### Compte de service (Firebase Admin SDK)
Nécessaire uniquement pour le backend (`FIREBASE_SERVICE_ACCOUNT_JSON` dans `backend/.env`).

1. Console Firebase → ⚙️ Paramètres du projet → **Comptes de service**
2. **Générer une nouvelle clé privée** → télécharge un fichier JSON
3. Coller le contenu **sur une seule ligne** dans `FIREBASE_SERVICE_ACCOUNT_JSON`

Jamais committé (`backend/.env` est gitignoré). Si la clé est perdue/révoquée, il suffit d'en
regénérer une nouvelle depuis la même page — les anciennes peuvent être révoquées indépendamment.

### Sécurité Firestore
Pas de fichier `firestore.rules` dans ce repo (supprimé — code mort) : la protection ne vient pas
de règles mais de l'architecture elle-même, aucun SDK client n'accède jamais à Firestore, seul
l'Admin SDK (backend) le fait, et il contourne de toute façon les règles de sécurité. Écrire des
règles n'aurait donc protégé rien de réel.

## Google Cloud — backend (Cloud Run)

### Pourquoi Cloud Run
Choisi plutôt que Render après un comparatif technique/évolutivité/financier (démarrage à froid
~1-2s contre 30-60s, intégration native au projet GCP déjà existant) — au prix d'exiger une carte
bancaire sur le compte, contrairement à Render. Voir `CLAUDE.md` (roadmap, étape 3.4) pour le
contexte de la décision.

### Facturation
- **Compte de facturation** lié au projet `homefit-sh56` — obligatoire pour activer Cloud Run,
  même si l'usage réel reste gratuit (Console GCP → Facturation).
- **Alerte de budget à 1 €** configurée (Console GCP → Facturation → Budgets et alertes, portée
  projet `homefit-sh56`) — **notifie par email, ne bloque rien techniquement** (les budgets GCP
  n'imposent jamais de plafond réel).
- **Vraie protection contre un dérapage de coût** : `--max-instances=2` sur le service Cloud Run
  (voir plus bas) — borne le nombre d'instances simultanées, donc le coût maximum possible, quel
  que soit le trafic ou un éventuel abus.
- **Usage réel attendu** (trafic personnel, quelques requêtes/jour) très loin des quotas gratuits
  (2 millions de requêtes/mois) : coût attendu de 0 €.

### APIs GCP activées
```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project=homefit-sh56
```

### Service déployé
- **Nom** : `homefit-backend`
- **Région** : `europe-west9` (Paris)
- **URL** : `https://homefit-backend-194834616546.europe-west9.run.app`
- **Accès** : public (`--allow-unauthenticated`) — l'app a sa propre authentification applicative
  (token Firebase / bearer statique), pas besoin d'IAM Cloud Run devant

### gcloud CLI
Installé localement (Google Cloud SDK) et authentifié via :
```bash
gcloud auth login          # ouvre le navigateur, connexion avec fdiss093@gmail.com
gcloud config get-value project   # doit renvoyer homefit-sh56
```

> Sur Windows, le PATH n'est pas toujours rafraîchi dans un terminal déjà ouvert après
> l'installation du SDK. Si `gcloud` n'est pas trouvé, ouvrir un nouveau terminal ou, en
> PowerShell, forcer le rafraîchissement :
> ```powershell
> $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
> ```

### Déployer/redéployer le backend

Le déploiement se fait **depuis le code source** (buildpack automatique, aucun Dockerfile
nécessaire). Les variables d'environnement ne sont pas passées en ligne de commande (le JSON de
compte de service est trop volumineux/sensible pour ça) mais via un fichier YAML généré à la volée
depuis `backend/.env`, jamais committé :

```bash
cd backend
node -e "
const fs = require('fs');
const dotenv = require('dotenv');
const parsed = dotenv.parse(fs.readFileSync('.env'));
const lines = Object.entries(parsed)
  .filter(([k, v]) => k !== 'PORT' && v)
  .map(([k, v]) => k + ': ' + JSON.stringify(v));
fs.writeFileSync('/tmp/cloudrun-env.yaml', lines.join('\n') + '\n');
"

gcloud run deploy homefit-backend \
  --source=. \
  --region=europe-west9 \
  --allow-unauthenticated \
  --env-vars-file=/tmp/cloudrun-env.yaml \
  --max-instances=2 \
  --project=homefit-sh56

rm /tmp/cloudrun-env.yaml   # ne pas laisser traîner un fichier contenant les secrets
```

L'URL du service reste stable d'un redéploiement à l'autre (même nom de service + région) : pas
besoin de retoucher `public/api-config.js` pour un simple déploiement de code.

Si l'URL change (nouveau nom de service, nouvelle région, suppression/recréation) :
1. Mettre à jour `public/api-config.js` (gitignoré) avec la nouvelle URL
2. `firebase deploy`
3. Remettre `public/api-config.js` sur `http://localhost:3000` pour continuer le développement local

## Variables d'environnement backend (`backend/.env`)

Source de vérité des clés : `backend/.env.example`. Où obtenir chaque valeur :

| Variable | Où l'obtenir |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Console Firebase → Comptes de service (voir plus haut) |
| `ADMIN_EMAIL` | `fdiss093@gmail.com` — doit rester synchronisé avec `public/auth-config.js` |
| `CORS_ALLOWED_ORIGIN` | `http://localhost:5000,https://homefit-sh56.web.app` |
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) *(optionnel — assistant IA)* |
| `GEMINI_MODEL` | `gemini-flash-lite-latest` (alias Google, voir "Churn des modèles" dans `CLAUDE.md`) |
| `STATIC_API_TOKEN` | Généré une fois (`openssl rand -hex 32`) *(optionnel — tests Postman)* |

## API Gemini

- Clé créée sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey) avec le compte
  `fdiss093@gmail.com`.
- **Pas besoin de restriction par référent HTTP** : la clé ne quitte jamais le serveur (backend
  uniquement), contrairement à l'ancienne implémentation 100 % statique.
- Niveau gratuit — voir `CLAUDE.md` pour la fiabilité mesurée du modèle (génération dégénérée
  occasionnelle, mitigée par retry/timeout côté backend) et la gestion du churn des modèles Google.

## CORS

`CORS_ALLOWED_ORIGIN` (variable d'env backend) doit toujours contenir :
- `http://localhost:5000` (dev local, `firebase serve`/emulators)
- `https://homefit-sh56.web.app` (production)

À mettre à jour aussi bien dans `backend/.env` (local) que dans le fichier d'env vars généré pour
Cloud Run (voir plus haut) si un nouveau domaine doit être autorisé.
