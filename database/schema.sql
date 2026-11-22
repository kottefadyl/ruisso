CREATE TABLE IF NOT EXISTS gr_settings (
  id INT PRIMARY KEY,
  school_year VARCHAR(9) NOT NULL,
  reprise_start DATE NOT NULL DEFAULT '2026-11-05'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gr_centers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  address VARCHAR(240) NOT NULL,
  phone VARCHAR(30) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gr_users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('manager','secretary') NOT NULL,
  center_id INT UNSIGNED NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  auth_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (center_id) REFERENCES gr_centers(id),
  CONSTRAINT gr_user_scope CHECK ((role='manager' AND center_id IS NULL) OR (role='secretary' AND center_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gr_tariffs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  amount INT UNSIGNED NOT NULL,
  duration_days SMALLINT UNSIGNED NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fichiers (photos, sujets PDF, justificatifs) stockés en base : l’hébergement Vercel n’a pas de disque persistant.
CREATE TABLE IF NOT EXISTS gr_files (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purpose ENUM('photo','exam','justificatif') NOT NULL,
  original_name VARCHAR(200) NOT NULL,
  mime VARCHAR(60) NOT NULL,
  size INT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  data LONGBLOB NOT NULL,
  center_id INT UNSIGNED NULL,
  uploaded_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (center_id) REFERENCES gr_centers(id),
  FOREIGN KEY (uploaded_by) REFERENCES gr_users(id),
  INDEX gr_file_hash (sha256)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gr_subjects (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Compteurs de numérotation (reçus REC-AAAA-NNNNNN, épreuves EP-AAAA-NNNN).
CREATE TABLE IF NOT EXISTS gr_counters (
  name VARCHAR(40) PRIMARY KEY,
  value INT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gr_students (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  name VARCHAR(140) NOT NULL,
  class_name VARCHAR(60) NOT NULL,
  group_name VARCHAR(80) NOT NULL DEFAULT '',
  school_year VARCHAR(9) NOT NULL,
  parent_name VARCHAR(140) NOT NULL,
  parent_phone VARCHAR(30) NOT NULL,
  parent_email VARCHAR(190) NOT NULL DEFAULT '',
  quarter VARCHAR(100) NOT NULL DEFAULT '',
  school_status ENUM('nouveau','redoublant') NOT NULL DEFAULT 'nouveau',
  enrolled_on DATE NULL,
  source ENUM('live','reprise') NOT NULL DEFAULT 'live',
  notes VARCHAR(1000) NOT NULL DEFAULT '',
  valid_until DATE NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (center_id) REFERENCES gr_centers(id),
  FOREIGN KEY (created_by) REFERENCES gr_users(id),
  INDEX gr_student_scope (center_id, school_year),
  INDEX gr_student_validity (valid_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gr_teachers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  matricule VARCHAR(30) NULL UNIQUE,
  name VARCHAR(140) NOT NULL,
  last_name VARCHAR(80) NOT NULL DEFAULT '',
  first_name VARCHAR(80) NOT NULL DEFAULT '',
  address VARCHAR(240) NOT NULL DEFAULT '',
  grade VARCHAR(80) NOT NULL DEFAULT '',
  email VARCHAR(190) NOT NULL DEFAULT '',
  photo_file_id INT UNSIGNED NULL,
  phone VARCHAR(30) NOT NULL DEFAULT '',
  subjects VARCHAR(200) NOT NULL DEFAULT '',
  pay_type ENUM('hourly','monthly') NOT NULL,
  hourly_rate INT UNSIGNED NOT NULL DEFAULT 0,
  monthly_salary INT UNSIGNED NOT NULL DEFAULT 0,
  hired_on DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes VARCHAR(1000) NOT NULL DEFAULT '',
  created_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES gr_users(id),
  CONSTRAINT gr_teacher_photo_fk FOREIGN KEY (photo_file_id) REFERENCES gr_files(id),
  CONSTRAINT gr_teacher_pay CHECK ((pay_type='hourly' AND hourly_rate>0) OR (pay_type='monthly' AND monthly_salary>0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gr_teacher_subjects (
  teacher_id INT UNSIGNED NOT NULL,
  subject_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (teacher_id, subject_id),
  FOREIGN KEY (teacher_id) REFERENCES gr_teachers(id),
  FOREIGN KEY (subject_id) REFERENCES gr_subjects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Barème figé d’un mois dès la première avance ou le premier versement.
CREATE TABLE IF NOT EXISTS gr_teacher_periods (
  teacher_id INT UNSIGNED NOT NULL,
  period CHAR(7) NOT NULL,
  pay_type ENUM('hourly','monthly') NOT NULL,
  monthly_salary INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (teacher_id, period),
  FOREIGN KEY (teacher_id) REFERENCES gr_teachers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gr_teacher_sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_key CHAR(36) NOT NULL UNIQUE,
  teacher_id INT UNSIGNED NOT NULL,
  center_id INT UNSIGNED NOT NULL,
  session_date DATE NOT NULL,
  minutes SMALLINT UNSIGNED NOT NULL,
  subject VARCHAR(100) NOT NULL DEFAULT '',
  class_name VARCHAR(100) NOT NULL DEFAULT '',
  rate INT UNSIGNED NOT NULL,
  amount INT UNSIGNED NOT NULL,
  cancelled_at TIMESTAMP NULL,
  cancelled_by INT UNSIGNED NULL,
  cancel_reason VARCHAR(250) NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES gr_teachers(id),
  FOREIGN KEY (center_id) REFERENCES gr_centers(id),
  FOREIGN KEY (created_by) REFERENCES gr_users(id),
  FOREIGN KEY (cancelled_by) REFERENCES gr_users(id),
  INDEX gr_session_teacher (teacher_id, session_date),
  INDEX gr_session_center (center_id, session_date),
  CONSTRAINT gr_session_minutes CHECK (minutes > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gr_ledger (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(40) NOT NULL UNIQUE,
  request_key CHAR(36) NOT NULL UNIQUE,
  center_id INT UNSIGNED NOT NULL,
  student_id INT UNSIGNED NULL,
  tariff_id INT UNSIGNED NULL,
  teacher_id INT UNSIGNED NULL,
  period CHAR(7) NULL,
  amount INT NOT NULL,
  kind ENUM('payment','income','expense','opening','reversal','salary','advance','transfer','remittance') NOT NULL,
  category VARCHAR(100) NOT NULL,
  description VARCHAR(300) NOT NULL,
  beneficiary VARCHAR(140) NOT NULL DEFAULT '',
  receipt_number VARCHAR(20) NULL UNIQUE,
  receipt_ref VARCHAR(60) NULL,
  due_amount INT NULL,
  balance_after INT NULL,
  source ENUM('live','reprise') NOT NULL DEFAULT 'live',
  attachment_file_id INT UNSIGNED NULL,
  missing_doc BOOLEAN NOT NULL DEFAULT FALSE,
  link_id INT UNSIGNED NULL,
  method ENUM('cash','mtn','orange','bank') NOT NULL,
  duration_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  operation_date DATE NOT NULL,
  reversal_of INT UNSIGNED NULL UNIQUE,
  author_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (center_id) REFERENCES gr_centers(id),
  FOREIGN KEY (student_id) REFERENCES gr_students(id),
  FOREIGN KEY (tariff_id) REFERENCES gr_tariffs(id),
  CONSTRAINT gr_ledger_teacher_fk FOREIGN KEY (teacher_id) REFERENCES gr_teachers(id),
  FOREIGN KEY (reversal_of) REFERENCES gr_ledger(id),
  FOREIGN KEY (author_id) REFERENCES gr_users(id),
  CONSTRAINT gr_ledger_file_fk FOREIGN KEY (attachment_file_id) REFERENCES gr_files(id),
  UNIQUE INDEX gr_ledger_receipt_ref (center_id, receipt_ref),
  INDEX gr_ledger_scope (center_id, operation_date),
  INDEX gr_ledger_student (student_id),
  INDEX gr_ledger_teacher (teacher_id, period),
  CONSTRAINT gr_nonzero_amount CHECK (amount <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Comptage physique de l’argent d’une caisse (reprise et contrôles).
CREATE TABLE IF NOT EXISTS gr_cash_counts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  count_date DATE NOT NULL,
  cash_amount INT NOT NULL,
  other_amount INT NOT NULL DEFAULT 0,
  notes VARCHAR(500) NOT NULL DEFAULT '',
  counted_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (center_id) REFERENCES gr_centers(id),
  FOREIGN KEY (counted_by) REFERENCES gr_users(id),
  INDEX gr_count_center (center_id, count_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Validation de la reprise d’un siège par le promoteur. Une réouverture garde l’ancienne validation.
CREATE TABLE IF NOT EXISTS gr_reprise_validations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  cutoff_date DATE NOT NULL,
  theoretical INT NOT NULL,
  physical INT NOT NULL,
  gap INT NOT NULL,
  explanation VARCHAR(1000) NOT NULL DEFAULT '',
  snapshot JSON NULL,
  validated_by INT UNSIGNED NOT NULL,
  validated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  revoked_by INT UNSIGNED NULL,
  revoke_reason VARCHAR(250) NULL,
  FOREIGN KEY (center_id) REFERENCES gr_centers(id),
  FOREIGN KEY (validated_by) REFERENCES gr_users(id),
  FOREIGN KEY (revoked_by) REFERENCES gr_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Banque numérique d’épreuves (sujets PDF).
CREATE TABLE IF NOT EXISTS gr_exams (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  subject_id INT UNSIGNED NOT NULL,
  class_name VARCHAR(60) NOT NULL,
  sequence VARCHAR(60) NOT NULL,
  school_year VARCHAR(9) NOT NULL,
  file_id INT UNSIGNED NOT NULL,
  teacher_id INT UNSIGNED NULL,
  notes VARCHAR(500) NOT NULL DEFAULT '',
  uploaded_by INT UNSIGNED NOT NULL,
  center_id INT UNSIGNED NULL,
  archived_at TIMESTAMP NULL,
  archived_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES gr_subjects(id),
  FOREIGN KEY (file_id) REFERENCES gr_files(id),
  FOREIGN KEY (teacher_id) REFERENCES gr_teachers(id),
  FOREIGN KEY (uploaded_by) REFERENCES gr_users(id),
  FOREIGN KEY (center_id) REFERENCES gr_centers(id),
  FOREIGN KEY (archived_by) REFERENCES gr_users(id),
  INDEX gr_exam_search (subject_id, class_name, sequence, school_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gr_audit (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_id INT UNSIGNED NULL,
  center_id INT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id INT UNSIGNED NULL,
  details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES gr_users(id),
  FOREIGN KEY (center_id) REFERENCES gr_centers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gr_http_sessions (
  session_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
