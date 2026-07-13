import { GROUPES_MUSCULAIRES, NIVEAUX } from './Exercice.js';
import { MATERIEL_DISPONIBLE } from './constantes.js';
import { formaterCatalogue } from './InterpreterSeanceIA.js';

// Construit le corps de requête envoyé à l'API Gemini (generateContent) : la description peut
// décrire un seul exercice ou tout un programme (ex. objectif de rééducation) — l'IA propose alors
// autant d'exercices que nécessaire. Comme InterpreterSeanceIA.js, le catalogue existant est fourni
// dans le prompt pour que l'IA détecte les doublons plutôt que de proposer un exercice déjà présent
// sous un autre nom. Fonction pure — aucun appel réseau ici (voir services/GeminiClient.js).
export function construireRequeteExercicesIA(description, exercicesDisponibles) {
  const catalogue = exercicesDisponibles.length > 0
    ? formaterCatalogue(exercicesDisponibles)
    : '(bibliothèque vide pour le moment)';

  const prompt = `Tu proposeras un ou plusieurs exercices de sport à la maison correspondant à la
demande de l'utilisateur (qui peut décrire un seul exercice, ou un objectif/programme plus large
nécessitant plusieurs exercices), pour la bibliothèque d'une application de fitness.

Bibliothèque déjà existante (id | nom | groupe musculaire | niveau | matériel) :
${catalogue}

Réponds UNIQUEMENT avec un objet JSON de cette forme (exemple avec un nouvel exercice ET une mise à
jour d'un exercice déjà existant) :
{
  "exercices": [
    {
      "exerciceExistantId": "nouveau",
      "nom": "Extension de genou assise élastique",
      "groupeMusculaire": "quadriceps",
      "materiel": ["elastique"],
      "niveau": "debutant",
      "valeurDefautRepetitions": 12,
      "valeurDefautDuree": 36,
      "description": "Renforce le quadriceps en extension contrôlée, en limitant la mise en charge du genou.",
      "instructions": "Assis sur une chaise, élastique attaché à un pied fixe et passé sous la cheville. Tendre lentement la jambe à l'horizontale, tenir 2 secondes, puis revenir sans relâcher la tension."
    },
    {
      "exerciceExistantId": "abc123",
      "nom": "Pont fessier (variante genou fragile)",
      "groupeMusculaire": "fessiers",
      "materiel": [],
      "niveau": "debutant",
      "valeurDefautRepetitions": 12,
      "valeurDefautDuree": 36,
      "description": "Variante du pont fessier qui limite la flexion du genou pour ménager un genou fragile ou en rééducation.",
      "instructions": "Allongé sur le dos, genoux légèrement moins pliés qu'à l'habitude, pieds à plat. Pousser les hanches vers le haut en serrant les fessiers, sans forcer sur les genoux, puis redescendre lentement."
    }
  ]
}

Règles à respecter :
- Propose autant d'exercices que nécessaire pour répondre à la demande (un seul si elle ne décrit
  qu'un exercice, plusieurs si elle décrit un objectif/programme plus large).
- "exerciceExistantId" DOIT être "nouveau" si tu proposes un nouvel exercice à ajouter à la
  bibliothèque, ou l'id EXACT d'un exercice déjà listé ci-dessus si ta proposition met à jour/adapte
  un exercice qui y ressemble déjà fortement (même mouvement, même groupe musculaire) — dans ce cas,
  ne propose PAS un doublon : réutilise son id.
- "groupeMusculaire" doit être une valeur EXACTE parmi : ${GROUPES_MUSCULAIRES.join(', ')}.
- "materiel" doit être un sous-ensemble de : ${MATERIEL_DISPONIBLE.join(', ')} (tableau vide si
  l'exercice se fait au poids du corps, sans matériel).
- "niveau" doit être l'une de : ${NIVEAUX.join(', ')}.
- "valeurDefautRepetitions" et "valeurDefautDuree" doivent être cohérentes entre elles pour le même
  exercice (l'utilisateur peut choisir de faire l'exercice en comptant les répétitions ou le temps).
- "description" et "instructions" sont OBLIGATOIRES et doivent être aussi précises et complètes que
  possible — jamais une phrase vague ni un champ vide :
  - "description" explique en une ou deux phrases CE QUE travaille l'exercice et POURQUOI il
    convient à la demande (muscle(s) ciblé(s), effet recherché, précaution éventuelle si la demande
    évoque une blessure/contrainte physique).
  - "instructions" est un pas-à-pas exécutable par quelqu'un qui n'a jamais fait cet exercice :
    position de départ précise, description du mouvement, et un point de vigilance (posture,
    amplitude, respiration) si pertinent. Reste concret, pas de généralités.
- Si l'utilisateur ne précise pas un champ non obligatoire, choisis une valeur par défaut
  raisonnable (niveau debutant, aucun matériel).

Demande de l'utilisateur : "${description}"`;

  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      // Une poignée d'exercices détaillés tient largement dans ce budget ; ce plafond limite le
      // coût/temps d'une éventuelle génération dégénérée plutôt que de laisser le modèle
      // continuer indéfiniment (voir aussi le timeout et le retry dans services/GeminiClient.js).
      maxOutputTokens: 8192,
      // Réduit (température par défaut plus élevée) car empiriquement plus stable sur cette
      // sortie structurée — moins de risque de dérive vers une génération dégénérée.
      temperature: 0.3,
      responseSchema: {
        type: 'OBJECT',
        properties: {
          exercices: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                // PAS de "enum" ici (voir blocs[].exerciceId dans InterpreterSeanceIA.js pour
                // l'explication détaillée) : mesuré empiriquement qu'un enum de ~150+ ids fait
                // dériver ce modèle vers une génération dégénérée bien plus souvent que la
                // validation après coup n'en laisse passer. validerExercicesIA() reste donc la
                // seule ligne de défense contre un id halluciné.
                exerciceExistantId: { type: 'STRING' },
                nom: { type: 'STRING' },
                groupeMusculaire: { type: 'STRING', enum: GROUPES_MUSCULAIRES },
                materiel: { type: 'ARRAY', items: { type: 'STRING', enum: MATERIEL_DISPONIBLE } },
                niveau: { type: 'STRING', enum: NIVEAUX },
                valeurDefautRepetitions: { type: 'INTEGER' },
                valeurDefautDuree: { type: 'INTEGER' },
                description: { type: 'STRING' },
                instructions: { type: 'STRING' }
              },
              required: ['nom', 'groupeMusculaire', 'description', 'instructions']
            }
          }
        },
        required: ['exercices']
      }
    }
  };
}

function entierPositif(valeur, defaut) {
  const nombre = Math.round(Number(valeur));
  return Number.isFinite(nombre) && nombre > 0 ? nombre : defaut;
}

// Sanitisation commune à chaque proposition — ne vérifie pas nom/groupeMusculaire ici, c'est
// validerExercicesIA() qui décide de garder ou d'ignorer l'item selon ces deux champs.
function normaliserChampsExercice(brut) {
  return {
    materiel: Array.isArray(brut?.materiel) ? brut.materiel.filter(m => MATERIEL_DISPONIBLE.includes(m)) : [],
    niveau: NIVEAUX.includes(brut?.niveau) ? brut.niveau : 'debutant',
    valeurDefautRepetitions: entierPositif(brut?.valeurDefautRepetitions, 10),
    valeurDefautDuree: entierPositif(brut?.valeurDefautDuree, 30),
    description: typeof brut?.description === 'string' ? brut.description.trim() : '',
    instructions: typeof brut?.instructions === 'string' ? brut.instructions.trim() : ''
  };
}

// Contrairement à une génération de séance (donnée éphémère), une fiche d'exercice est écrite dans
// la bibliothèque partagée — mais avec plusieurs propositions dans un même appel, un item invalide
// ne doit pas faire échouer tout le lot (même règle que l'import JSON dans admin.html : chaque
// entrée est acceptée ou ignorée indépendamment). L'appel entier n'échoue que si AUCUNE proposition
// n'est finalement exploitable.
export function validerExercicesIA(brut, exercicesDisponibles) {
  const parId = new Map(exercicesDisponibles.map(ex => [ex.id, ex]));

  const propositions = (Array.isArray(brut?.exercices) ? brut.exercices : [])
    .map(item => {
      const nom = typeof item?.nom === 'string' ? item.nom.trim() : '';
      if (!nom || !GROUPES_MUSCULAIRES.includes(item?.groupeMusculaire)) return null;

      return {
        exerciceExistant: parId.get(item?.exerciceExistantId) || null,
        nom,
        groupeMusculaire: item.groupeMusculaire,
        ...normaliserChampsExercice(item)
      };
    })
    .filter(Boolean);

  if (propositions.length === 0) {
    throw new Error("L'IA n'a proposé aucun exercice exploitable — précise davantage ta description.");
  }

  const nouveaux = propositions
    .filter(p => !p.exerciceExistant)
    .map(({ exerciceExistant, ...champs }) => champs);

  const existants = propositions
    .filter(p => p.exerciceExistant)
    .map(({ exerciceExistant, ...champs }) => ({ id: exerciceExistant.id, nomActuel: exerciceExistant.nom, ...champs }));

  return { nouveaux, existants };
}
