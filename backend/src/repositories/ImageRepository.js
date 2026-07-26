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
