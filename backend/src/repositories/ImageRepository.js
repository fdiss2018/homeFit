import { obtenirBucketStorage } from '../firebaseAdmin.js';

const DOSSIER = 'exercices';

function extensionDepuisMime(mimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export const ImageRepository = {
  async supprimer(id) {
    const bucket = obtenirBucketStorage();
    const [fichiers] = await bucket.getFiles({ prefix: `${DOSSIER}/${id}.` });
    await Promise.all(fichiers.map(f => f.delete()));
  },

  // Une image est orpheline quand son nom (dérivé de l'id de l'exercice, voir televerser()
  // ci-dessous) ne correspond à aucun id présent dans idsValides — ex. l'exercice a été supprimé
  // sans passer par exercicesRouter.delete (import direct dans le bucket, ancien bug corrigé où
  // routes/exercices.js ne purgeait pas l'image à la suppression d'un exercice).
  async listerOrphelines(idsValides) {
    const bucket = obtenirBucketStorage();
    const [fichiers] = await bucket.getFiles({ prefix: `${DOSSIER}/` });
    return fichiers
      .map(f => f.name.slice(DOSSIER.length + 1))
      .filter(nom => !idsValides.has(nom.slice(0, nom.lastIndexOf('.'))))
      .map(nom => ({ nom, url: `https://storage.googleapis.com/${bucket.name}/${DOSSIER}/${nom}` }));
  },

  async supprimerOrpheline(nom) {
    const bucket = obtenirBucketStorage();
    await bucket.file(`${DOSSIER}/${nom}`).delete();
  },

  // Chemin dérivé de l'id Firestore de l'exercice (stable, jamais de collision) plutôt que de son
  // nom — voir CLAUDE.md. Purge systématique avant écriture : une régénération peut changer
  // d'extension (ex. png → jpg) et laisserait sinon un fichier orphelin.
  async televerser(id, base64, mimeType) {
    await this.supprimer(id);
    const bucket = obtenirBucketStorage();
    const chemin = `${DOSSIER}/${id}.${extensionDepuisMime(mimeType)}`;
    const fichier = bucket.file(chemin);
    await fichier.save(Buffer.from(base64, 'base64'), { metadata: { contentType: mimeType } });
    await fichier.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${chemin}`;
  }
};
