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
├── generateur.html            # Formulaire de critères → séance générée → édition des blocs → enregistrement
├── exercices.html             # Bibliothèque d'exercices (lecture seule, recherche)
├── historique.html            # Historique des séances enregistrées, bouton "Lancer" par séance
├── execution.html             # Écran d'exécution guidée (minuteur, enchaînement auto ou validation manuelle)
├── login.html                 # Connexion / inscription (Firebase Auth)
├── admin.html                 # Import de la bibliothèque d'exercices (JSON), réservé à ADMIN_EMAIL
├── firebase-config.example.js # Modèle de config Firebase (à copier en firebase-config.js, gitignoré)
├── auth-config.js             # Email admin autorisé sur admin.html
├── style.css                  # Styles globaux (thème sombre/orange, sans framework CSS)
├── 404.html                   # Page d'erreur personnalisée
├── models/
│   ├── Exercice.js            # Classe Exercice (nom, groupeMusculaire, materiel, niveau, 2 valeurs par défaut...)
│   └── Seance.js               # Classe Seance (blocs d'exercices générés, durée estimée)
├── services/
│   ├── ExerciceService.js      # CRUD Firestore de la bibliothèque d'exercices
│   ├── HistoriqueSeanceService.js  # Façade async : localStorage (anonyme) ou Firestore (connecté)
│   └── AuthService.js          # Firebase Auth : inscription, connexion, déconnexion
└── utils/
    ├── constantes.js            # Constantes partagées (SECONDES_PAR_REPETITION)
    ├── GenerateurSeance.js       # filtrerExercices() + genererSeance() — logique pure, sans Firebase
    └── ExecutionSeance.js        # construireEtapes() — aplatit une séance en étapes pour l'écran d'exécution
exemple/
└── exercices-exemple.json      # Bibliothèque d'exemple (160 exercices, 20 par groupe musculaire) à importer via admin.html
```

## Modèle de domaine

Un **Exercice** appartient à un **groupe musculaire**, nécessite éventuellement du **matériel**, et a un
**niveau** de difficulté. Il porte toujours **deux valeurs par défaut** (répétitions et durée), pour
pouvoir être exprimé dans l'un ou l'autre mode selon les critères de génération de la séance.

Une **Seance** est générée à partir de **critères** (durée souhaitée, groupes musculaires ciblés, matériel
disponible, niveau, repos entre exercices, préférence répétitions/durée, enchaînement automatique) : elle
contient une liste de **blocs** (exercice + nombre de séries + valeur d'effort + temps de repos) dont la
durée totale estimée approche la durée demandée. Les valeurs de chaque bloc (séries, valeur) peuvent être
ajustées manuellement sur `generateur.html` avant l'enregistrement.

- `Exercice` — `id`, `nom`, `groupeMusculaire`, `materiel[]`, `niveau` (debutant|intermediaire|avance),
  `valeurDefautRepetitions`, `valeurDefautDuree`, `description`, `instructions`, `image`.
  `Exercice.fromFirestore()` reste rétrocompatible avec l'ancien format (`type`+`valeurDefaut` uniques) en
  dérivant la valeur manquante via `SECONDES_PAR_REPETITION`.
- `Seance` — `id`, `date`, `nom`, `criteres`, `blocs[]`
  (`{ exercice, series, valeur, type, reposSecondes, reposApresSecondes }`), `dureeEstimeeMinutes`
- `GenerateurSeance.filtrerExercices(exercices, criteres)` — filtre par niveau (un niveau donné inclut les
  niveaux plus faciles), groupe musculaire (vide = tous) et matériel (un exercice sans matériel passe
  toujours ; sinon tout le matériel requis doit être disponible)
- `GenerateurSeance.genererSeance(exercices, criteres)` — mélange les exercices éligibles et pioche des
  blocs (3 séries, 30s de repos entre séries, repos entre exercices et type/valeur pilotés par
  `criteres.reposEntreExercicesSecondes` / `criteres.preferenceType` / `criteres.enchainementAutomatique`)
  jusqu'à approcher la durée cible
- `GenerateurSeance.calculerDureeEstimeeMinutes(blocs)` — recalcule la durée totale à partir de blocs déjà
  construits, réutilisé après une édition manuelle d'un bloc
- `ExecutionSeance.construireEtapes(seance)` — aplatit tous les blocs × séries d'une séance en une liste
  d'étapes séquentielles (effort/repos, automatique ou manuel), pour piloter `execution.html`

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
      "valeurDefautRepetitions": 12,
      "valeurDefautDuree": 36,
      "description": "Exercice de poussée au poids du corps.",
      "instructions": "Mains légèrement plus larges que les épaules..."
    }
  ]
}
```

Champs requis à l'import (`admin.html`) : `nom` et `groupeMusculaire` (valeur valide). Les autres champs
ont une valeur par défaut sûre si absents.

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
  "valeurDefautRepetitions": 12,
  "valeurDefautDuree": 36,
  "description": "...",
  "instructions": "...",
  "image": ""
}
```

### Sous-collection `joueurs/{uid}/seances` — historique d'un utilisateur connecté

```json
{
  "date": "ISO string",
  "nom": "Séance jambes du lundi",
  "criteres": {
    "dureeMinutes": 20, "groupesMusculaires": [], "materielDisponible": [], "niveau": "intermediaire",
    "reposEntreExercicesSecondes": 60, "preferenceType": "repetitions", "enchainementAutomatique": false
  },
  "dureeEstimeeMinutes": 22,
  "blocs": [
    { "exerciceId": "abc123", "nom": "Pompes", "series": 3, "valeur": 12, "type": "repetitions", "reposSecondes": 30, "reposApresSecondes": 60 }
  ]
}
```

Une séance peut être relancée depuis `historique.html` (bouton "▶ Lancer") : elle est transmise à
`execution.html` via `sessionStorage` (pas de nouvelle requête Firestore). L'écran d'exécution est
éphémère : il ne persiste aucun résultat de fin de séance.

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
├── GenerateurSeance.test.js   # filtrerExercices, genererSeance, calculerDureeEstimeeMinutes
└── ExecutionSeance.test.js    # construireEtapes (aplatissement blocs × séries, auto vs manuel, repos)
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

### ✅ Étape 2 — Exécution guidée de la séance (partielle)
- Écran d'exécution avec minuteur par exercice/série, décompte du repos, passage automatique au suivant
  (`execution.html`, lancé depuis `historique.html`)
- 🔜 Marquer une séance comme "terminée" avec les valeurs réellement effectuées (non fait, volontairement
  hors scope de cette itération — l'écran d'exécution actuel est éphémère, sans persistance)

### 🔜 Étape 3 — Suivi de progression
- Statistiques par exercice (progression du nombre de reps/temps dans la durée)
- Graphique de fréquence des séances (jours actifs, streak)

### 🔜 Étape 4 — Fonctionnalités transverses
- Images/gifs de démonstration par exercice
- Favoris / séances personnalisées sauvegardées comme modèles réutilisables

---

> Ce fichier est destiné à guider Claude Code. Il doit être mis à jour à chaque évolution significative du projet.
