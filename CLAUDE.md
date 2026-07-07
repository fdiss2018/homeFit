# HomeFit

Générateur de séances de sport à la maison.

## Stack technique

- **Frontend** : Vanilla HTML/CSS/JS (pas de framework, pas de bundler)
- **Hébergement** : Firebase Hosting (`public/` est la racine servie)
- **Base de données** : Cloud Firestore
- **Authentification** : Firebase Auth (email + mot de passe)
- **SDK Firebase** : v12 chargé via CDN (`https://www.gstatic.com/firebasejs/12.12.0/...`)
- **Modules ES** : les scripts utilisent `type="module"`
- **Tests** : Vitest (dev uniquement — ne fait pas partie du déploiement Firebase)

## Structure des fichiers

```
public/
├── index.html                 # Accueil : accès générateur / bibliothèque / historique / compte
├── generateur.html            # Formulaire de critères → séance générée → affichage + enregistrement
├── exercices.html             # Bibliothèque d'exercices (lecture seule, recherche)
├── historique.html            # Historique des séances enregistrées
├── login.html                 # Connexion / inscription (Firebase Auth)
├── admin.html                 # Import de la bibliothèque d'exercices (JSON), réservé à ADMIN_EMAIL
├── firebase-config.example.js # Modèle de config Firebase (à copier en firebase-config.js, gitignoré)
├── auth-config.js             # Email admin autorisé sur admin.html
├── style.css                  # Styles globaux (thème sombre/orange, sans framework CSS)
├── 404.html                   # Page d'erreur personnalisée
├── models/
│   ├── Exercice.js            # Classe Exercice (nom, groupeMusculaire, materiel, niveau, type, valeurDefaut...)
│   └── Seance.js               # Classe Seance (blocs d'exercices générés, durée estimée)
├── services/
│   ├── ExerciceService.js      # CRUD Firestore de la bibliothèque d'exercices
│   ├── HistoriqueSeanceService.js  # Façade async : localStorage (anonyme) ou Firestore (connecté)
│   └── AuthService.js          # Firebase Auth : inscription, connexion, déconnexion
└── utils/
    └── GenerateurSeance.js     # filtrerExercices() + genererSeance() — logique pure, sans Firebase
exemple/
└── exercices-exemple.json      # Fichier d'exemple à importer via admin.html
```

## Modèle de domaine

Un **Exercice** appartient à un **groupe musculaire**, nécessite éventuellement du **matériel**, et a un
**niveau** de difficulté. Il s'exécute soit en **répétitions**, soit en **durée** (secondes).

Une **Seance** est générée à partir de **critères** (durée souhaitée, groupes musculaires ciblés, matériel
disponible, niveau) : elle contient une liste de **blocs** (exercice + nombre de séries + valeur d'effort +
temps de repos) dont la durée totale estimée approche la durée demandée.

- `Exercice` — `id`, `nom`, `groupeMusculaire`, `materiel[]`, `niveau` (debutant|intermediaire|avance),
  `type` (repetitions|duree), `valeurDefaut`, `description`, `instructions`, `image`
- `Seance` — `id`, `date`, `criteres`, `blocs[]` (`{ exercice, series, valeur, type, reposSecondes }`),
  `dureeEstimeeMinutes`
- `GenerateurSeance.filtrerExercices(exercices, criteres)` — filtre par niveau (un niveau donné inclut les
  niveaux plus faciles), groupe musculaire (vide = tous) et matériel (un exercice sans matériel passe
  toujours ; sinon tout le matériel requis doit être disponible)
- `GenerateurSeance.genererSeance(exercices, criteres)` — mélange les exercices éligibles et pioche des
  blocs (3 séries, 30s de repos entre séries, 60s entre exercices) jusqu'à approcher la durée cible

## Architecture SOLID

| Principe | Implémentation |
|----------|----------------|
| **SRP** | `GenerateurSeance` ne fait que de la génération pure ; `ExerciceService` seule frontière Firestore pour les exercices |
| **OCP** | Ajouter un critère de filtrage ne modifie pas la signature de `genererSeance()` |
| **DIP** | `utils/GenerateurSeance.js` n'importe pas Firebase — il reçoit la liste d'exercices en paramètre |

## Format du fichier d'import d'exercices (JSON)

```json
{
  "exercices": [
    {
      "nom": "Pompes",
      "groupeMusculaire": "pectoraux",
      "materiel": [],
      "niveau": "debutant",
      "type": "repetitions",
      "valeurDefaut": 12,
      "description": "Exercice de poussée au poids du corps.",
      "instructions": "Mains légèrement plus larges que les épaules..."
    }
  ]
}
```

Groupes musculaires valides : `jambes`, `dos`, `pectoraux`, `epaules`, `bras`, `abdominaux`, `cardio`, `full-body`.
Niveaux valides : `debutant`, `intermediaire`, `avance`.

## Modèle de données Firestore

### Collection `exercices` — bibliothèque partagée

```json
{
  "nom": "Pompes",
  "groupeMusculaire": "pectoraux",
  "materiel": [],
  "niveau": "debutant",
  "type": "repetitions",
  "valeurDefaut": 12,
  "description": "...",
  "instructions": "...",
  "image": ""
}
```

### Sous-collection `joueurs/{uid}/seances` — historique d'un utilisateur connecté

```json
{
  "date": "ISO string",
  "criteres": { "dureeMinutes": 20, "groupesMusculaires": [], "materielDisponible": [], "niveau": "intermediaire" },
  "dureeEstimeeMinutes": 22,
  "blocs": [
    { "exerciceId": "abc123", "nom": "Pompes", "series": 3, "valeur": 12, "type": "repetitions", "reposSecondes": 30 }
  ]
}
```

Pour un utilisateur anonyme, la même structure est stockée dans `localStorage['hf_historique']`
(30 séances max). `HistoriqueSeanceService` est une façade transparente : les pages n'ont pas à
connaître le mode de stockage. Lors de la première connexion sur un device,
`HistoriqueSeanceService.migrerDepuisLocalStorage(uid)` importe l'historique local dans Firestore.

## Gestion des utilisateurs

Identique au principe utilisé dans quizz-battle : anonyme via UUID/localStorage, connecté via Firebase
Auth (email + mot de passe). `admin.html` restreint l'accès à l'email défini dans `auth-config.js`
(`ADMIN_EMAIL`).

## Conventions de code

- Français pour les variables, commentaires et textes UI
- Pas de framework CSS externe (styles custom dans `style.css`)
- Pas de build step : les fichiers sont déployés tels quels
- La logique de génération de séance (`utils/GenerateurSeance.js`) ne doit jamais importer Firebase —
  elle doit rester testable sans dépendance externe

## Tests automatisés

La logique de génération de séance (`utils/GenerateurSeance.js`) est 100 % testable sans Firebase.

```bash
npm test          # mode watch (développement)
npm run test:run  # one-shot (CI)
```

```
tests/
└── GenerateurSeance.test.js   # filtrerExercices, genererSeance (durée cible, critères vides, garde-fou)
```

**Règle** : toute nouvelle règle de génération ou de filtrage doit être couverte par un test avant d'être
mergée. Ne pas mocker `Math.random` — préférer des assertions sur l'ensemble des valeurs possibles.

## Configuration initiale (à faire avant le premier lancement)

1. Créer un projet sur [console.firebase.google.com](https://console.firebase.google.com)
2. Activer **Firestore Database** et **Authentication** (méthode Email/mot de passe)
3. Copier `public/firebase-config.example.js` en `public/firebase-config.js` et renseigner la config du projet
4. Renseigner `public/auth-config.js` (`ADMIN_EMAIL`) avec l'email qui pourra importer des exercices
5. `firebase use --add` pour lier le projet local au projet Firebase créé
6. Importer `exemple/exercices-exemple.json` via `admin.html` pour peupler la bibliothèque

## Déploiement

```bash
firebase deploy
```

---

## Roadmap

### ✅ Étape 1 — MVP Générateur de séances
- Modèle de domaine `Exercice` / `Seance` + génération pure testée (`utils/GenerateurSeance.js`)
- Formulaire de critères (durée, groupes musculaires, matériel, niveau) → séance affichée
- Bibliothèque d'exercices en lecture (`exercices.html`) + import admin (`admin.html`)
- Comptes utilisateurs (Firebase Auth) + historique des séances enregistrées (Firestore ou localStorage)

### 🔜 Étape 2 — Exécution guidée de la séance
- Écran d'exécution avec minuteur par exercice/série, décompte du repos, passage automatique au suivant
- Marquer une séance comme "terminée" avec les valeurs réellement effectuées

### 🔜 Étape 3 — Suivi de progression
- Statistiques par exercice (progression du nombre de reps/temps dans la durée)
- Graphique de fréquence des séances (jours actifs, streak)

### 🔜 Étape 4 — Fonctionnalités transverses
- Images/gifs de démonstration par exercice
- Favoris / séances personnalisées sauvegardées comme modèles réutilisables

---

> Ce fichier est destiné à guider Claude Code. Il doit être mis à jour à chaque évolution significative du projet.
