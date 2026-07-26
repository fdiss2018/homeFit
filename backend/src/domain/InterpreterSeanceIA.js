import { GROUPES_MUSCULAIRES, NIVEAUX } from './Exercice.js';
import { MATERIEL_DISPONIBLE } from './constantes.js';
import { REPOS_DISPONIBLES, validerCriteresIA } from './InterpreterDemandeIA.js';
import { SERIES_PAR_EXERCICE, REPOS_ENTRE_SERIES, REPOS_ENTRE_EXERCICES_DEFAUT } from './GenerateurSeance.js';

// Exporté : réutilisé par InterpreterExerciceIA.js pour la détection de doublons (même format,
// avec l'id réel — ce module-ci utilise un format à index court, voir formaterCatalogueIndexe).
export function formaterCatalogue(exercices) {
  return exercices.map(ex => {
    const materiel = ex.materiel?.length ? ex.materiel.join(',') : 'aucun';
    return `${ex.id} | ${ex.nom} | ${ex.groupeMusculaire} | ${ex.niveau} | matériel: ${materiel}`;
  }).join('\n');
}

// Catalogue au format compact utilisé par construireRequeteSeanceIA : un index court (0, 1, 2...)
// remplace l'id Firestore (~20 caractères) pour réduire le nombre de tokens du prompt et de la
// réponse — l'index est local à la liste passée en paramètre (déjà présélectionnée par
// GeminiClient via filtrerExercices), jamais à la bibliothèque complète.
function formaterCatalogueIndexe(exercices) {
  return exercices.map((ex, i) => {
    const materiel = ex.materiel?.length ? ex.materiel.join(',') : 'aucun';
    return `${i} | ${ex.nom} | ${ex.groupeMusculaire} | ${ex.niveau} | matériel: ${materiel}`;
  }).join('\n');
}

// Un appel léger, sans catalogue, qui ne fait que déduire les critères généraux de la description
// (durée, groupes musculaires, matériel, niveau, repos...). Utilisé par GeminiClient UNIQUEMENT pour
// présélectionner la bibliothèque (filtrerExercices) avant le second appel — son résultat n'est pas
// le résumé final de la séance, construireRequeteSeanceIA le redérive avec le catalogue déjà réduit
// (voir la note sur la stabilité du modèle plus bas).
// Fonction pure — aucun appel réseau ici (voir services/GeminiClient.js).
export function construireRequeteCriteresIA(description) {
  const prompt = `Tu analyses la description d'une séance de sport à la maison pour en déduire des
critères structurés (durée, groupes musculaires ciblés, matériel disponible, niveau, préférence
répétitions/durée, enchaînement automatique, temps de repos), utilisés pour présélectionner une
bibliothèque d'exercices avant de composer la séance.

Réponds UNIQUEMENT avec un objet JSON de cette forme (exemple) :
{
  "dureeMinutes": 20,
  "groupesMusculaires": ["quadriceps", "abdominaux"],
  "materielDisponible": [],
  "avecIllustration": false,
  "niveau": "intermediaire",
  "preferenceType": "repetitions",
  "enchainementAutomatique": false,
  "reposEntreSeriesSecondes": 30,
  "reposEntreExercicesSecondes": 60
}

Règles à respecter :
- "groupesMusculaires" : uniquement des valeurs parmi ${GROUPES_MUSCULAIRES.join(', ')} — tableau
  vide si la description ne cible aucun groupe en particulier (séance complète/full-body).
- "materielDisponible" : uniquement des valeurs parmi ${MATERIEL_DISPONIBLE.join(', ')} — tableau
  vide aussi bien par défaut que si l'utilisateur dit explicitement qu'il n'a pas de matériel / est
  chez lui sans équipement / veut une séance au poids du corps uniquement (ex. "sans matériel",
  "pas d'équipement", "à mains nues") : dans les deux cas, tableau vide.
- "avecIllustration" : true UNIQUEMENT si l'utilisateur demande explicitement des exercices
  illustrés/avec image/avec schéma du mouvement ; false sinon (valeur par défaut).
- "niveau" : une valeur parmi ${NIVEAUX.join(', ')}.
- Si un champ n'est pas précisé dans la description, choisis une valeur par défaut raisonnable
  (durée 20 minutes, niveau intermédiaire, aucun groupe ciblé, aucun matériel, pas d'exigence
  d'illustration, repos moyens).
- Des repos plus courts (10-20s) conviennent à une séance dynamique/cardio ; plus longs (60-90s) à
  une séance orientée force.

Demande de l'utilisateur : "${description}"`;

  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      // Petite sortie structurée, sans catalogue : plafond bas, coût minime même en cas de retry.
      maxOutputTokens: 512,
      temperature: 0.3,
      // ⚠️ thinkingConfig: { thinkingBudget: 0 } a longtemps été présent ici (désactivation du
      // raisonnement invisible, sans impact négatif mesuré à l'époque) — retiré : le modèle
      // derrière l'alias GEMINI_MODEL a changé (résout désormais vers une version plus récente,
      // ex. gemini-3.5-flash-lite) et rejette ce champ avec une erreur 400 "Request contains an
      // invalid argument", cassant entièrement la génération de séance par IA. Mesuré empiriquement
      // (appel réel) : la requête réussit dès que ce champ est absent. Ne pas le réintroduire sans
      // revalider contre l'API réelle.
      responseSchema: {
        type: 'OBJECT',
        properties: {
          dureeMinutes: { type: 'INTEGER' },
          groupesMusculaires: { type: 'ARRAY', items: { type: 'STRING', enum: GROUPES_MUSCULAIRES } },
          materielDisponible: { type: 'ARRAY', items: { type: 'STRING', enum: MATERIEL_DISPONIBLE } },
          avecIllustration: { type: 'BOOLEAN' },
          niveau: { type: 'STRING', enum: NIVEAUX },
          preferenceType: { type: 'STRING', enum: ['repetitions', 'duree'] },
          enchainementAutomatique: { type: 'BOOLEAN' },
          // Gemini n'accepte "enum" que sur un champ STRING (même pour des valeurs numériques) —
          // d'où la conversion en chaînes ; plusProche() (via validerCriteresIA) reconvertit via Number().
          reposEntreSeriesSecondes: { type: 'STRING', enum: REPOS_DISPONIBLES.map(String) },
          reposEntreExercicesSecondes: { type: 'STRING', enum: REPOS_DISPONIBLES.map(String) }
        },
        required: ['dureeMinutes', 'niveau']
      }
    }
  };
}

// Construit le corps de requête envoyé à l'API Gemini (generateContent) pour le second appel :
// l'IA choisit ici DIRECTEMENT les exercices dans le catalogue fourni — c'est elle qui décide de la
// pertinence de chacun par rapport à la demande. `exercicesFiltres` est déjà présélectionné par
// GeminiClient (filtrerExercices sur les critères de construireRequeteCriteresIA), pas la
// bibliothèque complète : un catalogue plus court réduit les tokens du prompt (répétés à chaque
// retry) et de la réponse, en plus de réduire le risque de génération dégénérée.
//
// ⚠️ Schéma volontairement proche de la version à un seul appel qui existait avant : mesuré
// empiriquement (tests manuels répétés, pas un aléa) que ce modèle dérape de façon quasi
// systématique vers une génération dégénérée (un champ numérique qui explose en une suite de
// chiffres jusqu'à MAX_TOKENS) dès que (a) l'objet "criteres" est retiré du schéma de réponse, ou
// (b) le champ référençant l'exercice est typé INTEGER plutôt que STRING — même si "criteres"
// n'est ni requis, ni utilisé, ni mentionné dans le prompt. Retirer l'un ou l'autre casse la
// stabilité, donc les deux sont conservés tels quels ici ; seul le "criteres" de CE second appel
// est ignoré par GeminiClient (le résultat utilisé vient de construireRequeteCriteresIA, appliqué
// à la bibliothèque complète avant filtrage).
// Fonction pure — aucun appel réseau ici (voir services/GeminiClient.js).
export function construireRequeteSeanceIA(description, exercicesFiltres) {
  const catalogue = formaterCatalogueIndexe(exercicesFiltres);

  const prompt = `Tu composes une séance de sport à la maison en choisissant, parmi la bibliothèque
d'exercices ci-dessous (déjà présélectionnée selon les critères de l'utilisateur), ceux qui
correspondent le mieux à sa demande — tu ne dois JAMAIS inventer un exercice qui n'est pas dans
cette liste.

Bibliothèque disponible (index | nom | groupe musculaire | niveau | matériel requis) :
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
    { "exerciceId": "0", "series": 3, "valeur": 12, "type": "repetitions", "reposSecondes": 30, "reposApresSecondes": 60 }
  ]
}

Règles à respecter :
- Chaque "exerciceId" DOIT être l'index EXACT (sous forme de chaîne, ex. "3") d'un exercice de la
  bibliothèque ci-dessus.
- C'est TOI qui choisis directement les exercices adaptés (groupe musculaire ciblé, niveau,
  matériel disponible) à la demande.
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
      // thinkingConfig retiré ici aussi — voir la note détaillée dans construireRequeteCriteresIA
      // (rejeté avec 400 par le modèle actuel derrière l'alias GEMINI_MODEL).
      responseSchema: {
        type: 'OBJECT',
        properties: {
          // Conservé bien que son contenu soit ignoré par GeminiClient (voir note plus haut) :
          // retirer cet objet du schéma fait déraper le modèle vers une génération dégénérée.
          criteres: {
            type: 'OBJECT',
            properties: {
              dureeMinutes: { type: 'INTEGER' },
              groupesMusculaires: { type: 'ARRAY', items: { type: 'STRING', enum: GROUPES_MUSCULAIRES } },
              materielDisponible: { type: 'ARRAY', items: { type: 'STRING', enum: MATERIEL_DISPONIBLE } },
              avecIllustration: { type: 'BOOLEAN' },
              niveau: { type: 'STRING', enum: NIVEAUX },
              preferenceType: { type: 'STRING', enum: ['repetitions', 'duree'] },
              enchainementAutomatique: { type: 'BOOLEAN' },
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
                // STRING, PAS INTEGER (voir la note détaillée plus haut) : typer ce champ en
                // INTEGER fait déraper le modèle vers une génération dégénérée de façon quasi
                // systématique sur ce modèle, alors même que la valeur reste un index numérique
                // simple. Pas d'enum non plus malgré la taille désormais réduite du catalogue :
                // mesuré empiriquement (sur l'ancien format à id long) qu'un enum de ~150+ valeurs
                // fait dériver ce modèle bien plus souvent — pas assez de recul pour affirmer qu'un
                // enum serait sans risque même sur un catalogue réduit. validerSeanceIA() reste donc
                // la seule ligne de défense contre un index hors bornes ou halluciné.
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
// retombe sur un défaut plutôt que d'échouer — sauf si l'IA ne référence AUCUN index valide de la
// bibliothèque fournie, auquel cas la séance serait vide et l'appel échoue explicitement. Le
// "criteres" de brut est celui du SECOND appel (voir construireRequeteSeanceIA) — indépendant de
// celui utilisé par GeminiClient pour présélectionner la bibliothèque en amont.
export function validerSeanceIA(brut, exercicesFiltres) {
  const criteres = validerCriteresIA(brut?.criteres);

  const blocs = (Array.isArray(brut?.blocs) ? brut.blocs : [])
    .map(b => {
      const index = Math.trunc(Number(b?.exerciceId));
      if (!Number.isInteger(index) || index < 0 || index >= exercicesFiltres.length) return null;

      const exercice = exercicesFiltres[index];
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
    })
    .filter(Boolean);

  if (blocs.length === 0) {
    throw new Error("L'IA n'a sélectionné aucun exercice valide de la bibliothèque — réessaie avec une description différente.");
  }

  return { criteres, blocs };
}
