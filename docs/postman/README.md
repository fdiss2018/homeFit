# Tester l'API HomeFit manuellement avec Postman

Guide de test manuel du backend (`backend/`), sans passer par le frontend. Pour l'architecture des
routes, voir [`docs/backend/README.md`](../backend/README.md). Pour l'URL du backend en local ou
en production (Cloud Run), voir [`GOOGLE.md`](../../GOOGLE.md).

## Prérequis

- Backend lancé en local : `cd backend && npm run dev` (écoute sur `http://localhost:3000` par
  défaut), ou l'URL Cloud Run de production.
- [Postman](https://www.postman.com/downloads/) installé.

## 1. Authentification

Le backend accepte deux formes de jeton dans l'en-tête `Authorization: Bearer <token>` (voir
`backend/src/middleware/auth.js`) :

### Option recommandée pour Postman : le bearer statique

`STATIC_API_TOKEN` (défini dans `backend/.env`) donne un accès **admin complet**
(`req.isAdmin = true`) sans passer par un vrai compte Firebase. C'est la méthode prévue
spécifiquement pour tester l'API via Postman.

- Pour les routes qui ont besoin d'un utilisateur résolu (`req.uid` — les séances personnelles),
  ajouter l'en-tête `X-Test-Uid: <un_id_quelconque>` : le backend l'utilise comme `uid` **quand le
  bearer statique est utilisé**, cet en-tête est ignoré avec toute autre forme d'authentification.
- Aucune requête réelle vers Firebase Auth n'est faite dans ce mode.

### Alternative : un vrai token Firebase ID

Possible mais plus lourd à obtenir hors du navigateur (nécessite de se connecter via le SDK
Firebase client puis d'extraire `await user.getIdToken()`, par exemple depuis la console du
navigateur sur le front en local). **Non nécessaire** pour un test manuel de l'API — réservé au cas
où on veut vérifier le comportement avec un email précis (`ADMIN_EMAIL` notamment). Non couvert plus
en détail par ce guide.

### Routes publiques

Certaines routes ne nécessitent aucune authentification (`GET /api/exercices`,
`POST /api/seances/generer`, `POST /api/seances/recalculer-duree`, `POST /api/ia/generer-seance`)
— l'en-tête `Authorization` peut être omis, elles fonctionnent de la même façon.

## 2. Importer la collection

1. Dans Postman : **Import** → sélectionner `docs/postman/HomeFit.postman_collection.json`.
2. Créer un **Environment** Postman (ou utiliser les variables de collection directement) avec :

| Variable | Valeur | Rôle |
|---|---|---|
| `base_url` | `http://localhost:3000` (ou l'URL Cloud Run) | Racine de l'API |
| `static_token` | la valeur de `STATIC_API_TOKEN` dans `backend/.env` | Authentification admin |
| `test_uid` | n'importe quelle chaîne, ex. `test-uid-postman` | Simule un utilisateur pour `/api/seances` |

Les variables `exercice_id`/`seance_id` sont des variables de **collection**, déjà déclarées —
elles se remplissent automatiquement après les requêtes "Créer un exercice"/"Ajouter une séance"
(petit script de test qui capture l'`id` de la réponse), pour que les requêtes
Mettre à jour/Supprimer suivantes fonctionnent directement sans copier-coller manuel.

## 3. Détail des routes

> Rappel important : le backend renvoie **toujours 500** pour une erreur métier (via `next(err)`),
> quelle que soit sa nature — seuls **401** (token Firebase invalide), **403** (`requireAdmin`) et
> **400** (`requireUid`, uid non résolu) sont des codes distincts, levés par les middlewares.

### Whoami

| | |
|---|---|
| **Qui suis-je** — `GET /api/whoami` | Headers : `Authorization: Bearer {{static_token}}` (optionnel) |
| Réponse | `200` `{ "uid": string\|null, "isAdmin": boolean }` |
| À essayer | Retirer l'en-tête `Authorization` → `{ "uid": null, "isAdmin": false }`. L'ajouter → `{ "uid": null, "isAdmin": true }` (le bearer statique seul ne pose pas de `uid`, seul `X-Test-Uid` le ferait). |

### Exercices (bibliothèque partagée)

| Requête | Méthode/URL | Auth | Body | Réponse succès |
|---|---|---|---|---|
| Lister les exercices | `GET /api/exercices` | publique | — | `200` tableau d'`Exercice` |
| Créer un exercice | `POST /api/exercices` | `requireAdmin` | `nom`, `groupeMusculaire` requis ; `materiel`, `niveau`, `valeurDefautRepetitions`, `valeurDefautDuree`, `description`, `instructions` optionnels | `201` `{ "id": "..." }` |
| Mettre à jour un exercice | `PUT /api/exercices/{{exercice_id}}` | `requireAdmin` | mêmes champs (remplacement complet) | `204` (vide) |
| Supprimer un exercice | `DELETE /api/exercices/{{exercice_id}}` | `requireAdmin` | — | `204` (vide) |

Sans le bearer statique (ou avec un token dont l'email ne correspond pas à `ADMIN_EMAIL`), les
requêtes Créer/Mettre à jour/Supprimer renvoient `403 { "erreur": "Accès réservé à l'administrateur." }`.

### Séances

| Requête | Méthode/URL | Auth | Body | Réponse succès |
|---|---|---|---|---|
| Générer une séance (manuelle) | `POST /api/seances/generer` | publique | `dureeMinutes`, `niveau` requis ; `groupesMusculaires`, `materielDisponible`, `reposEntreSeriesSecondes`, `reposEntreExercicesSecondes`, `preferenceType`, `enchainementAutomatique` optionnels | `200` `Seance` (tirage aléatoire parmi les exercices filtrés) |
| Recalculer la durée | `POST /api/seances/recalculer-duree` | publique | `{ "blocs": [...] }` | `200` `{ "dureeEstimeeMinutes": number }` |
| Lister mes séances | `GET /api/seances` | `requireUid` | — | `200` tableau de `Seance`, triées par date décroissante |
| Ajouter une séance | `POST /api/seances` | `requireUid` | forme "constructeur" : `blocs[].exercice` **imbriqué** (`{id, nom}` suffit) | `201` `{ "id": "..." }` |
| Mettre à jour une séance | `PUT /api/seances/{{seance_id}}` | `requireUid` | mêmes champs (remplacement complet) | `204` (vide) |
| Supprimer une séance | `DELETE /api/seances/{{seance_id}}` | `requireUid` | — | `204` (vide) |

⚠️ Sans `X-Test-Uid` (en plus du bearer statique), les 4 dernières requêtes renvoient
`400 { "erreur": "Utilisateur non résolu (uid manquant — X-Test-Uid requis avec le bearer statique)." }`.

⚠️ Le body de "Ajouter une séance"/"Mettre à jour une séance" utilise la forme **imbriquée**
(`blocs[i].exercice = {id, nom}`), pas la forme "aplatie" (`exerciceId`/`nom` séparés) — c'est le
backend qui aplatit avant d'écrire dans Firestore. Voir la fonction `toFirestore()` de la classe
`Seance` (backend et frontend) si besoin de détail.

### IA (assistant Gemini)

| Requête | Méthode/URL | Auth | Body | Réponse succès |
|---|---|---|---|---|
| Générer une séance par IA | `POST /api/ia/generer-seance` | publique | `{ "description": "..." }` | `200` `Seance` (exercices choisis directement par l'IA) |
| Proposer des exercices par IA | `POST /api/ia/interpreter-exercices` | `requireAdmin` | `{ "description": "..." }` | `200` `{ "nouveaux": [...], "existants": [...] }` |

Ces deux routes appellent réellement l'API Gemini (clé `GEMINI_API_KEY` requise côté backend) —
temps de réponse variable (1 à 10s en général, jusqu'à ~30s en cas de nouvelle tentative après une
génération dégénérée du modèle — voir `backend/src/services/GeminiClient.js`). Sans clé Gemini
configurée, ces deux requêtes échouent avec une erreur explicite plutôt que de planter.

## 4. Scénarios recommandés

1. **Whoami** sans puis avec le bearer statique — observer la différence `isAdmin`.
2. **Lister** les exercices, puis **créer** un exercice — vérifier qu'il apparaît dans une nouvelle
   requête "Lister".
3. **Générer une séance manuelle** (`/api/seances/generer`) — relancer plusieurs fois, observer que
   la sélection d'exercices varie (tirage aléatoire) mais reste conforme aux critères envoyés.
4. **Générer une séance par IA** (`/api/ia/generer-seance`) avec une description précise — comparer
   au résultat de la génération manuelle : ici c'est l'IA qui choisit les exercices, la durée et les
   temps de repos.
5. **Proposer des exercices par IA** (`/api/ia/interpreter-exercices`) avec une description couvrant
   plusieurs exercices dont au moins un très proche d'un exercice déjà en bibliothèque — vérifier
   que la réponse sépare bien `nouveaux` et `existants`, et qu'aucun `id` inventé n'apparaît dans
   `existants[].id` (doit toujours correspondre à un exercice réel de la bibliothèque).
6. **Ajouter puis lister mes séances** (avec `X-Test-Uid` constant) — vérifier que la séance créée
   apparaît, triée par date décroissante.
