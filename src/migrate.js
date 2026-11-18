import { readFileSync } from 'node:fs';
import { pool } from './db.js';

// Crée les tables manquantes puis met à niveau une base V1 existante, sans rien supprimer.
export async function migrate(db = pool) {
  for (const statement of readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8').split(';').map(s => s.trim()).filter(Boolean)) await db.query(statement);
  const [[column]] = await db.query("SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gr_ledger' AND COLUMN_NAME='teacher_id'");
  if (!column.total) {
    await db.query(`ALTER TABLE gr_ledger
      MODIFY kind ENUM('payment','income','expense','opening','reversal','salary','advance') NOT NULL,
      ADD COLUMN teacher_id INT UNSIGNED NULL AFTER tariff_id,
      ADD COLUMN period CHAR(7) NULL AFTER teacher_id,
      ADD CONSTRAINT gr_ledger_teacher_fk FOREIGN KEY (teacher_id) REFERENCES gr_teachers(id),
      ADD INDEX gr_ledger_teacher (teacher_id, period)`);
    console.log('Base mise à niveau : paie des enseignants.');
  }
}
