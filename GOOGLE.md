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

## CI/CD

Depuis l'Étape 3.6 (voir `CLAUDE.md`), front et backend se déploient **automatiquement** via
GitHub Actions à chaque merge dans `main` — plus de déploiement manuel en fonctionnement normal
(les procédures manuelles documentées plus bas dans ce fichier restent en repli — "break-glass" —
si le pipeline est indisponible).

### Pourquoi (deux incidents réels avant la mise en place)

1. `public/api-config.js` (gitignoré) était basculé à la main entre `localhost:3000` et l'URL
   Cloud Run avant/après chaque `firebase deploy` — **deux fois**, le site a été déployé en
   production avec ce fichier encore pointé vers `localhost`, cassant silencieusement l'app pour
   tous les visiteurs.
2. Les variables d'environnement Cloud Run étaient générées à la main depuis `backend/.env` via un
   script ad hoc écrivant un YAML temporaire en clair (voir l'ancienne procédure ci-dessous).

### Processus

- Toute modification passe par une branche + une Pull Request vers `main`.
- `.github/workflows/ci.yml` fait tourner les tests (front + backend, `npm run test:run`) sur
  chaque PR — aucun secret nécessaire (logique pure, sans réseau ni Firestore). Requis avant merge
  (règle de protection de branche sur `main`, voir "Actions manuelles" plus bas).
- `.github/workflows/deploy.yml` se déclenche sur chaque `push` vers `main` :
  - **Frontend** : régénère `public/firebase-config.js`/`public/api-config.js` depuis des secrets
    GitHub à chaque exécution (jamais depuis une copie de travail locale), déploie via
    `FirebaseExtended/action-hosting-deploy`, puis vérifie que la prod ne sert jamais `localhost`.
  - **Backend** : `gcloud run deploy` avec les 3 valeurs sensibles (`FIREBASE_SERVICE_ACCOUNT_JSON`,
    `GEMINI_API_KEY`, `STATIC_API_TOKEN`) référencées depuis **Google Secret Manager**
    (`--set-secrets`, plus aucun fichier en clair) et les valeurs non sensibles depuis des secrets
    GitHub, puis vérifie que `/api/whoami` répond.
- Garde-fou indépendant, actif même hors CI : `scripts/check-api-config.js`, branché en hook
  `predeploy` dans `firebase.json` — bloque tout `firebase deploy` (manuel y compris) si
  `public/api-config.js` contient `localhost`.

### Secrets GitHub à créer (Settings → Secrets and variables → Actions)

| Secret | Contenu |
|---|---|
| `GCP_SA_KEY` | Clé JSON du compte de service de déploiement (voir plus bas) |
| `FIREBASE_SERVICE_ACCOUNT_DEPLOY` | Clé JSON d'un compte de service avec le rôle Firebase Hosting Admin |
| `FIREBASE_CONFIG_JS` | Contenu complet d'un `public/firebase-config.js` rempli (voir `public/firebase-config.example.js`) |
| `PROD_API_BASE_URL` | `https://homefit-backend-194834616546.europe-west9.run.app` |
| `ADMIN_EMAIL`, `GEMINI_MODEL`, `CORS_ALLOWED_ORIGIN` | Copier depuis `backend/.env` |

### Secrets Google Secret Manager à créer (projet `homefit-sh56`)

```bash
gcloud services enable secretmanager.googleapis.com --project=homefit-sh56

gcloud secrets create FIREBASE_SERVICE_ACCOUNT_JSON --replication-policy=automatic --project=homefit-sh56
gcloud secrets versions add FIREBASE_SERVICE_ACCOUNT_JSON --data-file=- --project=homefit-sh56
# (coller le JSON du compte de service Firebase Admin, puis Ctrl+D)

gcloud secrets create GEMINI_API_KEY --replication-policy=automatic --project=homefit-sh56
gcloud secrets versions add GEMINI_API_KEY --data-file=- --project=homefit-sh56

gcloud secrets create STATIC_API_TOKEN --replication-policy=automatic --project=homefit-sh56
gcloud secrets versions add STATIC_API_TOKEN --data-file=- --project=homefit-sh56
```

⚠️ Deux comptes de service distincts entrent en jeu, avec des besoins différents :
- **`homefit-ci-deployer`** (voir plus bas) : exécute `gcloud run deploy`, a besoin de
  `roles/secretmanager.secretAccessor` uniquement pour que gcloud puisse *référencer* les secrets
  au moment du déploiement.
- **Le compte de service runtime de Cloud Run** (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`,
  le compte par défaut puisque le déploiement ne précise pas `--service-account`) : c'est LUI qui
  exécute le conteneur et doit pouvoir *lire* les secrets à l'exécution — sans ce binding, la
  création de la révision échoue (`Permission denied on secret ... for Revision service account`).
  À accorder sur chacun des 3 secrets :

```bash
for SECRET in FIREBASE_SERVICE_ACCOUNT_JSON GEMINI_API_KEY STATIC_API_TOKEN; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:194834616546-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --project=homefit-sh56
done
```

### Compte de service de déploiement (`GCP_SA_KEY`)

```bash
gcloud iam service-accounts create homefit-ci-deployer \
  --display-name="HomeFit CI/CD deployer" --project=homefit-sh56

for ROLE in roles/run.admin roles/iam.serviceAccountUser roles/cloudbuild.builds.editor roles/secretmanager.secretAccessor roles/artifactregistry.writer roles/storage.admin; do
  gcloud projects add-iam-policy-binding homefit-sh56 \
    --member="serviceAccount:homefit-ci-deployer@homefit-sh56.iam.gserviceaccount.com" \
    --role="$ROLE"
done
```

`roles/artifactregistry.writer` est nécessaire car `gcloud run deploy --source=...` construit l'image
via Cloud Build puis la pousse dans un dépôt Artifact Registry (`cloud-run-source-deploy`, créé
automatiquement) — `roles/cloudbuild.builds.editor` seul ne donne pas accès à ce dépôt (erreur
rencontrée en pratique : `PERMISSION_DENIED` sur `artifactregistry.repositories.get`).

Avant de construire l'image, `gcloud run deploy --source=...` téléverse aussi le code source vers un
bucket GCS auto-créé (`run-sources-<projet>-<région>`), ce qui nécessite en pratique `roles/storage.admin`
**au niveau du projet** (déjà inclus dans la liste de rôles ci-dessus) — un binding IAM scopé sur ce
seul bucket ne suffit pas : `gcloud` fait aussi un appel `storage.buckets.list` **au niveau projet**
pendant l'étape "Uploading sources", que seul un rôle projet peut satisfaire (rencontré en pratique :
`PERMISSION_DENIED` sur `storage.buckets.get` puis, une fois corrigé au niveau bucket, sur
`storage.buckets.list` au niveau projet).

```bash

gcloud iam service-accounts keys create homefit-ci-deployer-key.json \
  --iam-account=homefit-ci-deployer@homefit-sh56.iam.gserviceaccount.com
# coller le contenu de homefit-ci-deployer-key.json dans le secret GitHub GCP_SA_KEY,
# puis supprimer le fichier local
```

### Actions manuelles requises (accès GitHub/GCP de l'utilisateur, non automatisables)

- GitHub : règle de protection sur `main` (PR obligatoire, checks `test-frontend`/`test-backend`
  requis) + créer les secrets listés ci-dessus.
- GCP : exécuter les commandes ci-dessus (compte de service, secrets Secret Manager) ; créer/obtenir
  un compte de service avec le rôle Firebase Hosting Admin pour `FIREBASE_SERVICE_ACCOUNT_DEPLOY`.

### Roadmap CI/CD future (pistes documentées, pas mises en place)

À activer à la carte si le besoin se présente (plus de contributeurs, plus de trafic) :
- **Previews Firebase par PR** (`firebase hosting:channel:deploy`, URL éphémère commentée sur la
  PR) pointées vers un backend de staging plutôt que prod.
- **Backend de staging** : second service Cloud Run `homefit-backend-staging` (scale-to-zero, coût
  quasi nul à l'arrêt) + base Firestore **nommée séparée** (pas la base par défaut) — nécessaire
  car la bibliothèque d'exercices est une collection globale partagée, pas par utilisateur ; tester
  en staging sur les mêmes données toucherait directement ce que voient les vrais utilisateurs.
  Implique une petite modification de code (`backend/src/firebaseAdmin.js` :
  `getFirestore(app, process.env.FIRESTORE_DATABASE_ID)`).
- **Workload Identity Federation** : élimine la clé de compte de service statique (`GCP_SA_KEY`) au
  profit d'un jeton OIDC de courte durée — pertinent le jour où plusieurs dépôts/contributeurs
  justifient l'effort de mise en place (pool + provider OIDC + bindings IAM).
- **GitHub Environments** avec revue manuelle obligatoire avant le job de déploiement prod.

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

### Déployer/redéployer le backend manuellement (repli — voir "## CI/CD" pour le mode normal)

⚠️ En fonctionnement normal, le déploiement se fait via `.github/workflows/deploy.yml` sur merge
dans `main` (voir "## CI/CD" plus haut) — cette procédure manuelle ne sert que de secours si le
pipeline est indisponible.

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

À mettre à jour aussi bien dans `backend/.env` (local) que dans le secret GitHub
`CORS_ALLOWED_ORIGIN` (voir "## CI/CD") si un nouveau domaine doit être autorisé.

## Rollback en cas d'incident

Revenir en arrière ne nécessite jamais un nouveau déploiement — les révisions/versions précédentes
existent déjà.

**Backend (Cloud Run)** — bascule instantanée du trafic vers une révision antérieure :
```bash
gcloud run revisions list --service=homefit-backend --region=europe-west9 --project=homefit-sh56
gcloud run services update-traffic homefit-backend \
  --region=europe-west9 --project=homefit-sh56 \
  --to-revisions=homefit-backend-00042-abc=100
```

**Frontend (Firebase Hosting)** — le plus simple : Console Firebase → Hosting → historique des
versions → bouton "Rollback" (un clic, pas besoin de la CLI). Équivalent en ligne de commande :
`firebase hosting:clone SOURCE_SITE_ID:SOURCE_VERSION_ID homefit-sh56:live`.
