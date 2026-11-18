// Point d’entrée Vercel : l’application Express servie comme fonction pour toutes les routes /api/*.
// Les fichiers de public/ (interface) sont servis directement par Vercel, voir vercel.json.
// Le schéma n’est pas mis à jour ici (trop coûteux à chaque démarrage) : utiliser « npm run db:migrate ».
import { createApp } from '../src/app.js';

export default createApp();
