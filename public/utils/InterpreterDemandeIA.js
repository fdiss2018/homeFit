import { GROUPES_MUSCULAIRES, NIVEAUX } from '../models/Exercice.js';
import { MATERIEL_DISPONIBLE } from './constantes.js';

const DUREES_DISPONIBLES = [10, 20, 30, 45, 60];
const REPOS_DISPONIBLES = [15, 30, 60, 90, 120];

// Construit le corps de requête envoyé à l'API Gemini (generateContent), en
// forçant une sortie JSON conforme au schéma des critères de génération.
// Fonction pure — aucun appel réseau ici (voir services/GeminiService.js).
export function construireRequeteGemini(description) {
  const prompt = `Tu configureras une séance de sport à la maison correspondant à la demande de
l'utilisateur, pour un générateur qui choisira ensuite lui-même les exercices selon ces critères.

Réponds UNIQUEMENT avec un objet JSON de cette forme (exemple) :
{
  "dureeMinutes": 20,
  "groupesMusculaires": ["quadriceps", "abdominaux"],
  "materielDisponible": [],
  "niveau": "intermediaire",
  "preferenceType": "repetitions",
  "enchainementAutomatique": false,
  "reposEntreExercicesSecondes": 60
}

Règles à respecter :
- "groupesMusculaires" doit être un sous-ensemble de : ${GROUPES_MUSCULAIRES.join(', ')} (tableau
  vide si l'utilisateur ne cible aucun muscle en particulier = tous les groupes).
- "materielDisponible" doit être un sous-ensemble de : ${MATERIEL_DISPONIBLE.join(', ')} (tableau
  vide si poids du corps uniquement).
- "niveau" doit être l'une de : ${NIVEAUX.join(', ')}.
- "preferenceType" vaut "duree" si l'utilisateur veut enchaîner par le temps plutôt que compter les
  répétitions ; "enchainementAutomatique" à true si l'utilisateur veut un enchaînement minuté sans
  pause à valider lui-même.
- Si l'utilisateur ne précise pas un champ, choisis une valeur par défaut raisonnable (durée 20
  minutes, niveau intermédiaire, aucun groupe ciblé, aucun matériel).

Demande de l'utilisateur : "${description}"`;

  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          dureeMinutes: { type: 'INTEGER' },
          groupesMusculaires: { type: 'ARRAY', items: { type: 'STRING', enum: GROUPES_MUSCULAIRES } },
          materielDisponible: { type: 'ARRAY', items: { type: 'STRING', enum: MATERIEL_DISPONIBLE } },
          niveau: { type: 'STRING', enum: NIVEAUX },
          preferenceType: { type: 'STRING', enum: ['repetitions', 'duree'] },
          enchainementAutomatique: { type: 'BOOLEAN' },
          // Gemini n'accepte "enum" que sur un champ de type STRING (même pour des valeurs
          // numériques) — d'où la conversion en chaînes ; plusProche() reconvertit via Number().
          reposEntreExercicesSecondes: { type: 'STRING', enum: REPOS_DISPONIBLES.map(String) }
        },
        required: ['dureeMinutes', 'niveau']
      }
    }
  };
}

function plusProche(valeur, options, defaut) {
  const nombre = Number(valeur);
  if (!Number.isFinite(nombre)) return defaut;
  return options.reduce((a, b) => (Math.abs(b - nombre) < Math.abs(a - nombre) ? b : a));
}

// Ne fait jamais confiance aveuglément à la sortie du modèle : chaque champ est
// validé/ramené à une valeur sûre et cohérente avec le domaine de l'app avant
// d'être transmis à GenerateurSeance.genererSeance().
export function validerCriteresIA(brut) {
  const groupesMusculaires = Array.isArray(brut?.groupesMusculaires)
    ? brut.groupesMusculaires.filter(g => GROUPES_MUSCULAIRES.includes(g))
    : [];

  const materielDisponible = Array.isArray(brut?.materielDisponible)
    ? brut.materielDisponible.filter(m => MATERIEL_DISPONIBLE.includes(m))
    : [];

  return {
    dureeMinutes: plusProche(brut?.dureeMinutes, DUREES_DISPONIBLES, 20),
    groupesMusculaires,
    materielDisponible,
    niveau: NIVEAUX.includes(brut?.niveau) ? brut.niveau : 'intermediaire',
    preferenceType: brut?.preferenceType === 'duree' ? 'duree' : 'repetitions',
    enchainementAutomatique: brut?.enchainementAutomatique === true,
    reposEntreExercicesSecondes: plusProche(brut?.reposEntreExercicesSecondes, REPOS_DISPONIBLES, 60)
  };
}
