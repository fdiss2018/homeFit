import { GROUPES_MUSCULAIRES, NIVEAUX } from '../models/Exercice.js';
import { MATERIEL_DISPONIBLE } from './constantes.js';

// Construit le corps de requête envoyé à l'API Gemini (generateContent), en
// forçant une sortie JSON conforme au schéma d'un Exercice de la bibliothèque.
// Fonction pure — aucun appel réseau ici (voir services/GeminiService.js).
export function construireRequeteGeminiExercice(description) {
  const prompt = `Tu proposeras un exercice de sport à la maison correspondant à la demande de
l'utilisateur, pour l'ajouter à la bibliothèque d'une application de fitness.

Réponds UNIQUEMENT avec un objet JSON de cette forme (exemple) :
{
  "nom": "Curl biceps avec haltère",
  "groupeMusculaire": "biceps",
  "materiel": ["halteres"],
  "niveau": "debutant",
  "valeurDefautRepetitions": 12,
  "valeurDefautDuree": 36,
  "description": "Permet de travailler le biceps en pliant l'avant-bras.",
  "instructions": "On prend un haltère, coude appuyé sur le genou, on plie le bras vers l'épaule."
}

Règles à respecter :
- "groupeMusculaire" doit être une valeur EXACTE parmi : ${GROUPES_MUSCULAIRES.join(', ')}.
- "materiel" doit être un sous-ensemble de : ${MATERIEL_DISPONIBLE.join(', ')} (tableau vide si
  l'exercice se fait au poids du corps, sans matériel).
- "niveau" doit être l'une de : ${NIVEAUX.join(', ')}.
- "valeurDefautRepetitions" et "valeurDefautDuree" doivent être cohérentes entre elles pour le même
  exercice (l'utilisateur peut choisir de faire l'exercice en comptant les répétitions ou le temps).
- Si l'utilisateur ne précise pas un champ, choisis une valeur par défaut raisonnable (niveau
  debutant, aucun matériel).

Demande de l'utilisateur : "${description}"`;

  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          nom: { type: 'STRING' },
          groupeMusculaire: { type: 'STRING', enum: GROUPES_MUSCULAIRES },
          materiel: { type: 'ARRAY', items: { type: 'STRING', enum: MATERIEL_DISPONIBLE } },
          niveau: { type: 'STRING', enum: NIVEAUX },
          valeurDefautRepetitions: { type: 'INTEGER' },
          valeurDefautDuree: { type: 'INTEGER' },
          description: { type: 'STRING' },
          instructions: { type: 'STRING' }
        },
        required: ['nom', 'groupeMusculaire']
      }
    }
  };
}

// Contrairement à validerCriteresIA (où un mauvais champ ne fait qu'affecter une
// génération éphémère), une fiche d'exercice est écrite dans la bibliothèque
// partagée : nom et groupeMusculaire invalides/absents sont donc rejetés
// explicitement (même règle que l'import JSON dans admin.html), plutôt que de
// retomber silencieusement sur une valeur par défaut qui polluerait la base.
export function validerExerciceIA(brut) {
  const nom = typeof brut?.nom === 'string' ? brut.nom.trim() : '';
  if (!nom) throw new Error("L'IA n'a pas réussi à déterminer un nom d'exercice clair — précise-le.");

  if (!GROUPES_MUSCULAIRES.includes(brut?.groupeMusculaire)) {
    throw new Error("L'IA n'a pas réussi à déterminer un groupe musculaire valide — précise le muscle ciblé.");
  }

  const entierPositif = (valeur, defaut) => {
    const nombre = Math.round(Number(valeur));
    return Number.isFinite(nombre) && nombre > 0 ? nombre : defaut;
  };

  return {
    nom,
    groupeMusculaire: brut.groupeMusculaire,
    materiel: Array.isArray(brut?.materiel) ? brut.materiel.filter(m => MATERIEL_DISPONIBLE.includes(m)) : [],
    niveau: NIVEAUX.includes(brut?.niveau) ? brut.niveau : 'debutant',
    valeurDefautRepetitions: entierPositif(brut?.valeurDefautRepetitions, 10),
    valeurDefautDuree: entierPositif(brut?.valeurDefautDuree, 30),
    description: typeof brut?.description === 'string' ? brut.description.trim() : '',
    instructions: typeof brut?.instructions === 'string' ? brut.instructions.trim() : ''
  };
}
