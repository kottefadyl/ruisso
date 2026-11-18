import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (!existsSync('.env')) {
  let env = readFileSync('.env.example', 'utf8');
  env = env.replace('replace-with-at-least-48-random-characters', randomBytes(48).toString('hex')).replace('replace-with-at-least-32-random-characters', randomBytes(32).toString('hex'));
  writeFileSync('.env', env, { mode: 0o600, flag: 'wx' });
  console.log('Configuration locale .env créée.');
}
const { pool, rows, transaction } = await import('../src/db.js');
const { migrate } = await import('../src/migrate.js');
try {
  await migrate();
  await transaction(async db => {
    const year = new Date().getFullYear();
    await rows('INSERT IGNORE INTO gr_settings (id, school_year) VALUES (1, ?)', [`${year}-${year + 1}`], db);
    if (!(await rows('SELECT id FROM gr_centers LIMIT 1', [], db)).length) {
      await rows('INSERT INTO gr_centers (name,address,phone) VALUES (?,?,?),(?,?,?),(?,?,?)', ['Biyem-Assi','Biyem-Assi, lac — Yaoundé','+237 652 25 11 44','Ngoa Ekélé','École primaire Camps Génie, face Génie militaire — Yaoundé','+237 695 62 54 87','Mendong','Collège Champ du Lys — Yaoundé','+237 652 25 11 44'], db);
    }
    if (!(await rows('SELECT id FROM gr_tariffs LIMIT 1', [], db)).length) await rows('INSERT INTO gr_tariffs (name,amount,duration_days) VALUES (?,?,?),(?,?,?),(?,?,?),(?,?,?)', ['Inscription',2500,0,'Répétition · 4e / 3e',5000,30,'Répétition · Première A',6000,30,'Répétition · Terminale A',7000,30], db);
  });
  console.log('Base prête : tables gr_* (paie des enseignants incluse), trois sièges et tarifs de départ. Aucun élève ni paiement fictif ajouté.');
} catch (error) {
  console.error(`Initialisation impossible (${error.code || 'erreur'}). Vérifiez WampServer et les paramètres DB_* dans .env.`);
  process.exitCode = 1;
} finally { await pool.end(); }
