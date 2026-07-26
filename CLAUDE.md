# HomeFit

Générateur de séances de sport à la maison.

## Documentation

Ce fichier documente l'architecture et les décisions. Pour aller plus loin :
- [`GOOGLE.md`](GOOGLE.md) — configuration des comptes/services Google (Firebase, Cloud Run, Gemini)
- [`docs/backend/README.md`](docs/backend/README.md) — diagramme de classes, diagramme de
  séquence et tableau des routes du backend
- [`docs/frontend/README.md`](docs/frontend/README.md) — diagramme de classes, diagramme de
  séquence et tableau des pages du frontend
- [`docs/postman/README.md`](docs/postman/README.md) — guide de test manuel de l'API (+ collection
  `HomeFit.postman_collection.json` prête à importer)

## Stack technique

- **Frontend** : Vanilla HTML/CSS/JS (pas de framework, pas de bundler), déployé sur Firebase
  Hosting (`public/` est la racine servie). Ne parle **plus jamais** directement à Firestore ni à
  l'API Gemini — uniquement à Firebase Auth (connexion) et au backend (tout le reste), via
  `services/ApiClient.js`.
- **Backend** : Node/Express (`backend/`), seul point d'accès à Cloud Firestore (via
  `firebase-admin`, Admin SDK) et à l'API Gemini (clé serveur, jamais exposée au navigateur).
  Contient toute la **logique métier** : sélection/génération des exercices d'une séance, accès
  aux données, appel IA. Déployé indépendamment du front sur **Cloud Run** (même projet GCP que
  Firebase — configuration complète dans `GOOGLE.md`).
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
├── admin-images.html          # Sous-page admin : images Storage orphelines (sans exercice associé), suppression individuelle/en masse
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
    ├── firebaseAdmin.js         # Init firebase-admin (Firestore, Storage, vérification des tokens Auth)
    ├── domain/                  # Logique pure — copie du domaine front (voir "Modèle de domaine")
    │   ├── constantes.js, Exercice.js, Seance.js
    │   ├── GenerateurSeance.js    # filtrerExercices() + genererSeance() — la vraie décision métier
    │   ├── InterpreterDemandeIA.js  # validerCriteresIA() — réutilisé par InterpreterSeanceIA.js
    │   ├── InterpreterSeanceIA.js   # génération de séance par IA (sélection directe des exercices)
    │   ├── InterpreterExerciceIA.js # construction/validation de la requête Gemini (fiche exercice)
    │   ├── InterpreterImageExerciceIA.js # construction de la requête Gemini (illustration d'exercice)
    ├── repositories/
    │   ├── ExerciceRepository.js  # Accès Firestore (collection `exercices`) via l'Admin SDK
    │   ├── SeanceRepository.js    # Accès Firestore (sous-collection `joueurs/{uid}/seances`)
    │   └── ImageRepository.js     # Accès Firebase Storage (illustrations d'exercice) via l'Admin SDK
    ├── services/
    │   └── GeminiClient.js        # Appel réseau vers l'API Gemini (clé côté serveur uniquement)
    ├── middleware/
    │   ├── auth.js                # Résout req.uid/req.isAdmin (token Firebase ou bearer statique de test)
    │   ├── requireAdmin.js         # 403 si req.isAdmin est faux
    │   └── requireUid.js           # 400 si req.uid est absent
    └── routes/
        ├── whoami.js               # Diagnostic (confirme comment l'auth a résolu la requête)
        ├── exercices.js            # /api/exercices — lecture publique, écriture + image réservées admin
        ├── seances.js              # /api/seances — génération/recalcul publics, CRUD des séances personnelles réservé à un uid résolu
        └── ia.js                   # /api/ia — generer-seance public, interpreter-exercices/generer-image-exercice réservés admin
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

## Assistant IA (description en langage naturel → séance générée, fiche exercice ou illustration)

Trois usages de l'API Gemini (niveau gratuit, sans carte bancaire), conçus sur le même principe :
**l'IA ne choisit/n'écrit jamais rien directement dans Firestore**, elle ne fait que pré-remplir un
résultat (séance générée, fiche exercice, illustration) que l'utilisateur relit et valide lui-même
avant enregistrement — à l'exception de la génération d'illustration (voir plus bas), qui écrit
directement le résultat sur un exercice déjà enregistré, l'admin pouvant régénérer ou supprimer s'il
n'est pas satisfait.

- Sur `generateur.html` ("Décris ta séance") : un seul appel côté front (`SeanceService.genererParIA()`,
  `POST /api/ia/generer-seance`) où l'IA choisit **directement** dans la bibliothèque d'exercices
  ceux qui correspondent le mieux à la description, et détermine elle-même la durée et les temps de
  repos (par bloc, pas seulement une valeur globale) — la séance complète est renvoyée et affichée
  directement, éditable comme toute séance générée avant enregistrement. Côté backend, cet unique
  appel HTTP orchestre en réalité **deux appels Gemini** (voir "Répartition front/backend"
  ci-dessous et Étape 3.5) : un préfiltre léger de la bibliothèque, puis le choix final des
  exercices — transparent pour le front, qui ne voit toujours qu'un aller-retour.
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
- Sur `admin.html`, en édition d'un exercice ("🖼️ Générer par IA") : génère une illustration
  (image, pas du JSON) à partir d'un gabarit de prompt fixe (grille 3x3 d'étapes du mouvement, style
  3D vectoriel épuré, groupe musculaire ciblé en rouge) complété par le nom et la description de
  l'exercice. Contrairement aux deux usages ci-dessus, disponible **uniquement sur un exercice déjà
  enregistré** (le chemin de stockage dérive de son id Firestore, voir "Modèle de données Firestore")
  — pas au moment de la création initiale. Une image peut aussi être ajoutée manuellement ("📷
  Choisir une image", upload direct, même stockage) sans passer par l'IA.

**Répartition front/backend** :

- `public/services/SeanceService.js` (`genererParIA()`) et `public/services/GeminiService.js`
  (`interpreterExercices()`) : appellent respectivement `POST /api/ia/generer-seance` et
  `POST /api/ia/interpreter-exercices` via `ApiClient` — aucune logique, aucune clé, aucun appel
  réseau direct vers Gemini, aucune liste d'exercices à assembler côté front (le backend la
  récupère lui-même via `ExerciceRepository`).
- `backend/src/domain/InterpreterSeanceIA.js` : deux constructeurs de requête Gemini, appelés en
  séquence par `GeminiClient.genererSeanceParIA()` (voir Étape 3.5) —
  `construireRequeteCriteresIA(description)` (léger, sans catalogue) déduit des critères
  provisoires, utilisés uniquement pour présélectionner la bibliothèque (`filtrerExercices`,
  `backend/src/domain/GenerateurSeance.js`) avant `construireRequeteSeanceIA(description,
  exercicesFiltres)`, qui choisit les exercices dans cette liste réduite (catalogue référencé par
  **index court** plutôt que par id Firestore, pour limiter les tokens). **Aucun `enum`** sur le
  champ référençant l'exercice (`exerciceId`, toujours **STRING**, jamais INTEGER) : mesuré
  empiriquement contre l'API réelle que contraindre ce champ par un `enum` (au-delà d'une
  cinquantaine de valeurs) ou le typer en INTEGER fait dériver ce modèle vers une génération
  dégénérée d'une façon quasi systématique — `validerSeanceIA()` reste donc la seule ligne de
  défense contre un index halluciné ou hors bornes (jamais confiance aveugle dans la sortie du
  modèle). Si l'IA ne sélectionne finalement aucun exercice valide, l'appel échoue explicitement
  (message clair côté front) plutôt que de renvoyer une séance vide. Réutilise `validerCriteresIA()`
  (`InterpreterDemandeIA.js`) pour valider les critères des deux appels. Logique pure, testée sans
  réseau (`backend/tests/InterpreterSeanceIA.test.js`).
- `backend/src/domain/InterpreterExerciceIA.js` : même principe de schéma forcé + validation sans
  confiance aveugle, mais pour un **tableau** de propositions plutôt qu'une fiche unique.
  `construireRequeteExercicesIA(description, exercicesDisponibles)` fournit le catalogue existant
  dans le prompt (réutilise `formaterCatalogue()`, exporté par `InterpreterSeanceIA.js` — même
  format `id | nom | groupe | niveau | matériel`, avec les ids réels cette fois, sans index court).
  `exerciceExistantId` reste volontairement **STRING libre, sans `enum`** (même raison que
  `exerciceId` dans `InterpreterSeanceIA.js` ci-dessus) ; le prompt utilise le sentinel `"nouveau"`
  pour signaler un exercice à créer plutôt qu'une chaîne vide. `validerExercicesIA(brut,
  exercicesDisponibles)` résout chaque `exerciceExistantId` par recherche dans le catalogue (un id
  halluciné ou absent retombe simplement en "nouveau", sans erreur) et sépare le résultat en
  `{ nouveaux, existants }`. Contrairement à la fiche unique d'avant : un item individuellement
  invalide (nom/groupeMusculaire) est **ignoré silencieusement** plutôt que de faire échouer tout le
  lot (même règle que l'import JSON) — l'appel n'échoue que si **aucune** proposition n'est
  exploitable. Logique pure, testée sans réseau (`backend/tests/InterpreterExerciceIA.test.js`).
- `backend/src/domain/InterpreterImageExerciceIA.js` : une seule fonction,
  `construireRequeteImageExerciceIA(nom, description)`, concatène le gabarit de prompt fixe avec le
  nom/la description de l'exercice. Pas de `responseSchema`/`responseMimeType` (sortie image, pas
  JSON textuel) donc pas de fonction de validation associée — rien à valider structurellement, juste
  des octets bruts. Logique pure, testée sans réseau
  (`backend/tests/InterpreterImageExerciceIA.test.js`).
- `backend/src/repositories/ImageRepository.js` : accès Firebase Storage (Admin SDK) — chemin
  `exercices/<id>.<ext>` dérivé de l'id Firestore de l'exercice (stable, jamais de collision,
  contrairement à un nommage par nom d'exercice qui orphelinerait un fichier au moindre renommage).
  `televerser(id, base64, mimeType)` purge systématiquement l'image précédente avant d'écrire (une
  régénération peut changer d'extension), puis rend le fichier public (`makePublic()`) et renvoie son
  URL `storage.googleapis.com` — pas d'URL signée : les illustrations sont déjà au même niveau de
  confidentialité que le reste de la bibliothèque (`GET /api/exercices`, public), une URL signée
  expirerait sans job de renouvellement pour la renouveler.
- `backend/src/services/GeminiClient.js` : seul point d'appel réseau (`fetch` vers
  `generativelanguage.googleapis.com`, factorisé dans une fonction privée `appelerModeleUneFois()`
  commune à tous les usages, y compris l'image — seule la façon d'extraire le résultat des `parts`
  de la réponse diffère : `parts[0].text` à parser en JSON pour les deux premiers usages,
  `parts[].inlineData.{data,mimeType}` (base64, pas de JSON) pour l'illustration).
  `GEMINI_API_KEY`/`GEMINI_MODEL`/`GEMINI_IMAGE_MODEL` sont des variables d'environnement **serveur**
  (`backend/.env`) — jamais envoyées au navigateur, contrairement à l'ancienne implémentation
  client-side restreinte uniquement par référent HTTP.
- Routes : `POST /api/ia/generer-seance` (publique, comme la génération de séance manuelle qu'elle
  remplace pour ce cas d'usage), `POST /api/ia/interpreter-exercices` et
  `POST /api/ia/generer-image-exercice` (réservées à `requireAdmin`, la première puisqu'elle écrit
  potentiellement dans la bibliothèque partagée — une bibliothèque vide n'est pas une erreur ici,
  contrairement à `/generer-seance` : tout revient simplement en "nouveaux" — la seconde puisqu'elle
  écrit l'illustration d'un exercice existant). L'upload manuel d'une image (sans IA) passe par
  `POST /api/exercices/:id/image` (et `DELETE /api/exercices/:id/image` pour la retirer), dans
  `routes/exercices.js` plutôt que `routes/ia.js` puisqu'aucun appel Gemini n'est impliqué.

**Churn des modèles** : Google retire ses modèles gratuits assez vite et parfois sans préavis (vécu
en juillet 2026 avec `gemini-2.5-flash-lite` puis `gemini-3-flash`, coupés du jour au lendemain).
`GEMINI_MODEL` (dans `backend/.env`) pointe donc vers `gemini-flash-lite-latest` — un **alias**
maintenu par Google (pas une version datée) qui suit automatiquement son modèle flash-lite gratuit
courant, pour ne plus avoir à mettre cette valeur à jour à chaque dépréciation. Si l'IA renvoie
malgré tout une erreur 404 "model not found", `GeminiClient.js` l'indique explicitement dans le
message d'erreur remonté au front : lister les modèles réellement disponibles pour la clé avec
`GET https://generativelanguage.googleapis.com/v1beta/models?key=TA_CLE` (l'endpoint `ListModels`)
plutôt que de se fier à la documentation ou à une recherche web, qui datent vite sur ce sujet.
`GEMINI_IMAGE_MODEL` (famille de modèle différente, pas d'alias équivalent connu à ce jour) suit la
même procédure en cas de 404 — valeur de départ (`gemini-2.5-flash-image`) non vérifiée contre l'API
réelle au moment d'écrire cette section, à confirmer/ajuster à l'implémentation puis en cas de
retrait futur.

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
├── InterpreterSeanceIA.test.js         # construireRequeteCriteresIA, construireRequeteSeanceIA, validerSeanceIA (ignore les index hallucinés/hors bornes, échoue si aucun bloc valide)
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

Comptes/services Google (projet Firebase, Firestore, Auth, compte de service, facturation et
budget Cloud Run) : voir **`GOOGLE.md`**, la référence opérationnelle pour tout ce qui touche à
Google. Ci-dessous, uniquement la configuration propre au dépôt.

### Frontend (`public/`)

1. Copier `public/firebase-config.example.js` en `public/firebase-config.js` et renseigner la config
   du projet (sert uniquement à Firebase Auth désormais — voir `GOOGLE.md`)
2. Copier `public/api-config.example.js` en `public/api-config.js` et renseigner l'URL du backend
   (`http://localhost:3000` en développement local)
3. Renseigner `public/auth-config.js` (`ADMIN_EMAIL`) avec l'email qui pourra importer des exercices
4. `firebase use --add` pour lier le projet local au projet Firebase créé

### Backend (`backend/`)

5. `cd backend && npm install`
6. Copier `backend/.env.example` en `backend/.env` et renseigner les valeurs (détail de chaque
   variable et où l'obtenir : voir `GOOGLE.md`)
7. `npm run dev` pour démarrer le backend en local (port `PORT`, 3000 par défaut)

### Données

8. Importer `exemple/exercices-exemple.json` via `admin.html` pour peupler la bibliothèque

## CI/CD et déploiement

Front et backend se déploient indépendamment, **automatiquement** sur chaque merge dans `main` via
GitHub Actions (`.github/workflows/deploy.yml`) — voir Étape 3.6 ci-dessous et la section
"## CI/CD" de **`GOOGLE.md`** pour le pipeline complet (secrets, Secret Manager, garde-fous,
roadmap CI/CD future). Toute modification passe par une branche + une Pull Request vers `main` ;
`.github/workflows/ci.yml` fait tourner les tests (front + backend) sur chaque PR, requis avant
merge.

Commandes manuelles conservées comme repli (« break-glass », si le pipeline est indisponible) :

```bash
# Frontend
firebase deploy --only hosting

# Backend (Cloud Run, depuis backend/)
gcloud run deploy homefit-backend --source=. --region=europe-west9 --allow-unauthenticated --max-instances=2 --project=homefit-sh56
```

Détail dans [`docs/frontend/README.md`](docs/frontend/README.md#déploiement) et
[`docs/backend/README.md`](docs/backend/README.md#déploiement). Procédure manuelle complète
(variables d'environnement, régénération du fichier d'env vars, mise à jour de
`public/api-config.js` si l'URL du service change, facturation et budget) :
voir **`GOOGLE.md`**.

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

### ✅ Étape 3.4 — Backend déployé en production (Cloud Run)
- Bug corrigé : `public/api-config.js` déployé pointait encore vers `http://localhost:3000`
  (`firebase deploy` seul ne suffit pas — le backend doit être hébergé séparément)
- Choix Cloud Run plutôt que Render (comparatif technique/évolutivité/financier fait avec
  l'utilisateur) : meilleur démarrage à froid (~1-2s contre 30-60s) et intégration native au
  projet GCP `homefit-sh56` existant, au prix d'exiger une carte bancaire sur le compte —
  `--max-instances=2` comme vrai plafond de coût, un budget GCP n'étant qu'une alerte
- `gcloud` CLI installé et authentifié pour permettre des redéploiements en une commande
- Toute la configuration Google (comptes, facturation, budget, déploiement Cloud Run, variables
  d'environnement) déplacée dans un fichier dédié, **`GOOGLE.md`**, pour ne pas alourdir ce fichier
  d'architecture avec des détails purement opérationnels

### ✅ Étape 3.5 — Fiabilité et coût de la génération de séance par IA
- Objectif : la génération de séance par IA (`POST /api/ia/generer-seance`) devait aboutir plus
  souvent tout en consommant moins de tokens, sans changer le contrat de l'API (le front continue
  de ne faire qu'un seul appel HTTP, voir la section "Assistant IA" ci-dessus)
- `thinkingConfig: { thinkingBudget: 0 }` ajouté aux deux appels Gemini du module (raisonnement
  invisible désactivé, sans coût caché ni impact négatif mesuré sur ce modèle)
- Le catalogue complet (jusqu'à 160 exercices) n'est plus envoyé tel quel au(x) appel(s) qui
  choisissent les exercices : un premier appel léger (`construireRequeteCriteresIA`, sans
  catalogue) déduit des critères provisoires qui présélectionnent la bibliothèque
  (`filtrerExercices`) avant le second appel, avec repli sur le catalogue complet si le filtre ne
  retient rien — gain mesuré empiriquement de plusieurs milliers de tokens à quelques centaines par
  tentative selon la sélectivité de la description
- **Découverte empirique importante** (contre l'API réelle, pas des mocks) : une première version
  référençait chaque exercice par un index INTEGER et retirait l'objet `criteres`, désormais
  inutile, du schéma de réponse du second appel — cette combinaison fait dériver
  `gemini-flash-lite-latest` vers une génération dégénérée de façon **quasi systématique** (pas le
  taux probabiliste habituel). Il faut impérativement garder (a) un champ **STRING** pour
  référencer l'exercice (même s'il ne contient qu'un index court) et (b) l'objet `criteres` dans le
  schéma, même si son contenu est ensuite ignoré au profit de celui du premier appel — voir le
  commentaire détaillé dans `backend/src/domain/InterpreterSeanceIA.js`
- Le dérapage dégénéré probabiliste déjà documenté (variable, ~10% à plus de 70% selon les moments)
  reste inchangé par nature — ce n'est pas quelque chose que ce changement pouvait éliminer, seul
  son coût par tentative a baissé ; le retry existant (`TENTATIVES_MAX`) reste la ligne de défense

### ✅ Étape 3.6 — Stratégie CI/CD (GitHub Actions)
- Deux incidents réels avec le processus 100% manuel ont motivé cette étape : `public/api-config.js`
  déployé en pointant encore vers `localhost` (déjà arrivé deux fois, cf. Étape 3.4 pour la première
  occurrence) et des variables d'environnement Cloud Run générées à la main depuis un `backend/.env`
  potentiellement périmé
- Process : toute modification passe désormais par une branche + Pull Request vers `main` ;
  `.github/workflows/ci.yml` fait tourner les tests (front + backend) sur chaque PR, requis avant
  merge (règle de protection de branche) — `main` reflète ainsi systématiquement ce qui est déployé
- `.github/workflows/deploy.yml` déploie automatiquement sur chaque merge dans `main` : le frontend
  régénère `public/firebase-config.js`/`public/api-config.js` depuis des secrets GitHub à chaque
  exécution (plus de copie de travail locale à oublier de rebasculer) ; le backend passe les 3
  valeurs sensibles par **Google Secret Manager** (`--set-secrets`, plus de fichier en clair) et les
  valeurs non sensibles par secrets GitHub. Les deux jobs vérifient ce qui est réellement servi
  après coup (la prod ne pointe jamais vers `localhost`, `/api/whoami` répond)
- Garde-fou indépendant du pipeline : `scripts/check-api-config.js`, hook `predeploy` dans
  `firebase.json`, bloque tout déploiement manuel si `public/api-config.js` contient `localhost`
- Décision assumée : ce déploiement utilise une clé de compte de service GCP stockée en secret
  GitHub plutôt que Workload Identity Federation (sans clé statique) — jugé disproportionné pour un
  dépôt/déployeur unique ; migration documentée comme évolution future dans `GOOGLE.md`, avec
  d'autres pistes (previews Firebase par PR, backend de staging isolé) non implémentées à ce stade
- Détail complet (secrets, commandes GCP, rollback) : voir la section "## CI/CD" de **`GOOGLE.md`**

### ✅ Étape 3.7 — Illustration d'exercice (upload + génération IA)
- Le champ `image` du modèle `Exercice` (présent depuis le début mais jamais utilisé) sert
  désormais réellement : illustration du mouvement, affichée dans la modale de détail
  (`exercices.html`/`generateur.html`/`mes-seances.html`) et sur l'écran d'exécution guidée
  (`execution.html`)
- Sur `admin.html`, en édition d'un exercice déjà enregistré : upload manuel d'un fichier image, ou
  génération par IA (`GeminiClient.genererImageExercice()`) à partir d'un gabarit de prompt fixe
  (grille 3x3 d'étapes du mouvement) + la description de l'exercice — voir "Assistant IA" plus haut
- Stockage sur **Firebase Storage**, accédé **uniquement par le backend** (Admin SDK), même principe
  que Firestore — chemin `exercices/<id>.<ext>` dérivé de l'id Firestore (stable, insensible au
  renommage), voir `backend/src/repositories/ImageRepository.js` et `GOOGLE.md`
- Disponible uniquement sur un exercice **déjà enregistré** (pas au moment de la création initiale) :
  simplification assumée, l'admin crée d'abord l'exercice puis l'édite pour y ajouter une image
- Suppression d'un exercice (`DELETE /api/exercices/:id`) purge aussi son image associée dans
  Storage (bug initial corrigé : la route ne supprimait que le document Firestore, laissant un
  fichier orphelin). Une image reste malgré tout orpheline si le fichier a été déposé/l'exercice
  supprimé directement dans Firebase Storage sans passer par l'app — `admin-images.html` (lien
  "🖼️ Images orphelines" depuis `admin.html`) liste ces images (`GET
  /api/exercices/images-orphelines`, comparaison des noms de fichiers du bucket — dérivés de l'id
  d'exercice — contre les ids Firestore existants) et permet de les supprimer individuellement ou en
  masse (`DELETE /api/exercices/images-orphelines/:nom`). Téléchargement volontairement pas encore
  traité : recoupe l'export JSON existant (qui n'exporte pas les images), à revoir ensemble plus tard

### 🔜 Étape 4 — Suivi de progression
- Statistiques par exercice (progression du nombre de reps/temps dans la durée)
- Graphique de fréquence des séances (jours actifs, streak)

### 🔜 Étape 5 — Fonctionnalités transverses
- Favoris / séances personnalisées sauvegardées comme modèles réutilisables

---

> Ce fichier est destiné à guider Claude Code. Il doit être mis à jour à chaque évolution significative du projet.
