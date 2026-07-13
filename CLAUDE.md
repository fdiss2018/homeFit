# HomeFit

Générateur de séances de sport à la maison.

## Stack technique

- **Frontend** : Vanilla HTML/CSS/JS (pas de framework, pas de bundler), déployé sur Firebase
  Hosting (`public/` est la racine servie). Ne parle **plus jamais** directement à Firestore ni à
  l'API Gemini — uniquement à Firebase Auth (connexion) et au backend (tout le reste), via
  `services/ApiClient.js`.
- **Backend** : Node/Express (`backend/`), seul point d'accès à Cloud Firestore (via
  `firebase-admin`, Admin SDK) et à l'API Gemini (clé serveur, jamais exposée au navigateur).
  Contient toute la **logique métier** : sélection/génération des exercices d'une séance, accès
  aux données, appel IA. Déployé indépendamment du front (ex. Render Web Service — voir
  `public/api-config.example.js`).
- **Authentification** : Firebase Auth (email + mot de passe, ou Google), entièrement côté front.
  Le backend ne fait que **vérifier** le token ID Firebase envoyé par le front (`firebase-admin`),
  il ne gère aucune session ni aucun formulaire de connexion.
- **SDK Firebase** : v12 chargé via CDN côté front (`https://www.gstatic.com/firebasejs/12.12.0/...`,
  Auth uniquement) ; `firebase-admin` côté backend (Firestore + vérification des tokens).
- **Modules ES** : les scripts front utilisent `type="module"` ; le backend est aussi en ESM
  (`"type": "module"` dans `backend/package.json`).
- **IA** : API Gemini (niveau gratuit), appelée uniquement depuis le backend
  (`backend/src/services/GeminiClient.js`) pour convertir une description en langage naturel en
  critères de génération ou en fiche exercice — voir section "Assistant IA" plus bas.
- **Tests** : Vitest, à la fois sur le front (racine du repo) et sur le backend (`backend/`) — dev
  uniquement, ne fait partie d'aucun déploiement.

## Structure des fichiers

```
public/
├── index.html                 # Accueil : accès générateur / bibliothèque / mes séances / compte
├── generateur.html            # Formulaire de critères → séance générée (backend) → édition des blocs → enregistrement
├── exercices.html             # Bibliothèque d'exercices (lecture seule, recherche)
├── mes-seances.html           # Mes séances enregistrées : Lancer/Modifier/Supprimer + export/import JSON
├── execution.html             # Écran d'exécution guidée (minuteur, enchaînement auto ou validation manuelle)
├── login.html                 # Connexion / inscription (Firebase Auth)
├── admin.html                 # Import/export, ajout/modification/suppression manuelle ou via IA (1 à N exercices), réservé à ADMIN_EMAIL
├── firebase-config.example.js # Modèle de config Firebase (à copier en firebase-config.js, gitignoré) — Auth uniquement
├── api-config.example.js      # Modèle d'URL du backend (à copier en api-config.js, gitignoré)
├── auth-config.js             # Email admin autorisé sur admin.html
├── style.css                  # Styles globaux (thème sombre/orange, sans framework CSS)
├── 404.html                   # Page d'erreur personnalisée
├── models/
│   ├── Exercice.js            # Classe Exercice (nom, groupeMusculaire, materiel, niveau, 2 valeurs par défaut...)
│   └── Seance.js               # Classe Seance (blocs d'exercices générés, durée estimée)
├── services/
│   ├── ApiClient.js            # Point d'entrée unique vers le backend (Bearer token Firebase, sérialisation JSON, erreurs)
│   ├── ExerciceService.js      # CRUD de la bibliothèque d'exercices via /api/exercices (creer/mettreAJour/supprimer/lister)
│   ├── SeanceService.js        # Génération de séance via /api/seances/generer (décision métier déléguée au backend)
│   ├── MesSeancesService.js    # Façade async : localStorage (anonyme) ou /api/seances (connecté)
│   ├── AuthService.js          # Firebase Auth (client) : inscription, connexion, déconnexion
│   └── GeminiService.js         # Appel de /api/ia/... (le backend seul détient la clé Gemini)
└── utils/
    ├── constantes.js            # Constantes partagées (SECONDES_PAR_REPETITION, MATERIEL_DISPONIBLE, LIBELLES)
    ├── GenerateurSeance.js       # calculerDureeEstimeeMinutes() — recalcul local de durée pendant l'édition d'un bloc
    └── ExecutionSeance.js        # construireEtapes() — aplatit une séance en étapes pour l'écran d'exécution
exemple/
└── exercices-exemple.json      # Bibliothèque d'exemple (160 exercices, 20 par groupe musculaire) à importer via admin.html

backend/
├── server.js                   # Point d'entrée Express : monte les routes, CORS, gestion d'erreur
├── .env.example                 # Modèle de variables d'environnement (à copier en .env, gitignoré)
├── package.json
└── src/
    ├── firebaseAdmin.js         # Init firebase-admin (Firestore + vérification des tokens Auth)
    ├── domain/                  # Logique pure — copie du domaine front (voir "Modèle de domaine")
    │   ├── constantes.js, Exercice.js, Seance.js
    │   ├── GenerateurSeance.js    # filtrerExercices() + genererSeance() — la vraie décision métier
    │   ├── InterpreterDemandeIA.js  # validerCriteresIA() — réutilisé par InterpreterSeanceIA.js
    │   ├── InterpreterSeanceIA.js   # génération de séance par IA (sélection directe des exercices)
    │   ├── InterpreterExerciceIA.js # construction/validation de la requête Gemini (fiche exercice)
    ├── repositories/
    │   ├── ExerciceRepository.js  # Accès Firestore (collection `exercices`) via l'Admin SDK
    │   └── SeanceRepository.js    # Accès Firestore (sous-collection `joueurs/{uid}/seances`)
    ├── services/
    │   └── GeminiClient.js        # Appel réseau vers l'API Gemini (clé côté serveur uniquement)
    ├── middleware/
    │   ├── auth.js                # Résout req.uid/req.isAdmin (token Firebase ou bearer statique de test)
    │   ├── requireAdmin.js         # 403 si req.isAdmin est faux
    │   └── requireUid.js           # 400 si req.uid est absent
    └── routes/
        ├── whoami.js               # Diagnostic (confirme comment l'auth a résolu la requête)
        ├── exercices.js            # /api/exercices — lecture publique, écriture réservée admin
        ├── seances.js              # /api/seances — génération/recalcul publics, CRUD des séances personnelles réservé à un uid résolu
        └── ia.js                   # /api/ia — generer-seance public, interpreter-exercices réservé admin
```

## Architecture front/backend

Le front est une pure couche d'interface : il affiche, collecte les entrées utilisateur, et
délègue toute décision métier au backend via `ApiClient` (`fetch` + Bearer token Firebase ID
attaché automatiquement si l'utilisateur est connecté). Aucune règle métier ne doit être
dupliquée ou réinventée côté front au-delà de ce qui est documenté ci-dessous.

- `ApiClient.get/post/put/delete(chemin, corps?)` : sérialise le JSON, attache
  `Authorization: Bearer <idToken>` si un utilisateur Firebase est connecté, et remonte une erreur
  exploitable (`erreur` renvoyé par le backend si présent, sinon `Erreur serveur (<status>)`).
- Le backend (`backend/src/middleware/auth.js`) résout **qui appelle** sans jamais bloquer à ce
  stade — plusieurs routes restent utilisables sans compte (lecture de la bibliothèque,
  génération de séance, IA "Décris ta séance"), comme avant la migration. Ce sont les middlewares
  `requireAdmin`/`requireUid`, posés route par route, qui imposent une exigence précise :
  - `requireAdmin` : `req.isAdmin` (email Firebase comparé à `ADMIN_EMAIL`, **côté serveur**,
    jamais fourni par le client) — écriture sur la bibliothèque d'exercices, fiche exercice via IA.
  - `requireUid` : `req.uid` résolu — lecture/écriture des séances personnelles.
  - Un **bearer statique** (`STATIC_API_TOKEN`, secret serveur) donne un accès admin complet sans
    passer par un vrai login Firebase, pensé pour tester l'API via Postman ; l'en-tête `X-Test-Uid`
    permet alors de se placer dans le contexte d'un utilisateur donné pour les routes
    `/api/seances` (ignoré avec toute autre forme d'authentification).
- **CORS** : `CORS_ALLOWED_ORIGIN` (variable d'env backend) liste les origines autorisées
  (domaine Firebase Hosting + localhost de dev) ; une requête sans en-tête `Origin` (Postman, curl,
  serveur-à-serveur) est toujours autorisée.

## Modèle de domaine

Un **Exercice** appartient à un **groupe musculaire**, nécessite éventuellement du **matériel**, et a un
**niveau** de difficulté. Il porte toujours **deux valeurs par défaut** (répétitions et durée), pour
pouvoir être exprimé dans l'un ou l'autre mode selon les critères de génération de la séance.

Une **Seance** est générée à partir de **critères** (durée souhaitée, groupes musculaires ciblés, matériel
disponible, niveau, repos entre séries, repos entre exercices, préférence répétitions/durée, enchaînement
automatique) : elle contient une liste de **blocs** (exercice + nombre de séries + valeur d'effort + temps
de repos) dont la durée totale estimée approche la durée demandée. Chaque bloc distingue deux temps de
repos : `reposSecondes` (entre les séries d'un même exercice) et `reposApresSecondes` (après le dernier
exercice, avant de passer au suivant). Les valeurs de chaque bloc (séries, valeur, les deux repos) peuvent
être ajustées manuellement exercice par exercice sur `generateur.html` avant l'enregistrement, et de la
même façon en modification sur `mes-seances.html`.

- `Exercice` — `id`, `nom`, `groupeMusculaire`, `materiel[]`, `niveau` (debutant|intermediaire|avance),
  `valeurDefautRepetitions`, `valeurDefautDuree`, `description`, `instructions`, `image`.
  `Exercice.fromFirestore()` (backend uniquement — seul le backend lit Firestore désormais) reste
  rétrocompatible avec l'ancien format (`type`+`valeurDefaut` uniques) en dérivant la valeur manquante
  via `SECONDES_PAR_REPETITION`. Le front reçoit toujours la forme déjà normalisée (`new Exercice(data)`
  suffit, pas besoin de refaire la conversion).
- `Seance` — `id`, `date`, `nom`, `criteres`, `blocs[]`
  (`{ exercice, series, valeur, type, reposSecondes, reposApresSecondes }`), `dureeEstimeeMinutes`
- `GenerateurSeance.filtrerExercices(exercices, criteres)` (backend uniquement, `backend/src/domain/`)
  — filtre par niveau (un niveau donné inclut les niveaux plus faciles), groupe musculaire (vide = tous)
  et matériel (un exercice sans matériel passe toujours ; sinon tout le matériel requis doit être
  disponible)
- `GenerateurSeance.genererSeance(exercices, criteres)` (backend uniquement) — mélange les exercices
  éligibles et pioche des blocs (3 séries ; repos entre séries, repos entre exercices et type/valeur
  pilotés par `criteres.reposEntreSeriesSecondes` / `criteres.reposEntreExercicesSecondes` /
  `criteres.preferenceType` / `criteres.enchainementAutomatique`, avec repli à 30s / 60s si absents)
  jusqu'à approcher la durée cible. Exposée au front via `POST /api/seances/generer`
  (`public/services/SeanceService.js`).
- `GenerateurSeance.calculerDureeEstimeeMinutes(blocs)` (dupliquée front **et** backend, voir
  "Répartition front/backend de la génération" ci-dessous) — recalcule la durée totale à partir de
  blocs déjà construits, réutilisé après une édition manuelle d'un bloc
- `ExecutionSeance.construireEtapes(seance)` (front uniquement, `public/utils/`) — aplatit tous les
  blocs × séries d'une séance en une liste d'étapes séquentielles (effort/repos, automatique ou manuel),
  pour piloter `execution.html` ; c'est de l'orchestration d'affichage sur des données déjà décidées,
  pas une décision métier, donc reste côté front

### Répartition front/backend de la génération

`utils/GenerateurSeance.js` existe des deux côtés mais avec un contenu différent :

- **Backend** (`backend/src/domain/GenerateurSeance.js`) : version complète — `filtrerExercices()`,
  `genererSeance()` (la vraie décision métier : quels exercices choisir, dans quel ordre, avec quelles
  valeurs) et `calculerDureeEstimeeMinutes()`. C'est la seule source de vérité pour "que contient une
  séance".
- **Front** (`public/utils/GenerateurSeance.js`) : uniquement `calculerDureeEstimeeMinutes()` (+ les
  constantes `SERIES_PAR_EXERCICE`/`REPOS_ENTRE_SERIES` utilisées comme valeurs par défaut à l'ajout
  manuel d'un exercice). Ce recalcul reste **local et synchrone**, appelé à chaque frappe clavier ou
  réordonnancement pendant l'édition d'un bloc sur `generateur.html`/`mes-seances.html` — un aller-retour
  réseau par interaction casserait l'UX. C'est un choix assumé : le recalcul est une simple somme
  arithmétique d'affichage, pas une décision métier, donc la duplication est acceptée ici alors que la
  génération elle-même (`genererSeance`) est exclusivement backend.

Deux stratégies de génération coexistent côté backend, toutes deux exclusivement backend et toutes
deux exposées via `public/services/SeanceService.js` : `genererSeance()` (tirage aléatoire parmi
les exercices filtrés par critères manuels, `POST /api/seances/generer`) et
`InterpreterSeanceIA.validerSeanceIA()` (sélection directe par l'IA à partir d'une description en
langage naturel, `POST /api/ia/generer-seance` — voir "Assistant IA" plus bas). Le front choisit
laquelle appeler selon le bouton cliqué ("Générer ma séance" vs "Générer avec l'IA"), mais ne
décide jamais lui-même du contenu de la séance dans les deux cas.

## Architecture SOLID

| Principe | Implémentation |
|----------|----------------|
| **SRP** | `backend/src/domain/GenerateurSeance.js` ne fait que de la génération pure ; `ExerciceRepository`/`SeanceRepository` seule frontière Firestore ; le front n'a aucune logique métier, seulement de l'UI + `ApiClient` |
| **OCP** | Ajouter un critère de filtrage ne modifie pas la signature de `genererSeance()` |
| **DIP** | `backend/src/domain/**` n'importe ni Express ni Firestore — il reçoit ses données en paramètre ; `public/utils/GenerateurSeance.js` n'importe ni Firebase ni `ApiClient` |

## Format du fichier d'import d'exercices (JSON)

```json
{
  "exercices": [
    {
      "nom": "Pompes",
      "groupeMusculaire": "pectoraux",
      "materiel": [],
      "niveau": "debutant",
      "valeurDefautRepetitions": 12,
      "valeurDefautDuree": 36,
      "description": "Exercice de poussée au poids du corps.",
      "instructions": "Mains légèrement plus larges que les épaules..."
    }
  ]
}
```

Champs requis à l'import (`admin.html`, un appel à `POST /api/exercices` par exercice) : `nom` et
`groupeMusculaire` (valeur valide). Les autres champs ont une valeur par défaut sûre si absents.

Groupes musculaires valides (`GROUPES_MUSCULAIRES`, taxonomie fine par muscle plutôt que par zone
large) : `quadriceps`, `ischio-jambiers`, `fessiers`, `mollets`, `dorsaux`, `lombaires`, `trapezes`,
`pectoraux`, `epaules`, `biceps`, `triceps`, `avant-bras`, `abdominaux`, `obliques`, `cardio`,
`full-body`.
Niveaux valides : `debutant`, `intermediaire`, `avance`.

## Modèle de données Firestore (backend uniquement)

Firestore n'est plus accédé que par le backend (`firebase-admin`, Admin SDK) — le front n'a plus
aucune dépendance au SDK Firestore, ni aux règles de sécurité Firestore (celles-ci peuvent d'ailleurs
être fermées à tout accès client direct, puisque seul l'Admin SDK — qui les contourne — y accède).

### Collection `exercices` — bibliothèque partagée

```json
{
  "nom": "Pompes",
  "groupeMusculaire": "pectoraux",
  "materiel": [],
  "niveau": "debutant",
  "valeurDefautRepetitions": 12,
  "valeurDefautDuree": 36,
  "description": "...",
  "instructions": "...",
  "image": ""
}
```

### Sous-collection `joueurs/{uid}/seances` — séances d'un utilisateur connecté

```json
{
  "date": "ISO string",
  "nom": "Séance jambes du lundi",
  "criteres": {
    "dureeMinutes": 20, "groupesMusculaires": [], "materielDisponible": [], "niveau": "intermediaire",
    "reposEntreSeriesSecondes": 30, "reposEntreExercicesSecondes": 60,
    "preferenceType": "repetitions", "enchainementAutomatique": false
  },
  "dureeEstimeeMinutes": 22,
  "blocs": [
    { "exerciceId": "abc123", "nom": "Pompes", "series": 3, "valeur": 12, "type": "repetitions", "reposSecondes": 30, "reposApresSecondes": 60 }
  ]
}
```

Une séance peut être relancée depuis `mes-seances.html` (bouton "▶ Lancer") : elle est transmise à
`execution.html` via `sessionStorage` (pas de nouvelle requête réseau). L'écran d'exécution est
éphémère : il ne persiste aucun résultat de fin de séance.

Pour un utilisateur anonyme, la même structure est stockée dans `localStorage['hf_historique']`
(30 séances max — la clé de stockage garde son nom d'origine, volontairement inchangé pour ne pas
perdre les séances déjà enregistrées localement chez les utilisateurs existants).
`MesSeancesService` est une façade transparente : les pages n'ont pas à connaître le mode de
stockage (localStorage ou `/api/seances`). Lors de la première connexion sur un device,
`MesSeancesService.migrerDepuisLocalStorage()` importe les séances locales dans Firestore via
`POST /api/seances` — sans paramètre d'uid : le backend le dérive lui-même du token Firebase
vérifié, jamais d'une valeur fournie par le client.

`mes-seances.html` propose aussi un export/import JSON des séances (même pattern que
l'import/export d'exercices dans `admin.html`) : export via `seance.toFirestore()`, import via
`Seance.fromFirestore(null, item)` puis `MesSeancesService.ajouter()` (crée toujours de
nouvelles entrées, jamais de mise à jour par id). Seule validation : chaque séance importée doit
avoir un tableau `blocs` non vide ; la durée estimée est toujours recalculée
(`calculerDureeEstimeeMinutes`) plutôt que de faire confiance à la valeur du fichier importé.

## Assistant IA (description en langage naturel → séance générée ou fiche exercice)

Deux usages de l'API Gemini (niveau gratuit, sans carte bancaire), tous deux conçus sur le même
principe : **l'IA ne choisit/n'écrit jamais rien directement dans Firestore**, elle ne fait que
pré-remplir un résultat (séance générée, fiche exercice) que l'utilisateur relit et valide
lui-même avant enregistrement.

- Sur `generateur.html` ("Décris ta séance") : un seul appel (`SeanceService.genererParIA()`) où
  l'IA choisit **directement** dans la bibliothèque d'exercices (fournie dans le prompt, publique
  via `GET /api/exercices`) ceux qui correspondent le mieux à la description, et détermine
  elle-même la durée et les temps de repos (par bloc, pas seulement une valeur globale) — pas
  d'étape intermédiaire de pré-remplissage de critères suivie d'un tirage aléatoire : la séance
  complète est renvoyée et affichée directement, éditable comme toute séance générée avant
  enregistrement.
- Sur `admin.html` ("Proposer des exercices par IA") : convertit une description en **une ou
  plusieurs** fiches `Exercice` (un exercice unique, ou tout un programme — ex. objectif de
  rééducation). L'IA reçoit le catalogue déjà existant et détecte les doublons plutôt que de
  proposer un exercice qui ressemble à un exercice déjà présent. Le résultat est affiché en deux
  groupes, chacun éditable avant validation :
  - **Nouveaux exercices** : une carte par proposition, bouton "➕ Ajouter" individuel ou
    "✅ Tout ajouter" en masse.
  - **Exercices existants concernés** : une carte par match, pré-remplie avec la suggestion de
    l'IA, bouton "💾 Enregistrer" autonome par carte (pas de passage par le formulaire principal).

  `description`/`instructions` sont **obligatoires** dans le schéma Gemini et le prompt exige un
  niveau de détail concret (muscle ciblé + effet recherché + précaution éventuelle pour la
  description ; position de départ + mouvement + point de vigilance pour les instructions) — un
  champ vide ou vague n'est pas acceptable pour une fiche écrite dans la bibliothèque partagée.

**Répartition front/backend** :

- `public/services/SeanceService.js` (`genererParIA()`) et `public/services/GeminiService.js`
  (`interpreterExercices()`) : appellent respectivement `POST /api/ia/generer-seance` et
  `POST /api/ia/interpreter-exercices` via `ApiClient` — aucune logique, aucune clé, aucun appel
  réseau direct vers Gemini, aucune liste d'exercices à assembler côté front (le backend la
  récupère lui-même via `ExerciceRepository`).
- `backend/src/domain/InterpreterSeanceIA.js` : construit le prompt (description + catalogue
  complet id/nom/groupe/niveau/matériel) et le schéma de sortie JSON forcé — `exerciceId` y est
  contraint à un **enum des ids réellement disponibles**, ce qui élimine à la source le risque
  qu'un exercice halluciné soit choisi (defense in depth : `validerSeanceIA()` revérifie quand même
  chaque id après coup, ne fait jamais confiance aveuglément à la sortie du modèle, et rejette
  silencieusement tout bloc dont l'id ne correspond à aucun exercice fourni). Si l'IA ne
  sélectionne finalement aucun exercice valide, l'appel échoue explicitement (message clair côté
  front) plutôt que de renvoyer une séance vide. Réutilise `validerCriteresIA()`
  (`InterpreterDemandeIA.js`) pour la partie critères (résumé de la séance, utilisé comme défauts
  si l'utilisateur ajoute un exercice manuellement ensuite). Logique pure, testée sans réseau
  (`backend/tests/InterpreterSeanceIA.test.js`).
- `backend/src/domain/InterpreterExerciceIA.js` : même principe de schéma forcé + validation sans
  confiance aveugle, mais pour un **tableau** de propositions plutôt qu'une fiche unique.
  `construireRequeteExercicesIA(description, exercicesDisponibles)` fournit le catalogue existant
  dans le prompt (réutilise `formaterCatalogue()`, exporté par `InterpreterSeanceIA.js` — même
  format `id | nom | groupe | niveau | matériel`) et contraint `exerciceExistantId` via `enum` aux
  ids réellement disponibles **+ le sentinel `"nouveau"`** — Gemini rejette un `enum` contenant une
  chaîne vide (`"cannot be empty"`), d'où ce sentinel plutôt que `""`. `validerExercicesIA(brut,
  exercicesDisponibles)` résout chaque `exerciceExistantId` par recherche dans le catalogue (un id
  halluciné ou absent retombe simplement en "nouveau", sans erreur) et sépare le résultat en
  `{ nouveaux, existants }`. Contrairement à la fiche unique d'avant : un item individuellement
  invalide (nom/groupeMusculaire) est **ignoré silencieusement** plutôt que de faire échouer tout le
  lot (même règle que l'import JSON) — l'appel n'échoue que si **aucune** proposition n'est
  exploitable. Logique pure, testée sans réseau (`backend/tests/InterpreterExerciceIA.test.js`).
- `backend/src/services/GeminiClient.js` : seul point d'appel réseau (`fetch` vers
  `generativelanguage.googleapis.com`, factorisé dans une fonction privée `appelerGemini()` commune
  à tous les usages). `GEMINI_API_KEY`/`GEMINI_MODEL` sont des variables d'environnement **serveur**
  (`backend/.env`) — jamais envoyées au navigateur, contrairement à l'ancienne implémentation
  client-side restreinte uniquement par référent HTTP.
- Routes : `POST /api/ia/generer-seance` (publique, comme la génération de séance manuelle qu'elle
  remplace pour ce cas d'usage) et `POST /api/ia/interpreter-exercices` (réservée à `requireAdmin`,
  puisqu'elle écrit potentiellement dans la bibliothèque partagée — une bibliothèque vide n'est pas
  une erreur ici, contrairement à `/generer-seance` : tout revient simplement en "nouveaux").

**Churn des modèles** : Google retire ses modèles gratuits assez vite et parfois sans préavis (vécu
en juillet 2026 avec `gemini-2.5-flash-lite` puis `gemini-3-flash`, coupés du jour au lendemain).
`GEMINI_MODEL` (dans `backend/.env`) pointe donc vers `gemini-flash-lite-latest` — un **alias**
maintenu par Google (pas une version datée) qui suit automatiquement son modèle flash-lite gratuit
courant, pour ne plus avoir à mettre cette valeur à jour à chaque dépréciation. Si l'IA renvoie
malgré tout une erreur 404 "model not found", `GeminiClient.js` l'indique explicitement dans le
message d'erreur remonté au front : lister les modèles réellement disponibles pour la clé avec
`GET https://generativelanguage.googleapis.com/v1beta/models?key=TA_CLE` (l'endpoint `ListModels`)
plutôt que de se fier à la documentation ou à une recherche web, qui datent vite sur ce sujet.

## Gestion des utilisateurs

Identique au principe utilisé dans quizz-battle : anonyme via UUID/localStorage, connecté via Firebase
Auth (email + mot de passe, ou Google), entièrement côté front (le backend ne fait que vérifier le
token ID Firebase, il ne gère aucune session). `admin.html` restreint l'accès à l'email défini dans
`auth-config.js` (`ADMIN_EMAIL`) côté front (pour masquer/rediriger l'UI) **et** dans `ADMIN_EMAIL`
côté backend (pour réellement bloquer les routes `requireAdmin` — la vérification qui compte est
toujours côté serveur, jamais fournie par le client).

## Conventions de code

- Français pour les variables, commentaires et textes UI
- Pas de framework CSS externe (styles custom dans `style.css`)
- Pas de build step, ni front ni backend : les fichiers sont déployés tels quels
- Le front ne contient **aucune logique métier** (sélection/génération d'exercices, accès aux
  données, appel IA) — uniquement de l'interface et des appels à `services/ApiClient.js`. Toute
  règle de décision vit dans `backend/src/domain/` ou `backend/src/repositories/`.
- La logique pure encore présente côté front (`utils/GenerateurSeance.js` pour le recalcul de durée,
  `utils/ExecutionSeance.js`) ne doit jamais importer Firebase ni `ApiClient` — elle doit rester
  testable sans dépendance externe
- Côté backend, `src/domain/**` ne doit jamais importer Express, `firebase-admin`, ni aucun module
  réseau — il reçoit ses données en paramètre et reste testable sans serveur ni Firestore

## Tests automatisés

```bash
npm test          # mode watch (développement), à la racine (front) ou dans backend/
npm run test:run  # one-shot (CI)
```

```
tests/                                # Front — logique encore pure côté navigateur
├── GenerateurSeance.test.js            # calculerDureeEstimeeMinutes (recalcul local, voir plus haut)
└── ExecutionSeance.test.js             # construireEtapes (aplatissement blocs × séries, auto vs manuel, repos)

backend/tests/                        # Backend — toute la logique métier
├── GenerateurSeance.test.js            # filtrerExercices, genererSeance, calculerDureeEstimeeMinutes
├── InterpreterDemandeIA.test.js        # validerCriteresIA (jamais confiance à la sortie IA)
├── InterpreterSeanceIA.test.js         # construireRequeteSeanceIA, validerSeanceIA (ignore les ids hallucinés, échoue si aucun bloc valide)
└── InterpreterExerciceIA.test.js       # construireRequeteExercicesIA, validerExercicesIA (détection de doublons, item invalide ignoré sans faire échouer le lot)
```

`npm run test:run` lancé à la racine exécute aussi `backend/tests/` (Vitest scanne tout le repo).

**Duplication assumée** : `backend/src/domain/{Exercice,Seance,constantes,GenerateurSeance}.js` sont
des copies des classes/pure functions front équivalentes (pas de package partagé / monorepo mis en
place). C'est un choix délibéré, pas un oubli — ne pas "corriger" en faisant importer au backend des
fichiers sous `public/`, ni l'inverse. Si la logique de génération évolue, le changement doit être
répercuté **des deux côtés** ; chaque copie a ses propres tests pour détecter une divergence.

**Règle** : toute nouvelle règle de génération ou de filtrage doit être couverte par un test avant d'être
mergée. Ne pas mocker `Math.random` — préférer des assertions sur l'ensemble des valeurs possibles.

## Configuration initiale (à faire avant le premier lancement)

### Firebase (projet commun front + backend)

1. Créer un projet sur [console.firebase.google.com](https://console.firebase.google.com)
2. Activer **Firestore Database** et **Authentication** (méthode Email/mot de passe, + Google si besoin)
3. Générer une clé de compte de service : Console Firebase → Paramètres du projet → Comptes de
   service → Générer une nouvelle clé privée (JSON) — nécessaire pour le backend uniquement

### Frontend (`public/`)

4. Copier `public/firebase-config.example.js` en `public/firebase-config.js` et renseigner la config
   du projet (sert uniquement à Firebase Auth désormais)
5. Copier `public/api-config.example.js` en `public/api-config.js` et renseigner l'URL du backend
   (`http://localhost:3000` en développement local)
6. Renseigner `public/auth-config.js` (`ADMIN_EMAIL`) avec l'email qui pourra importer des exercices
7. `firebase use --add` pour lier le projet local au projet Firebase créé

### Backend (`backend/`)

8. `cd backend && npm install`
9. Copier `backend/.env.example` en `backend/.env` et renseigner :
   - `FIREBASE_SERVICE_ACCOUNT_JSON` : le JSON de l'étape 3, sur une seule ligne
   - `ADMIN_EMAIL` : le même email qu'à l'étape 6
   - `CORS_ALLOWED_ORIGIN` : `http://localhost:5000,<domaine Firebase Hosting>`
   - `GEMINI_API_KEY`/`GEMINI_MODEL` *(optionnel, assistant IA)* : créer une clé sur
     [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — cette clé n'a plus besoin
     d'être restreinte par référent HTTP puisqu'elle ne quitte jamais le serveur
   - `STATIC_API_TOKEN` *(optionnel)* : secret généré une fois (`openssl rand -hex 32`) pour tester
     l'API via Postman sans passer par un vrai login Firebase
10. `npm run dev` pour démarrer le backend en local (port `PORT`, 3000 par défaut)

### Données

11. Importer `exemple/exercices-exemple.json` via `admin.html` pour peupler la bibliothèque

## Déploiement

Front et backend se déploient indépendamment.

```bash
# Frontend
firebase deploy

# Backend (ex. Render Web Service) : déployer backend/ avec les variables d'environnement de
# backend/.env.example renseignées côté hébergeur, puis mettre à jour public/api-config.js
# (production) avec l'URL réelle du backend déployé, et CORS_ALLOWED_ORIGIN côté backend avec le
# domaine Firebase Hosting réel.
```

---

## Roadmap

### ✅ Étape 1 — MVP Générateur de séances
- Modèle de domaine `Exercice` / `Seance` + génération pure testée
- Formulaire de critères (durée, groupes musculaires, matériel, niveau) → séance affichée
- Bibliothèque d'exercices en lecture (`exercices.html`) + import admin (`admin.html`)
- Comptes utilisateurs (Firebase Auth) + séances enregistrées (Firestore ou localStorage)

### ✅ Étape 2 — Exécution guidée de la séance (partielle)
- Écran d'exécution avec minuteur par exercice/série, décompte du repos, passage automatique au suivant
  (`execution.html`, lancé depuis `mes-seances.html`)
- 🔜 Marquer une séance comme "terminée" avec les valeurs réellement effectuées (non fait, volontairement
  hors scope de cette itération — l'écran d'exécution actuel est éphémère, sans persistance)

### ✅ Étape 3 — Séparation frontend / backend
- Backend Node/Express (`backend/`) : seul point d'accès à Firestore (Admin SDK) et à l'API Gemini
- Front migré vers `services/ApiClient.js` pour tout accès aux données et à l'IA — plus aucun import
  Firestore ni Gemini côté navigateur
- Génération de séance (`genererSeance`) déplacée côté backend comme décision métier ; le recalcul de
  durée pendant l'édition manuelle d'un bloc reste local pour la réactivité de l'UI
- Code mort de l'ancienne implémentation 100 % statique supprimé (anciens `utils/InterpreterDemandeIA.js`
  / `InterpreterExerciceIA.js` côté front, `gemini-config.js`)

### ✅ Étape 3.1 — Génération de séance par IA à sélection directe
- "Décris ta séance" ne se contente plus de déduire des critères généraux suivis d'un tirage
  aléatoire : l'IA choisit désormais directement les exercices adaptés dans la bibliothèque
  (`POST /api/ia/generer-seance`, `backend/src/domain/InterpreterSeanceIA.js`), et détermine
  elle-même la durée et les temps de repos par bloc, en un seul appel
- Ancienne route `POST /api/ia/interpreter-demande` (critères seuls, sans sélection d'exercices)
  supprimée avec ce changement, devenue inutilisée

### ✅ Étape 3.2 — Ajout d'exercices par IA en masse, avec détection de doublons
- `admin.html` ("Proposer des exercices par IA") accepte une description couvrant 1 à N exercices
  (ex. un objectif de rééducation) ; l'IA compare à la bibliothèque existante et distingue les
  nouveaux exercices (ajout individuel ou en masse) des exercices déjà présents qu'elle propose de
  mettre à jour (carte autonome, éditable, avec son propre bouton "Enregistrer")
- `description`/`instructions` rendus obligatoires et exigés "aussi précis que possible" dans le
  prompt (muscle ciblé, effet recherché, précaution, pas-à-pas exécutable) — un champ vide ou vague
  n'est plus acceptable pour une fiche écrite dans la bibliothèque partagée
- Ancienne route `POST /api/ia/interpreter-exercice` (fiche unique) remplacée par
  `POST /api/ia/interpreter-exercices` (tableau, détection de doublons)

### ✅ Étape 3.3 — Renommage "historique" → "séances" pour un nom de composant cohérent
- Terme affiché à l'utilisateur harmonisé partout ("Mes séances" au lieu de "Mon historique")
- `historique.html` renommé en `mes-seances.html`, `HistoriqueSeanceService` renommé en
  `MesSeancesService` (fichier, classe, ids DOM/variables associés, nom du fichier exporté) pour
  que le nom des composants reflète le terme utilisateur
- Clé `localStorage['hf_historique']` **volontairement conservée telle quelle** : ce n'est pas
  qu'un nom de code, la renommer aurait fait perdre l'accès aux séances déjà enregistrées
  localement par les utilisateurs anonymes existants

### 🔜 Étape 4 — Suivi de progression
- Statistiques par exercice (progression du nombre de reps/temps dans la durée)
- Graphique de fréquence des séances (jours actifs, streak)

### 🔜 Étape 5 — Fonctionnalités transverses
- Images/gifs de démonstration par exercice
- Favoris / séances personnalisées sauvegardées comme modèles réutilisables

---

> Ce fichier est destiné à guider Claude Code. Il doit être mis à jour à chaque évolution significative du projet.
