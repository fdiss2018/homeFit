// Construction de la requête Gemini pour générer une illustration d'exercice. Logique pure,
// testable sans réseau — voir GeminiClient.js pour l'appel HTTP et le parsing de la réponse
// (forme différente d'un appel texte/JSON : image en base64, pas de responseSchema ici).
const GABARIT_PROMPT = 'Une grille 3x3 comprenant 9 illustrations séquentielles, étape par étape, ' +
  'de mouvements de fitness, sur un fond blanc pur et épuré. Le sujet est un mannequin 3D ' +
  'minimaliste de couleur blanche qui montre la bonne exécution des exercices. Le groupe ' +
  'musculaire ciblé est mis en évidence en rouge vif sur le corps du personnage pour plus de ' +
  'clarté anatomique. Style de rendu 3D vectoriel épuré, anatomie très détaillée, aspect moderne ' +
  'de tableau pédagogique de fitness, sans texte, sans lettres, sans chiffres, sans légendes.';

export function construireRequeteImageExerciceIA(nom, description) {
  const prompt = `${GABARIT_PROMPT}\n\nExercice : ${nom}\nDescription : ${description}`;
  return { contents: [{ parts: [{ text: prompt }] }] };
}
