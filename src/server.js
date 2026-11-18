import { createApp } from './app.js';
import { rows, pool } from './db.js';
import { config } from './config.js';
import { migrate } from './migrate.js';
try {
  await migrate();
  const [count]=await rows('SELECT COUNT(*) AS total FROM gr_users');
  const app=createApp();
  await app.locals.sessionStore.onReady();
  const server=app.listen(config.port,config.host,()=>{
    console.log(`GestRuisseau : http://${config.host}:${config.port}`);
    if (!count.total) console.log(`Créez votre compte manager : http://${config.host}:${config.port}/initialisation#token=${config.setupToken}`);
  });
  const stop=()=>server.close(async()=>{await app.locals.sessionStore.close();await pool.end();process.exit(0);});
  process.on('SIGINT',stop); process.on('SIGTERM',stop);
  server.on('error',error=>{console.error(`Démarrage impossible : ${error.code}. Vérifiez le port ${config.port}.`);process.exit(1);});
} catch (error) {
  console.error(`Démarrage impossible (${error.code || error.message}). Démarrez WampServer, vérifiez .env et lancez npm run db:init.`);
  await pool.end(); process.exitCode=1;
}
