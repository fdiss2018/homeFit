import { LIBELLES, NIVEAU_LIBELLE, iconeGroupeHtml } from './constantes.js';

// Modale de détail d'exercice, partagée entre generateur.html et mes-seances.html.
// Un seul élément DOM est créé et réutilisé (ajouté à document.body au premier appel).
let elementModale = null;

function creerModale() {
  const div = document.createElement('div');
  div.className = 'modale-fond hidden';
  div.innerHTML = `
    <div class="modale-contenu">
      <button class="modale-fermer" type="button" aria-label="Fermer">✕</button>
      <div class="modale-corps"></div>
    </div>
  `;
  div.addEventListener('click', e => { if (e.target === div) fermerModaleExercice(); });
  div.querySelector('.modale-fermer').addEventListener('click', fermerModaleExercice);
  document.body.appendChild(div);
  return div;
}

// `exercice` peut être partiel (ex. exercice supprimé depuis, ou séance ancienne) —
// chaque section n'est affichée que si la donnée correspondante est disponible.
export function afficherModaleExercice(exercice) {
  if (!exercice) return;
  if (!elementModale) elementModale = creerModale();

  const materiel = (exercice.materiel || []).length ? exercice.materiel.join(', ') : 'Aucun matériel';
  const groupeLibelle = exercice.groupeMusculaire ? (LIBELLES[exercice.groupeMusculaire] || exercice.groupeMusculaire) : '';

  elementModale.querySelector('.modale-corps').innerHTML = `
    <div style="display:flex; align-items:center; gap:14px; margin-bottom:14px">
      ${exercice.groupeMusculaire ? iconeGroupeHtml(exercice.groupeMusculaire, 52) : ''}
      <div>
        <p class="carte-titre" style="margin:0">${exercice.nom || ''}</p>
        ${groupeLibelle ? `<p class="carte-desc" style="margin:0">${groupeLibelle}</p>` : ''}
      </div>
    </div>
    ${exercice.niveau ? `<p class="carte-desc">🎚️ ${NIVEAU_LIBELLE[exercice.niveau] || exercice.niveau} · 🛠️ ${materiel}</p>` : ''}
    ${exercice.valeurDefautRepetitions !== undefined ? `<p class="carte-desc">🔁 ${exercice.valeurDefautRepetitions} répétitions · ⏱️ ${exercice.valeurDefautDuree}s</p>` : ''}
    ${exercice.description ? `<p class="carte-desc">${exercice.description}</p>` : ''}
    ${exercice.instructions ? `<p class="carte-desc"><strong>Instructions —</strong> ${exercice.instructions}</p>` : ''}
    ${!exercice.groupeMusculaire && !exercice.description ? '<p class="carte-desc"><em>Cet exercice a été supprimé de la bibliothèque depuis.</em></p>' : ''}
  `;
  elementModale.classList.remove('hidden');
}

export function fermerModaleExercice() {
  elementModale?.classList.add('hidden');
}

// Factorise le branchement du clic-détail : un seul listener délégué sur
// `conteneur`, qui s'applique à tout élément `.ouvre-detail-exercice` qu'il
// contient (présent ou ajouté plus tard, ex. après un re-rendu de liste).
// `obtenirExercice(id)` doit renvoyer l'Exercice complet correspondant à
// `data-id` (ou undefined/null si introuvable — la modale affiche alors un
// repli à partir du texte de l'élément cliqué).
export function activerClicDetailExercice(conteneur, obtenirExercice) {
  conteneur.addEventListener('click', e => {
    const cible = e.target.closest('.ouvre-detail-exercice');
    if (!cible) return;
    const exercice = obtenirExercice(cible.dataset.id);
    afficherModaleExercice(exercice || { nom: cible.dataset.nom || cible.textContent.trim() });
  });
}
