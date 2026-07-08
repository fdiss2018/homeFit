// Hypothèse de conversion partagée entre le modèle Exercice, le générateur de
// séances et l'écran d'exécution : combien de secondes représente 1 répétition.
export const SECONDES_PAR_REPETITION = 3;

// Matériel proposable dans les filtres/critères (generateur.html, exercices.html).
export const MATERIEL_DISPONIBLE = ['halteres', 'tapis', 'banc', 'elastique', 'kettlebell'];

// Libellés d'affichage des groupes musculaires et du matériel, partagés entre
// generateur.html, exercices.html et execution.html.
export const LIBELLES = {
  quadriceps: 'Quadriceps', 'ischio-jambiers': 'Ischio-jambiers', fessiers: 'Fessiers', mollets: 'Mollets',
  dorsaux: 'Dorsaux', lombaires: 'Lombaires', trapezes: 'Trapèzes',
  pectoraux: 'Pectoraux', epaules: 'Épaules', biceps: 'Biceps', triceps: 'Triceps', 'avant-bras': 'Avant-bras',
  abdominaux: 'Abdominaux', obliques: 'Obliques',
  cardio: 'Cardio', 'full-body': 'Full-body',
  halteres: 'Haltères', tapis: 'Tapis', banc: 'Banc', elastique: 'Élastique', kettlebell: 'Kettlebell'
};

// Pictogrammes anatomiques par groupe musculaire (public/images/groupes/). cardio et full-body
// n'ont pas de muscle unique à représenter : repli sur un emoji.
const CHEMIN_ICONES = {
  quadriceps: 'images/groupes/quadriceps.png',
  'ischio-jambiers': 'images/groupes/ischio-jambiers.png',
  fessiers: 'images/groupes/fessiers.png',
  mollets: 'images/groupes/mollets.png',
  dorsaux: 'images/groupes/dorsaux.png',
  lombaires: 'images/groupes/lombaires.png',
  trapezes: 'images/groupes/trapezes.png',
  pectoraux: 'images/groupes/pectoraux.png',
  epaules: 'images/groupes/epaules.png',
  biceps: 'images/groupes/biceps.png',
  triceps: 'images/groupes/triceps.png',
  'avant-bras': 'images/groupes/avant-bras.png',
  abdominaux: 'images/groupes/abdominaux.png',
  obliques: 'images/groupes/obliques.png'
};
const EMOJI_GROUPES_SANS_ICONE = { cardio: '🏃', 'full-body': '🔥' };

export function iconeGroupeHtml(groupe, taille = 28) {
  const chemin = CHEMIN_ICONES[groupe];
  return chemin
    ? `<img src="${chemin}" alt="" class="icone-groupe" style="width:${taille}px; height:${taille}px">`
    : `<span class="icone-groupe icone-groupe-emoji" style="width:${taille}px; height:${taille}px; font-size:${Math.round(taille * 0.6)}px">${EMOJI_GROUPES_SANS_ICONE[groupe] || '💪'}</span>`;
}
