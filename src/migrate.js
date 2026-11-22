import { readFileSync } from 'node:fs';
import { pool } from './db.js';

export const defaultSubjects = ['Mathématiques','Physique','Chimie','Sciences de la vie et de la Terre','Français','Anglais','Histoire','Géographie','Philosophie','Littérature','Espagnol','Allemand','Informatique','Éducation civique et morale','Économie'];

// Crée les tables manquantes puis met à niveau une base existante, sans rien supprimer.
export async function migrate(db = pool) {
  for (const statement of readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8').split(';').map(s => s.trim()).filter(Boolean)) await db.query(statement);
  const columns = async table => new Set((await db.query('SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?', [table]))[0].map(c => c.name));
  const done = [];
  let ledger = await columns('gr_ledger');
  if (!ledger.has('teacher_id')) {
    await db.query(`ALTER TABLE gr_ledger
      MODIFY kind ENUM('payment','income','expense','opening','reversal','salary','advance') NOT NULL,
      ADD COLUMN teacher_id INT UNSIGNED NULL AFTER tariff_id,
      ADD COLUMN period CHAR(7) NULL AFTER teacher_id,
      ADD CONSTRAINT gr_ledger_teacher_fk FOREIGN KEY (teacher_id) REFERENCES gr_teachers(id),
      ADD INDEX gr_ledger_teacher (teacher_id, period)`);
    done.push('paie des enseignants');
    ledger = await columns('gr_ledger');
  }
  // Novembre 2026 : reprise comptable, reçus numérotés, transferts entre caisses, justificatifs.
  if (!ledger.has('receipt_number')) {
    await db.query(`ALTER TABLE gr_ledger
      MODIFY kind ENUM('payment','income','expense','opening','reversal','salary','advance','transfer','remittance') NOT NULL,
      ADD COLUMN beneficiary VARCHAR(140) NOT NULL DEFAULT '' AFTER description,
      ADD COLUMN receipt_number VARCHAR(20) NULL UNIQUE AFTER beneficiary,
      ADD COLUMN receipt_ref VARCHAR(60) NULL AFTER receipt_number,
      ADD COLUMN due_amount INT NULL AFTER receipt_ref,
      ADD COLUMN balance_after INT NULL AFTER due_amount,
      ADD COLUMN source ENUM('live','reprise') NOT NULL DEFAULT 'live' AFTER balance_after,
      ADD COLUMN attachment_file_id INT UNSIGNED NULL AFTER source,
      ADD COLUMN missing_doc BOOLEAN NOT NULL DEFAULT FALSE AFTER attachment_file_id,
      ADD COLUMN link_id INT UNSIGNED NULL AFTER missing_doc,
      ADD CONSTRAINT gr_ledger_file_fk FOREIGN KEY (attachment_file_id) REFERENCES gr_files(id),
      ADD UNIQUE INDEX gr_ledger_receipt_ref (center_id, receipt_ref)`);
    // Numérotation des reçus déjà émis, dans l’ordre chronologique, par année.
    const [payments] = await db.query("SELECT id,CAST(YEAR(operation_date) AS CHAR) AS year FROM gr_ledger WHERE kind='payment' ORDER BY operation_date,id");
    const counters = {};
    for (const p of payments) {
      const year = String(p.year); counters[year] = (counters[year] || 0) + 1;
      await db.query('UPDATE gr_ledger SET receipt_number=? WHERE id=?', [`REC-${year}-${String(counters[year]).padStart(6, '0')}`, p.id]);
    }
    for (const [year, value] of Object.entries(counters)) await db.query('INSERT INTO gr_counters (name,value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=GREATEST(value,VALUES(value))', [`receipt-${year}`, value]);
    done.push('reçus numérotés, transferts et justificatifs');
  }
  const students = await columns('gr_students');
  if (!students.has('quarter')) {
    await db.query(`ALTER TABLE gr_students
      ADD COLUMN quarter VARCHAR(100) NOT NULL DEFAULT '' AFTER parent_email,
      ADD COLUMN school_status ENUM('nouveau','redoublant') NOT NULL DEFAULT 'nouveau' AFTER quarter,
      ADD COLUMN enrolled_on DATE NULL AFTER school_status,
      ADD COLUMN source ENUM('live','reprise') NOT NULL DEFAULT 'live' AFTER enrolled_on`);
    await db.query('UPDATE gr_students SET enrolled_on=DATE(created_at) WHERE enrolled_on IS NULL');
    done.push('quartier et statut scolaire des élèves');
  }
  const teachers = await columns('gr_teachers');
  if (!teachers.has('matricule')) {
    await db.query(`ALTER TABLE gr_teachers
      ADD COLUMN matricule VARCHAR(30) NULL UNIQUE AFTER id,
      ADD COLUMN last_name VARCHAR(80) NOT NULL DEFAULT '' AFTER name,
      ADD COLUMN first_name VARCHAR(80) NOT NULL DEFAULT '' AFTER last_name,
      ADD COLUMN address VARCHAR(240) NOT NULL DEFAULT '' AFTER first_name,
      ADD COLUMN grade VARCHAR(80) NOT NULL DEFAULT '' AFTER address,
      ADD COLUMN email VARCHAR(190) NOT NULL DEFAULT '' AFTER grade,
      ADD COLUMN photo_file_id INT UNSIGNED NULL AFTER email,
      ADD CONSTRAINT gr_teacher_photo_fk FOREIGN KEY (photo_file_id) REFERENCES gr_files(id)`);
    // Les fiches existantes gardent leur nom complet ; le dossier est à compléter à la prochaine modification.
    await db.query("UPDATE gr_teachers SET last_name=LEFT(name,80) WHERE last_name=''");
    done.push('dossier enseignant');
  }
  const settings = await columns('gr_settings');
  if (!settings.has('reprise_start')) {
    await db.query("ALTER TABLE gr_settings ADD COLUMN reprise_start DATE NOT NULL DEFAULT '2026-11-05'");
    done.push('période de reprise');
  }
  const [[subjectCount]] = await db.query('SELECT COUNT(*) AS total FROM gr_subjects');
  if (!subjectCount.total) await db.query(`INSERT INTO gr_subjects (name) VALUES ${defaultSubjects.map(() => '(?)').join(',')}`, defaultSubjects);
  if (done.length) console.log(`Base mise à niveau : ${done.join(', ')}.`);
}
