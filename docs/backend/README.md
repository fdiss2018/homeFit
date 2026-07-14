# Backend HomeFit

API REST Node/Express (ESM), seul point d'accès à Cloud Firestore (via `firebase-admin`, Admin
SDK) et à l'API Gemini. Contient toute la logique métier de l'application : sélection/génération
des exercices d'une séance, accès aux données, appel IA.

Pour la configuration (comptes Google, variables d'environnement, déploiement Cloud Run) : voir
[`GOOGLE.md`](../../GOOGLE.md) à la racine du dépôt. Pour les décisions d'architecture globales
(pourquoi un backend séparé, répartition front/backend) : voir [`CLAUDE.md`](../../CLAUDE.md).

## Vue d'ensemble

```
server.js
└── routes/          whoami, exercices, seances, ia
    └── middleware/   authentifier (résout req.uid/req.isAdmin), requireAdmin, requireUid
        └── domain/        logique pure (Exercice, Seance, GenerateurSeance, Interpreter*IA)
        └── repositories/  ExerciceRepository, SeanceRepository (Firestore)
        └── services/      GeminiClient (API Gemini)
```

Trois fichiers seulement touchent à Firebase Admin (`src/firebaseAdmin.js`, qui expose `db` et
`auth`) : `ExerciceRepository.js`, `SeanceRepository.js` (Firestore) et `middleware/auth.js`
(vérification des tokens). Tout le reste du backend ne connaît ni Express ni Firestore — les
fonctions de `src/domain/` reçoivent leurs données en paramètre et sont testables sans serveur
(voir `backend/tests/`).

## Diagramme de classes

```mermaid
classDiagram
    class Exercice {
        +string id
        +string nom
        +string groupeMusculaire
        +string[] materiel
        +string niveau
        +number valeurDefautRepetitions
        +number valeurDefautDuree
        +string description
        +string instructions
        +string image
        +toFirestore() object
        +fromFirestore(id, data)$ Exercice
    }

    class Seance {
        +string id
        +string date
        +string nom
        +object criteres
        +Bloc[] blocs
        +number dureeEstimeeMinutes
        +toFirestore() object
        +fromFirestore(id, data)$ Seance
    }

    class GenerateurSeance {
        <<module>>
        +filtrerExercices(exercices, criteres) Exercice[]
        +genererSeance(exercices, criteres) Seance
        +calculerDureeEstimeeMinutes(blocs) number
        +calculerDureeTotaleSecondes(blocs) number
    }

    class InterpreterDemandeIA {
        <<module>>
        +validerCriteresIA(brut) object
        +plusProche(valeur, options, defaut) number
    }

    class InterpreterSeanceIA {
        <<module>>
        +construireRequeteSeanceIA(description, exercices) object
        +validerSeanceIA(brut, exercices) object
        +formaterCatalogue(exercices) string
    }

    class InterpreterExerciceIA {
        <<module>>
        +construireRequeteExercicesIA(description, exercices) object
        +validerExercicesIA(brut, exercices) object
    }

    class ExerciceRepository {
        <<repository>>
        +creer(exercice) string
        +listerTous() Exercice[]
        +mettreAJour(id, exercice) void
        +supprimer(id) void
    }

    class SeanceRepository {
        <<repository>>
        +ajouter(uid, seance) string
        +lister(uid) Seance[]
        +mettreAJour(uid, id, seance) void
        +supprimer(uid, id) void
    }

    class GeminiClient {
        <<service>>
        +genererSeanceParIA(description, exercices) object
        +interpreterExercices(description, exercices) object
    }

    GenerateurSeance ..> Seance : construit
    GenerateurSeance ..> Exercice : filtre

    InterpreterSeanceIA ..> InterpreterDemandeIA : réutilise validerCriteresIA
    InterpreterSeanceIA ..> GenerateurSeance : réutilise constantes/défauts
    InterpreterExerciceIA ..> InterpreterSeanceIA : réutilise formaterCatalogue

    ExerciceRepository ..> Exercice : lit/écrit
    SeanceRepository ..> Seance : lit/écrit

    GeminiClient ..> InterpreterSeanceIA : construit + valide
    GeminiClient ..> InterpreterExerciceIA : construit + valide
```

**Notes** :
- `Exercice`/`Seance` sont de vraies classes ES ; les autres (`<<module>>`, `<<repository>>`,
  `<<service>>`) sont des objets exportant des fonctions — représentés comme des classes ici par
  convention de documentation, pas des `class` JS.
- `GenerateurSeance`, `InterpreterDemandeIA`, `InterpreterSeanceIA` et `InterpreterExerciceIA` sont
  entièrement dupliqués côté frontend (`public/utils/`, `public/models/`) — voir
  [`docs/frontend/README.md`](../frontend/README.md) et la section "Duplication assumée" de
  `CLAUDE.md`. Ce diagramme ne documente que la copie backend.

## Diagramme de séquence — `POST /api/ia/generer-seance`

Flux choisi car il traverse toutes les couches du backend (middleware, repository, domain,
service externe). Les routes CRUD simples (`/api/exercices`, `/api/seances`) suivent un schéma
plus court — route → repository → Firestore — sans étape intermédiaire.

```mermaid
sequenceDiagram
    actor Client
    participant Express as Express (authentifier)
    participant Route as routes/ia.js
    participant ExoRepo as ExerciceRepository
    participant Firestore
    participant Gemini as GeminiClient
    participant Interp as InterpreterSeanceIA
    participant API as API Gemini

    Client->>Express: POST /api/ia/generer-seance {description}
    Express->>Express: résout req.uid/req.isAdmin (non requis ici)
    Express->>Route: handler POST /generer-seance

    Route->>ExoRepo: listerTous()
    ExoRepo->>Firestore: collection("exercices").get()
    Firestore-->>ExoRepo: documents
    ExoRepo-->>Route: Exercice[]

    alt bibliothèque vide
        Route-->>Client: 500 { erreur: "Aucun exercice n'est encore disponible..." }
    end

    Route->>Gemini: genererSeanceParIA(description, exercices)
    Gemini->>Interp: construireRequeteSeanceIA(description, exercices)
    Interp-->>Gemini: requête Gemini (schéma JSON forcé)

    loop jusqu'à 5 tentatives (dégénérescence) / 2 (timeout)
        Gemini->>API: POST generateContent
        alt réponse valide
            API-->>Gemini: JSON { criteres, blocs }
        else timeout / JSON invalide / MAX_TOKENS
            API-->>Gemini: erreur transitoire
            Gemini->>Gemini: nouvelle tentative
        end
    end

    Gemini->>Interp: validerSeanceIA(brut, exercices)
    Note over Interp: ignore tout exerciceId hors bibliothèque,<br/>ne fait jamais confiance aveuglément à l'IA
    Interp-->>Gemini: { criteres, blocs }
    Gemini-->>Route: { criteres, blocs }

    Route->>Route: calculerDureeEstimeeMinutes(blocs)
    Route-->>Client: 200 Seance { criteres, blocs, dureeEstimeeMinutes }
```

## Tableau des routes

Toutes les routes passent par `authentifier` (mounté au niveau du préfixe dans `server.js`), qui
résout `req.uid`/`req.isAdmin` **sans jamais bloquer** — ce sont `requireAdmin`/`requireUid`,
posés route par route, qui imposent une exigence précise.

> ⚠️ Le gestionnaire d'erreur global (`server.js`) renvoie **toujours 500** pour toute erreur
> transmise via `next(err)`, quelle que soit sa nature métier — les seuls codes non-500 de toute
> l'API sont **401** (`authentifier`, token Firebase invalide), **403** (`requireAdmin`) et **400**
> (`requireUid`), levés directement par les middlewares.

### `GET /api/whoami`

| | |
|---|---|
| Middleware | `authentifier` |
| Body | — |
| Réponse | `200` `{ uid: string\|null, isAdmin: boolean }` |

### `/api/exercices`

| Route | Middleware | Body | Réponse succès | Erreurs |
|---|---|---|---|---|
| `GET /` | `authentifier` | — | `200` `Exercice[]` | — |
| `POST /` | `authentifier`, `requireAdmin` | champs `Exercice` (`nom`, `groupeMusculaire` requis) | `201` `{ id }` | `403` non admin |
| `PUT /:id` | `authentifier`, `requireAdmin` | champs `Exercice` (remplacement complet) | `204` | `403` non admin |
| `DELETE /:id` | `authentifier`, `requireAdmin` | — | `204` | `403` non admin |

### `/api/seances`

| Route | Middleware | Body | Réponse succès | Erreurs |
|---|---|---|---|---|
| `POST /generer` | `authentifier` (public) | `criteres` (`dureeMinutes`, `niveau`...) | `200` `Seance` | `500` si aucun exercice ne correspond aux critères |
| `POST /recalculer-duree` | `authentifier` (public) | `{ blocs }` | `200` `{ dureeEstimeeMinutes }` | — |
| `GET /` | `authentifier`, `requireUid` | — | `200` `Seance[]` (triées par date desc) | `400` uid non résolu |
| `POST /` | `authentifier`, `requireUid` | champs `Seance` | `201` `{ id }` | `400` uid non résolu |
| `PUT /:id` | `authentifier`, `requireUid` | champs `Seance` (remplacement complet) | `204` | `400` uid non résolu |
| `DELETE /:id` | `authentifier`, `requireUid` | — | `204` | `400` uid non résolu |

> `POST /generer` et `POST /recalculer-duree` sont déclarées **avant** `seancesRouter.use(requireUid)`
> dans le code — elles ne nécessitent donc pas d'utilisateur résolu, contrairement aux 4 routes
> suivantes.

### `/api/ia`

| Route | Middleware | Body | Réponse succès | Erreurs |
|---|---|---|---|---|
| `POST /generer-seance` | `authentifier` (public) | `{ description }` | `200` `Seance` | `500` bibliothèque vide, ou échec IA (après retries) |
| `POST /interpreter-exercices` | `authentifier`, `requireAdmin` | `{ description }` | `200` `{ nouveaux, existants }` | `403` non admin ; `500` si aucune proposition exploitable |

## Variables d'environnement

`PORT`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `STATIC_API_TOKEN`,
`ADMIN_EMAIL`, `CORS_ALLOWED_ORIGIN` — détail de chaque variable et où l'obtenir dans
[`GOOGLE.md`](../../GOOGLE.md#variables-denvironnement-backend-backendenv).

## Tests

Logique pure testée sans réseau ni Firestore dans `backend/tests/` (un fichier par module de
`src/domain/`) :

```bash
cd backend
npm run test:run
```
