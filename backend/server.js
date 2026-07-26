import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authentifier } from './src/middleware/auth.js';
import { whoamiRouter } from './src/routes/whoami.js';
import { exercicesRouter } from './src/routes/exercices.js';
import { seancesRouter } from './src/routes/seances.js';
import { iaRouter } from './src/routes/ia.js';

const app = express();

const originsAutorisees = (process.env.CORS_ALLOWED_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Pas d'en-tête Origin (Postman, curl, appels serveur-à-serveur) : autorisé.
    if (!origin || originsAutorisees.includes(origin)) return callback(null, true);
    callback(new Error(`Origine non autorisée : ${origin}`));
  }
}));
// Limite par défaut d'Express (100kb) trop basse pour les images d'exercice envoyées en base64
// (upload manuel ou génération IA) — voir routes/exercices.js et routes/ia.js.
app.use(express.json({ limit: '6mb' }));

app.use('/api', authentifier, whoamiRouter);
app.use('/api/exercices', authentifier, exercicesRouter);
app.use('/api/seances', authentifier, seancesRouter);
app.use('/api/ia', authentifier, iaRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erreur: err.message || 'Erreur serveur.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`HomeFit backend démarré sur le port ${port}`));
