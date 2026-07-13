import { GROUPES_MUSCULAIRES, NIVEAUX } from './Exercice.js';
import { MATERIEL_DISPONIBLE } from './constantes.js';
import { REPOS_DISPONIBLES, validerCriteresIA } from './InterpreterDemandeIA.js';
import { SERIES_PAR_EXERCICE, REPOS_ENTRE_SERIES, REPOS_ENTRE_EXERCICES_DEFAUT } from './GenerateurSeance.js';

// Exporté : réutilisé par InterpreterExerciceIA.js pour la détection de doublons (même format).
export function formaterCatalogue(exercices) {
  return exercices.map(ex => {
    const materiel = ex.materiel?.length ? ex.materiel.join(',') : 'aucun';
    return `${ex.id} | ${ex.nom} | ${ex.groupeMusculaire} | ${ex.niveau} | matériel: ${materiel}`;
  }).join('\n');
}

// Construit le corps de requête envoyé à l'API Gemini (generateContent) : contrairement à
// InterpreterDemandeIA.js (qui ne fait que déduire des critères généraux, ensuite filtrés/piochés
// au hasard par GenerateurSeance.genererSeance), l'IA choisit ici DIRECTEMENT les exercices dans la
// bibliothèque fournie — c'est elle qui décide de la pertinence de chacun par rapport à la demande.
// Fonction pure — aucun appel réseau ici (voir services/GeminiClient.js).
export function construireRequeteSeanceIA(description, exercicesDisponibles) {
  const catalogue = formaterCatalogue(exercicesDisponibles);

  const prompt = `Tu composes une séance de sport à la maison en choisissant, parmi la bibliothèque
d'exercices ci-dessous, ceux qui correspondent le mieux à la demande de l'utilisateur — tu ne dois
JAMAIS inventer un exercice qui n'est pas dans cette liste.

Bibliothèque disponible (id | nom | groupe musculaire | niveau | matériel requis) :
${catalogue}

Réponds UNIQUEMENT avec un objet JSON de cette forme (exemple) :
{
  "criteres": {
    "dureeMinutes": 20,
    "groupesMusculaires": ["quadriceps", "abdominaux"],
    "materielDisponible": [],
    "niveau": "intermediaire",
    "preferenceType": "repetitions",
    "enchainementAutomatique": false,
    "reposEntreSeriesSecondes": 30,
    "reposEntreExercicesSecondes": 60
  },
  "blocs": [
    { "exerciceId": "abc123", "series": 3, "valeur": 12, "type": "repetitions", "reposSecondes": 30, "reposApresSecondes": 60 }
  ]
}

Règles à respecter :
- Chaque "exerciceId" DOIT être un id EXACT de la bibliothèque ci-dessus.
- C'est TOI qui choisis directement les exercices adaptés (groupe musculaire ciblé, niveau,
  matériel disponible) — le générateur ne refiltre plus rien ensuite.
- "valeur" est un nombre de répétitions (si "type" vaut "repetitions") ou de secondes (si "type"
  vaut "duree") — inspire-toi de la valeur par défaut de l'exercice, ajustée au niveau demandé.
- Choisis un nombre de blocs et de séries tel que la durée totale approche celle demandée (ou 20
  minutes si non précisée). Pour estimer une durée : (séries) × (valeur en secondes, ~3s par
  répétition) + (séries - 1) × reposSecondes, sommé sur tous les blocs, plus reposApresSecondes
  entre chaque exercice.
- Des repos plus courts (10-20s) conviennent à une séance dynamique/cardio ; plus longs (60-90s) à
  une séance orientée force — adapte "reposSecondes"/"reposApresSecondes" par bloc selon la demande.
- "criteres" résume la séance (réutilisé comme valeurs par défaut si l'utilisateur ajoute un
  exercice manuellement ensuite) et doit rester cohérent avec les blocs choisis.
- Si l'utilisateur ne précise pas un champ, choisis une valeur par défaut raisonnable (durée 20
  minutes, niveau intermédiaire, aucun groupe ciblé, aucun matériel).

Demande de l'utilisateur : "${description}"`;

  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      // Une séance tient normalement en quelques centaines de tokens ; ce plafond limite le
      // coût/temps d'une éventuelle génération dégénérée plutôt que de laisser le modèle
      // continuer indéfiniment (voir aussi le timeout et le retry dans services/GeminiClient.js).
      maxOutputTokens: 4096,
      // Réduit (température par défaut plus élevée) car empiriquement plus stable sur cette
      // sortie structurée — moins de risque de dérive vers une génération dégénérée.
      temperature: 0.3,
      responseSchema: {
        type: 'OBJECT',
        properties: {
          criteres: {
            type: 'OBJECT',
            properties: {
              dureeMinutes: { type: 'INTEGER' },
              groupesMusculaires: { type: 'ARRAY', items: { type: 'STRING', enum: GROUPES_MUSCULAIRES } },
              materielDisponible: { type: 'ARRAY', items: { type: 'STRING', enum: MATERIEL_DISPONIBLE } },
              niveau: { type: 'STRING', enum: NIVEAUX },
              preferenceType: { type: 'STRING', enum: ['repetitions', 'duree'] },
              enchainementAutomatique: { type: 'BOOLEAN' },
              // Gemini n'accepte "enum" que sur un champ STRING (même pour des valeurs
              // numériques) — d'où la conversion en chaînes ; plusProche() reconvertit via Number().
              reposEntreSeriesSecondes: { type: 'STRING', enum: REPOS_DISPONIBLES.map(String) },
              reposEntreExercicesSecondes: { type: 'STRING', enum: REPOS_DISPONIBLES.map(String) }
            },
            required: ['dureeMinutes', 'niveau']
          },
          blocs: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                // PAS de "enum" ici malgré la tentation (élimination des ids hallucinés à la
                // source) : mesuré empiriquement qu'un enum de ~150+ ids fait beaucoup plus
                // souvent dériver ce modèle vers une génération dégénérée (boucle de répétition,
                // JSON tronqué/invalide) que la validation après coup n'en laisse passer.
                // validerSeanceIA() reste donc la seule ligne de défense contre un id halluciné —
                // elle ignore silencieusement tout bloc dont l'id ne correspond à aucun exercice
                // fourni, jamais de confiance aveugle dans la réponse du modèle.
                exerciceId: { type: 'STRING' },
                series: { type: 'INTEGER' },
                valeur: { type: 'INTEGER' },
                type: { type: 'STRING', enum: ['repetitions', 'duree'] },
                reposSecondes: { type: 'INTEGER' },
                reposApresSecondes: { type: 'INTEGER' }
              },
              required: ['exerciceId']
            }
          }
        },
        required: ['blocs']
      }
    }
  };
}

function entierPositif(valeur, defaut) {
  const nombre = Math.round(Number(valeur));
  return Number.isFinite(nombre) && nombre > 0 ? nombre : defaut;
}

function entierPositifOuZero(valeur, defaut) {
  const nombre = Math.round(Number(valeur));
  return Number.isFinite(nombre) && nombre >= 0 ? nombre : defaut;
}

// Comme validerCriteresIA (donnée éphémère) : jamais confiance aveugle, mais un champ invalide
// retombe sur un défaut plutôt que d'échouer — sauf si l'IA ne référence AUCUN exercice valide de
// la bibliothèque fournie, auquel cas la séance serait vide et l'appel échoue explicitement.
export function validerSeanceIA(brut, exercicesDisponibles) {
  const criteres = validerCriteresIA(brut?.criteres);
  const parId = new Map(exercicesDisponibles.map(ex => [ex.id, ex]));

  const blocs = (Array.isArray(brut?.blocs) ? brut.blocs : [])
    .filter(b => parId.has(b?.exerciceId))
    .map(b => {
      const exercice = parId.get(b.exerciceId);
      const type = b.type === 'duree' ? 'duree' : 'repetitions';
      const valeurDefaut = type === 'duree' ? exercice.valeurDefautDuree : exercice.valeurDefautRepetitions;

      return {
        exercice,
        series: entierPositif(b.series, SERIES_PAR_EXERCICE),
        valeur: entierPositif(b.valeur, valeurDefaut),
        type,
        reposSecondes: entierPositifOuZero(b.reposSecondes, REPOS_ENTRE_SERIES),
        reposApresSecondes: entierPositifOuZero(b.reposApresSecondes, REPOS_ENTRE_EXERCICES_DEFAUT)
      };
    });

  if (blocs.length === 0) {
    throw new Error("L'IA n'a sélectionné aucun exercice valide de la bibliothèque — réessaie avec une description différente.");
  }

  return { criteres, blocs };
}
