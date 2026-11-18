import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// Chaque exécution possède sa base jetable sur le serveur de test local (TEST_DB_*),
// même si .env pointe vers une base distante : aucune table de production n’est modifiée.
export async function createTestDatabase() {
  const database = `ruissau_test_${Date.now()}_${randomBytes(4).toString('hex')}`;
  const server = { host:process.env.TEST_DB_HOST||'127.0.0.1', port:Number(process.env.TEST_DB_PORT||3306), user:process.env.TEST_DB_USER||'root', password:process.env.TEST_DB_PASSWORD||'' };
  Object.assign(process.env,{DB_HOST:server.host,DB_PORT:String(server.port),DB_USER:server.user,DB_PASSWORD:server.password,DB_SSL:'0'});
  const admin=await mysql.createConnection(server);
  await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4`);
  await admin.query(`USE \`${database}\``);
  try {
    for(const sql of readFileSync(new URL('../database/schema.sql',import.meta.url),'utf8').split(';').map(x=>x.trim()).filter(Boolean)) await admin.query(sql);
    await admin.query("INSERT INTO gr_settings VALUES (1,'2026-2027')");
    await admin.query("INSERT INTO gr_centers (name,address,phone) VALUES ('Biyem-Assi','Biyem-Assi, lac — Yaoundé','+237 652 25 11 44'),('Mendong','Collège Champ du Lys — Yaoundé','+237 695 62 54 87'),('Ngoa Ekélé','École primaire — Yaoundé','+237 652 25 11 44')");
    await admin.query("INSERT INTO gr_tariffs (name,amount,duration_days) VALUES ('Mensualité',5000,30),('Inscription',2500,0)");
    process.env.DB_NAME=database;
    process.env.NODE_ENV='test';
    process.env.SESSION_SECRET=randomBytes(48).toString('hex');
    process.env.SETUP_TOKEN=randomBytes(32).toString('hex');
  } catch(error) {await admin.end();throw error;}
  return async()=>{
    if(!/^ruissau_test_\d+_[a-f0-9]{8}$/.test(database)) throw new Error('Nettoyage refusé : base non temporaire.');
    await admin.query(`DROP DATABASE \`${database}\``);
    await admin.end();
  };
}
