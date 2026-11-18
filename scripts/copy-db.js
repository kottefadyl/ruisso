// Copie les données de la base locale (WampServer) vers la base configurée dans .env (ex. alwaysdata).
// Usage : npm run db:copy -- --dry-run   (vérifie sans rien écrire)
//         npm run db:copy                (copie réelle)
// Source : SOURCE_DB_HOST / SOURCE_DB_PORT / SOURCE_DB_NAME / SOURCE_DB_USER / SOURCE_DB_PASSWORD
//          (par défaut 127.0.0.1:3306, base ruissau, utilisateur root sans mot de passe).
// La source est seulement lue. La cible doit être vide : rien n’y est jamais écrasé ni supprimé.
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { config } from '../src/config.js';
import { pool } from '../src/db.js';
import { migrate } from '../src/migrate.js';

const dryRun = process.argv.includes('--dry-run');
// Ordre imposé par les clés étrangères. Les sessions de connexion ne sont pas copiées.
const tables = ['gr_settings','gr_centers','gr_users','gr_tariffs','gr_students','gr_teachers','gr_teacher_periods','gr_teacher_sessions','gr_ledger','gr_audit'];
const source = { host:process.env.SOURCE_DB_HOST||'127.0.0.1', port:Number(process.env.SOURCE_DB_PORT||3306), database:process.env.SOURCE_DB_NAME||'ruissau', user:process.env.SOURCE_DB_USER||'root', password:process.env.SOURCE_DB_PASSWORD||'', charset:'utf8mb4', timezone:'Z', dateStrings:true };
const target = config.db;
const label = c => `${c.user}@${c.host}:${c.port}/${c.database}`;
const plain = value => value !== null && typeof value === 'object' && !Buffer.isBuffer(value) ? JSON.stringify(value) : value;

let from;
try {
  if (source.host===target.host && source.port===target.port && source.database===target.database) throw new Error('La source et la cible sont identiques : modifiez DB_* dans .env pour pointer vers la base distante.');
  console.log(`Source (lecture seule) : ${label(source)}`);
  console.log(`Cible                  : ${label(target)}${target.ssl?' (connexion chiffrée)':''}`);
  from = await mysql.createConnection(source);
  await pool.query('SELECT 1');
  if (!dryRun) await migrate(pool);
  const plan = [];
  for (const table of tables) {
    const [[exists]] = await from.query('SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[table]);
    const rowsToCopy = exists.n ? (await from.query(`SELECT * FROM \`${table}\` ORDER BY 1`))[0] : [];
    const [[targetTable]] = await pool.query('SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[table]);
    const already = targetTable.n ? (await pool.query(`SELECT COUNT(*) AS n FROM \`${table}\``))[0][0].n : 0;
    plan.push({ table, rows:rowsToCopy, already });
  }
  for (const p of plan) console.log(`  ${p.table.padEnd(22)} ${String(p.rows.length).padStart(6)} ligne(s) à copier${p.already?` — ${p.already} déjà présente(s) dans la cible`:''}`);
  const busy = plan.filter(p=>p.already);
  if (busy.length) throw new Error(`La cible contient déjà des données (${busy.map(p=>p.table).join(', ')}). Copie annulée pour ne rien écraser. N’exécutez pas « npm run db:init » sur la cible avant la copie.`);
  if (dryRun) { console.log('Vérification terminée : rien n’a été écrit (--dry-run).'); }
  else {
    const db = await pool.getConnection();
    try {
      await db.beginTransaction();
      for (const { table, rows } of plan) {
        if (!rows.length) continue;
        const [targetColumns] = await db.query('SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[table]);
        const columns = Object.keys(rows[0]).filter(c=>targetColumns.some(t=>t.name===c));
        for (let i=0;i<rows.length;i+=200) {
          const batch = rows.slice(i,i+200).map(r=>columns.map(c=>plain(r[c])));
          await db.query(`INSERT INTO \`${table}\` (${columns.map(c=>`\`${c}\``).join(',')}) VALUES ?`,[batch]);
        }
      }
      await db.commit();
    } catch (error) { await db.rollback(); throw error; } finally { db.release(); }
    for (const { table, rows } of plan) {
      const [[count]] = await pool.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
      if (count.n !== rows.length) throw new Error(`Contrôle échoué pour ${table} : ${count.n} au lieu de ${rows.length}.`);
    }
    console.log('Copie terminée et contrôlée : chaque table de la cible contient le même nombre de lignes que la source.');
  }
} catch (error) {
  console.error(`Copie impossible : ${error.message || error.code}`);
  process.exitCode = 1;
} finally { await from?.end(); await pool.end(); }
