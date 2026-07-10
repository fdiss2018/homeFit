// Clé API Gemini (niveau gratuit, sans carte bancaire — https://aistudio.google.com/apikey).
// Copier ce fichier en gemini-config.js et renseigner ta clé.
//
// IMPORTANT : cette clé est appelée directement depuis le navigateur (l'app est
// 100% statique, sans backend). Pour limiter les abus, restreins-la par référent
// HTTP dans la console Google Cloud (APIs & Services > Identifiants) au(x)
// domaine(s) où l'app est hébergée, ex. "https://ton-projet.web.app/*".
export const GEMINI_API_KEY = "TA_CLE_API_ICI";

// "gemini-flash-lite-latest" est un ALIAS maintenu par Google (pas une version
// datée) : il pointe toujours vers son modèle flash-lite gratuit courant, ce
// qui évite les 404 "model not found" à chaque dépréciation d'un modèle daté
// (vécu avec gemini-2.5-flash-lite puis gemini-3-flash, coupés sans préavis en
// juillet 2026). Si un jour cet alias pose problème, lister les modèles
// disponibles pour ta clé via GET
// https://generativelanguage.googleapis.com/v1beta/models?key=TA_CLE
export const GEMINI_MODEL = "gemini-flash-lite-latest";
