// Met à jour le schéma de la base configurée dans .env (locale ou alwaysdata), sans rien supprimer.
// À lancer après une mise à jour de l’application qui modifie database/schema.sql, avant de déployer.
import { pool } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { config } from '../src/config.js';
try {
  await migrate();
  console.log(`Schéma à jour : ${config.db.user}@${config.db.host}/${config.db.database}.`);
} catch (error) {
  console.error(`Mise à jour impossible (${error.code || error.message}). Vérifiez les paramètres DB_* dans .env.`);
  process.exitCode = 1;
} finally { await pool.end(); }
