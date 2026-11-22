import express from 'express';
import session from 'express-session';
import mysqlSession from 'express-mysql-session';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { pool, rows, transaction } from './db.js';
import { config } from './config.js';
import { schemas, id, schoolYear, today, calculateValidity, validity, centerScope, ensureScope, HttpError, period as periodSchema, periodBounds, sessionAmount, payrollSummary, normalizeName, isoDate } from './domain.js';

const publicPath = fileURLToPath(new URL('../public/', import.meta.url));
const safeUser = u => ({ id:u.id, name:u.name, email:u.email, role:u.role, center_id:u.center_id });
const secureEqual = (a,b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
const asyncSession = (s, method) => new Promise((resolve,reject) => s[method](error => error ? reject(error) : resolve()));
const audit = (db, user, action, entity, entityId, details = null, center = user?.center_id ?? null) => rows('INSERT INTO gr_audit (actor_id,center_id,action,entity,entity_id,details) VALUES (?,?,?,?,?,?)', [user?.id ?? null,center,action,entity,entityId,details ? JSON.stringify(details) : null],db);
const reference = () => `GR-${today().replaceAll('-','')}-${randomBytes(6).toString('hex').toUpperCase()}`;
const manager = (req,res,next) => req.user.role === 'manager' ? next() : next(new HttpError(403,'Cette action est réservée au manager.'));

async function findStudent(user, studentId, db = pool, lock = false) {
  const [student] = await rows(`SELECT * FROM gr_students WHERE id=?${lock ? ' FOR UPDATE' : ''}`, [id.parse(studentId)],db);
  if (!student) throw new HttpError(404,'Élève introuvable.');
  ensureScope(user,student.center_id);
  return student;
}
async function checkCenter(centerId,db=pool) {
  if (!(await rows('SELECT id FROM gr_centers WHERE id=?',[centerId],db)).length) throw new HttpError(404,'Siège introuvable.');
}
async function refreshValidity(studentId,db) {
  const payments = await rows(`SELECT l.operation_date,l.duration_days,l.amount,l.due_amount,l.tariff_id,l.period FROM gr_ledger l LEFT JOIN gr_ledger r ON r.reversal_of=l.id WHERE l.student_id=? AND l.kind='payment' AND r.id IS NULL ORDER BY l.operation_date,l.id`,[studentId],db);
  const end = calculateValidity(payments);
  await rows('UPDATE gr_students SET valid_until=? WHERE id=?',[end,studentId],db);
  return end;
}
const ledgerSelect = `SELECT l.*,c.name AS center_name,u.name AS author_name,s.name AS student_name,s.class_name,s.school_year AS student_school_year,t.name AS teacher_name,r.id AS reversed_by,lc.name AS link_center_name,f.original_name AS attachment_name FROM gr_ledger l JOIN gr_centers c ON c.id=l.center_id JOIN gr_users u ON u.id=l.author_id LEFT JOIN gr_students s ON s.id=l.student_id LEFT JOIN gr_teachers t ON t.id=l.teacher_id LEFT JOIN gr_ledger r ON r.reversal_of=l.id LEFT JOIN gr_ledger lk ON lk.id=l.link_id LEFT JOIN gr_centers lc ON lc.id=lk.center_id LEFT JOIN gr_files f ON f.id=l.attachment_file_id`;
// Numérotation continue sous verrou : deux reçus simultanés ne reçoivent jamais le même numéro.
async function nextNumber(name,db) {
  await rows('INSERT IGNORE INTO gr_counters (name,value) VALUES (?,0)',[name],db);
  const [counter]=await rows('SELECT value FROM gr_counters WHERE name=? FOR UPDATE',[name],db);
  await rows('UPDATE gr_counters SET value=value+1 WHERE name=?',[name],db);
  return Number(counter.value)+1;
}
const receiptNumber = async (date,db) => `REC-${date.slice(0,4)}-${String(await nextNumber(`receipt-${date.slice(0,4)}`,db)).padStart(6,'0')}`;
async function activeValidation(centerId,db=pool) {
  const [v]=await rows('SELECT v.id,v.center_id,v.cutoff_date,v.theoretical,v.physical,v.gap,v.explanation,v.validated_at,u.name AS validated_by_name FROM gr_reprise_validations v JOIN gr_users u ON u.id=v.validated_by WHERE v.center_id=? AND v.revoked_at IS NULL ORDER BY v.id DESC LIMIT 1',[centerId],db);
  return v||null;
}
const frDate = d => String(d).slice(0,10).split('-').reverse().join('/');
// Date d’une opération : aujourd’hui, ou date réelle passée pendant la reprise d’un siège non encore validé.
async function operationDate(data,centerId,db) {
  if (!data.reprise) return {date:today(),source:'live'};
  if (!data.operation_date) throw new HttpError(400,'Indiquez la date réelle de l’opération.');
  const [settings]=await rows('SELECT reprise_start FROM gr_settings WHERE id=1',[],db);
  const start=String(settings.reprise_start).slice(0,10);
  if (data.operation_date<start || data.operation_date>today()) throw new HttpError(400,`La date réelle doit être comprise entre le ${frDate(start)} et aujourd’hui.`);
  if (await activeValidation(centerId,db)) throw new HttpError(409,'La reprise de ce siège est déjà validée par le promoteur. Les corrections se font par annulation tracée.');
  return {date:data.operation_date,source:'reprise'};
}
async function checkAttachment(fileId,centerId,db) {
  if (!fileId) return null;
  const [file]=await rows("SELECT id,center_id FROM gr_files WHERE id=? AND purpose='justificatif'",[fileId],db);
  if (!file) throw new HttpError(400,'Justificatif introuvable. Joignez-le à nouveau.');
  if (file.center_id && file.center_id!==Number(centerId)) throw new HttpError(403,'Ce justificatif appartient à un autre siège.');
  return file.id;
}
async function checkReceiptRef(ref,centerId,db) {
  if (!ref) return null;
  const [found]=await rows('SELECT reference FROM gr_ledger WHERE center_id=? AND receipt_ref=?',[centerId,ref],db);
  if (found) throw new HttpError(409,`Le reçu n° ${ref} est déjà enregistré pour ce siège (opération ${found.reference}).`);
  return ref;
}
// Doublon probable : refusé sauf confirmation explicite de l’utilisateur.
const duplicate = (data,message) => { if (!data.confirm_duplicate) throw new HttpError(409,message,{duplicate:true}); };
// Échéance d’un élève : tarif + mois concerné (ou tarif seul pour des frais sans durée, comme l’inscription).
async function studentDue(student,tariff,p,db=pool) {
  const [r]=await rows("SELECT COALESCE(SUM(l.amount),0) AS paid FROM gr_ledger l LEFT JOIN gr_ledger r ON r.reversal_of=l.id WHERE l.student_id=? AND l.kind='payment' AND l.tariff_id=? AND l.period <=> ? AND r.id IS NULL",[student.id,tariff.id,p],db);
  const paid=Number(r.paid); return {period:p,due:Number(tariff.amount),paid,remaining:Math.max(0,Number(tariff.amount)-paid)};
}
const addMonths = (p,n) => { const [y,m]=p.split('-').map(Number); return new Date(Date.UTC(y,m-1+n,15)).toISOString().slice(0,7); };
// Mois proposé par défaut : le premier mois non soldé à partir du mois de l’opération.
async function defaultPeriod(student,tariff,date,db=pool) {
  let p=date.slice(0,7);
  for (let i=0;i<24;i++,p=addMonths(p,1)) if ((await studentDue(student,tariff,p,db)).remaining>0) return p;
  return p;
}
// Situation de caisse d’un siège à une date : solde initial + encaissements − dépenses − transferts sortants + transferts reçus.
// Une annulation est rangée dans la catégorie de l’opération qu’elle annule.
async function cashSummary(centerId,until,db=pool) {
  const groups=await rows(`SELECT COALESCE(o.kind,l.kind) AS k,SIGN(COALESCE(o.amount,l.amount)) AS s,l.method='cash' AS cash,COALESCE(SUM(l.amount),0) AS total FROM gr_ledger l LEFT JOIN gr_ledger o ON o.id=l.reversal_of WHERE l.center_id=? AND l.operation_date<=? GROUP BY k,s,cash`,[centerId,until],db);
  const r={opening:0,receipts:0,expenses:0,transfers_out:0,transfers_in:0,theoretical:0,theoretical_cash:0};
  for (const g of groups) {
    const total=Number(g.total); r.theoretical+=total; if (Number(g.cash)) r.theoretical_cash+=total;
    if (g.k==='opening') r.opening+=total;
    else if (['payment','income'].includes(g.k)) r.receipts+=total;
    else if (['expense','salary','advance'].includes(g.k)) r.expenses-=total;
    else if (g.k==='remittance' || (g.k==='transfer' && Number(g.s)<0)) r.transfers_out-=total;
    else if (g.k==='transfer') r.transfers_in+=total;
  }
  return r;
}
async function repriseSummary(center,db=pool) {
  const [settings]=await rows('SELECT reprise_start,school_year FROM gr_settings WHERE id=1',[],db);
  const start=String(settings.reprise_start).slice(0,10);
  const [count]=await rows('SELECT k.*,u.name AS counted_by_name FROM gr_cash_counts k JOIN gr_users u ON u.id=k.counted_by WHERE k.center_id=? ORDER BY k.count_date DESC,k.id DESC LIMIT 1',[center.id],db);
  const until=count?String(count.count_date).slice(0,10):today();
  const cash=await cashSummary(center.id,until,db);
  const [students]=await rows("SELECT COUNT(*) AS total,COALESCE(SUM(enrolled_on>=?),0) AS since_start,COALESCE(SUM(source='reprise'),0) AS reprise FROM gr_students WHERE center_id=? AND school_year=?",[start,center.id,settings.school_year],db);
  const [ops]=await rows(`SELECT COUNT(*) AS total,COALESCE(SUM(l.source='reprise'),0) AS reprise,COALESCE(SUM(l.kind='payment'),0) AS payments,COALESCE(SUM(l.missing_doc=1 AND l.attachment_file_id IS NULL AND r.id IS NULL AND l.kind<>'reversal'),0) AS missing_docs FROM gr_ledger l LEFT JOIN gr_ledger r ON r.reversal_of=l.id WHERE l.center_id=? AND l.operation_date>=?`,[center.id,start],db);
  const physical=count?Number(count.cash_amount)+Number(count.other_amount):null;
  return {center_id:center.id,center_name:center.name,reprise_start:start,until,...cash,
    students:{total:Number(students.total),since_start:Number(students.since_start),reprise:Number(students.reprise)},
    operations:{total:Number(ops.total),reprise:Number(ops.reprise),payments:Number(ops.payments),missing_docs:Number(ops.missing_docs)},
    count:count||null,physical,gap:physical===null?null:physical-cash.theoretical,gap_cash:count?Number(count.cash_amount)-cash.theoretical_cash:null,
    validation:await activeValidation(center.id,db)};
}
const fileTypes = {photo:['image/jpeg','image/png','image/webp'],exam:['application/pdf'],justificatif:['application/pdf','image/jpeg','image/png','image/webp']};
// Contrôle du contenu réel (signature binaire), pas seulement du type annoncé par le navigateur.
const sniff = buf => buf.subarray(0,5).toString('latin1')==='%PDF-' ? 'application/pdf' : buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff ? 'image/jpeg' : buf.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) ? 'image/png' : buf.subarray(0,4).toString('latin1')==='RIFF'&&buf.subarray(8,12).toString('latin1')==='WEBP' ? 'image/webp' : null;
const teacherSelect = `SELECT t.*,(SELECT GROUP_CONCAT(ts.subject_id ORDER BY ts.subject_id) FROM gr_teacher_subjects ts WHERE ts.teacher_id=t.id) AS subject_ids FROM gr_teachers t`;
const withSubjects = t => ({...t,subject_ids:t.subject_ids?String(t.subject_ids).split(',').map(Number):[]});
const currentPeriod = () => today().slice(0,7);
const monthLabel = p => new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${p}-15T12:00:00Z`));
async function findTeacher(teacherId,db=pool,lock=false) {
  const [teacher]=await rows(`SELECT * FROM gr_teachers WHERE id=?${lock?' FOR UPDATE':''}`,[id.parse(teacherId)],db);
  if (!teacher) throw new HttpError(404,'Enseignant introuvable.');
  return teacher;
}
// Situation d’un enseignant pour un mois : barème figé s’il existe, sinon barème actuel.
async function teacherSummary(teacher,p,db=pool) {
  const [start,end]=periodBounds(p);
  const [frozen]=await rows('SELECT pay_type,monthly_salary FROM gr_teacher_periods WHERE teacher_id=? AND period=?',[teacher.id,p],db);
  const [sessions]=await rows('SELECT COALESCE(SUM(minutes),0) AS minutes,COALESCE(SUM(amount),0) AS amount,COUNT(*) AS count FROM gr_teacher_sessions WHERE teacher_id=? AND cancelled_at IS NULL AND session_date BETWEEN ? AND ?',[teacher.id,start,end],db);
  const [paid]=await rows(`SELECT COALESCE(SUM(CASE WHEN l.kind='advance' THEN -l.amount ELSE 0 END),0) AS advances,COALESCE(SUM(CASE WHEN l.kind='salary' THEN -l.amount ELSE 0 END),0) AS paid FROM gr_ledger l LEFT JOIN gr_ledger r ON r.reversal_of=l.id WHERE l.teacher_id=? AND l.period=? AND l.kind IN ('salary','advance') AND r.id IS NULL`,[teacher.id,p],db);
  const rule=frozen||teacher; const hired=String(teacher.hired_on).slice(0,7)<=p;
  return {period:p,pay_type:rule.pay_type,monthly_salary:Number(rule.monthly_salary),frozen:Boolean(frozen),hired,minutes:Number(sessions.minutes),sessions:Number(sessions.count),
    ...payrollSummary({pay_type:rule.pay_type,monthly_salary:hired?rule.monthly_salary:0,sessions_amount:sessions.amount,advances:paid.advances,paid:paid.paid})};
}

export function createApp() {
  if (!config.secret || config.secret.length < 48 || config.secret.startsWith('replace-')) throw new Error('SESSION_SECRET invalide. Exécutez npm run db:init.');
  const app = express();
  const Store = mysqlSession(session);
  const store = new Store({ createDatabaseTable:false, clearExpired:true, expiration:8*3600000, schema:{tableName:'gr_http_sessions'} },pool);
  app.locals.sessionStore = store;
  app.disable('x-powered-by');
  // Derrière le proxy HTTPS de Vercel (VERCEL=1, fourni par la plateforme) : vraie IP du client et cookies sécurisés.
  if (process.env.TRUST_PROXY === '1' || process.env.VERCEL === '1') app.set('trust proxy',1);
  app.use(helmet({ contentSecurityPolicy:{directives:{ 'default-src':["'self'"], 'script-src':["'self'"], 'style-src':["'self'"], 'img-src':["'self'",'data:'], 'font-src':["'self'"], 'connect-src':["'self'"], 'object-src':["'none'"], 'frame-ancestors':["'none'"], 'upgrade-insecure-requests':config.env === 'production' ? [] : null }}, strictTransportSecurity:config.env === 'production' ? undefined : false }));
  app.use(express.json({limit:'32kb'}));
  app.use('/api', (req,res,next) => { res.set('Cache-Control','no-store'); next(); });
  app.use('/api',session({name:'gr.sid', secret:config.secret, store, resave:false, saveUninitialized:false, rolling:true, cookie:{ httpOnly:true, sameSite:'lax', secure:config.env === 'production', maxAge:8*3600000 } }));
  app.use('/api',rateLimit({windowMs:60000,limit:300,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Trop de requêtes. Réessayez dans une minute.'}}));
  app.use('/api',(req,res,next) => {
    if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
    if (!secureEqual(req.get('X-CSRF-Token'),req.session.csrf)) return next(new HttpError(403,'Session de formulaire expirée. Rechargez la page.'));
    next();
  });
  const authLimiter = rateLimit({windowMs:15*60000,limit:10,skipSuccessfulRequests:true,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Trop de tentatives. Réessayez dans 15 minutes.'}});
  async function loadUser(req) {
    if (!req.session.userId) return null;
    const [user] = await rows('SELECT * FROM gr_users WHERE id=?',[req.session.userId]);
    if (!user?.active || user.auth_version !== req.session.authVersion || Date.now()-req.session.authAt > 8*3600000) { await asyncSession(req.session,'destroy'); return null; }
    return user;
  }
  async function signIn(req,user) {
    await asyncSession(req.session,'regenerate');
    Object.assign(req.session,{userId:user.id,authVersion:user.auth_version,authAt:Date.now(),csrf:randomBytes(32).toString('hex')});
    await asyncSession(req.session,'save');
    return {user:safeUser(user),csrf:req.session.csrf};
  }
  app.get('/api/auth/bootstrap',async (req,res) => {
    const user = await loadUser(req);
    if (!req.session) return res.status(401).json({error:'Session expirée. Rechargez la page.'});
    req.session.csrf ||= randomBytes(32).toString('hex');
    const [count] = await rows('SELECT COUNT(*) AS total FROM gr_users');
    res.json({csrf:req.session.csrf,user:user ? safeUser(user) : null,needsSetup:count.total===0});
  });
  app.post('/api/auth/setup',authLimiter,async (req,res) => {
    const data = schemas.setup.parse(req.body);
    if (!config.setupToken || !secureEqual(data.token,config.setupToken)) throw new HttpError(403,'Clé d’initialisation incorrecte. Utilisez le lien affiché au démarrage du serveur.');
    const hash = await bcrypt.hash(data.password,12);
    const user = await transaction(async db => {
      await rows('SELECT id FROM gr_settings WHERE id=1 FOR UPDATE',[],db);
      if ((await rows('SELECT id FROM gr_users LIMIT 1',[],db)).length) throw new HttpError(409,'Le compte manager a déjà été créé.');
      const result = await rows("INSERT INTO gr_users (name,email,password_hash,role) VALUES (?,?,?,'manager')",[data.name,data.email,hash],db);
      const [created] = await rows('SELECT * FROM gr_users WHERE id=?',[result.insertId],db);
      await audit(db,created,'account.setup','user',created.id);
      return created;
    });
    res.status(201).json(await signIn(req,user));
  });
  // Même calcul bcrypt pour une adresse inconnue afin de limiter l’énumération.
  const dummyHash = bcrypt.hashSync(randomBytes(32).toString('hex'),12);
  app.post('/api/auth/login',authLimiter,async (req,res) => {
    const data = schemas.login.parse(req.body);
    const [user] = await rows('SELECT * FROM gr_users WHERE email=?',[data.email]);
    const correct = await bcrypt.compare(data.password,user?.password_hash || dummyHash);
    if (!correct || !user?.active) throw new HttpError(401,'Adresse e-mail ou mot de passe incorrect.');
    await audit(pool,user,'account.login','user',user.id);
    res.json(await signIn(req,user));
  });
  app.use('/api',async (req,res,next) => {
    req.user = await loadUser(req);
    if (!req.user) throw new HttpError(401,'Veuillez vous connecter pour continuer.');
    next();
  });
  app.post('/api/auth/logout',async (req,res) => { await asyncSession(req.session,'destroy'); res.clearCookie('gr.sid',{httpOnly:true,sameSite:'lax',secure:config.env==='production'}).json({ok:true}); });
  app.post('/api/auth/password',authLimiter,async (req,res) => {
    const data = schemas.changePassword.parse(req.body);
    if (!await bcrypt.compare(data.current_password,req.user.password_hash)) throw new HttpError(400,'Le mot de passe actuel est incorrect.');
    const hash = await bcrypt.hash(data.password,12);
    await transaction(async db => {
      await rows('UPDATE gr_users SET password_hash=?,auth_version=auth_version+1 WHERE id=?',[hash,req.user.id],db);
      await audit(db,req.user,'account.password_changed','user',req.user.id);
    });
    await asyncSession(req.session,'destroy');
    res.clearCookie('gr.sid').json({ok:true});
  });
  app.get('/api/meta',async (req,res) => {
    const center = centerScope(req.user);
    const [centers,tariffs,settings,subjects,transferCenters] = await Promise.all([
      rows(`SELECT c.*,(SELECT COUNT(*) FROM gr_reprise_validations v WHERE v.center_id=c.id AND v.revoked_at IS NULL) AS reprise_validated FROM gr_centers c${center ? ' WHERE c.id=?' : ''} ORDER BY c.name`,center ? [center] : []),
      rows('SELECT * FROM gr_tariffs ORDER BY amount'),rows('SELECT * FROM gr_settings WHERE id=1'),rows('SELECT * FROM gr_subjects ORDER BY name'),rows('SELECT id,name FROM gr_centers ORDER BY name'),
    ]);
    const years = await rows(`SELECT DISTINCT school_year FROM gr_students${center ? ' WHERE center_id=?' : ''} ORDER BY school_year DESC`,center ? [center] : []);
    res.json({centers,tariffs,subjects,transfer_centers:transferCenters,school_year:settings[0].school_year,reprise_start:String(settings[0].reprise_start).slice(0,10),years:[...new Set([settings[0].school_year,...years.map(y=>y.school_year)])],today:today()});
  });
  app.get('/api/dashboard',async (req,res) => {
    const center = centerScope(req.user,req.query.center_id);
    const year = req.query.school_year ? schoolYear.parse(req.query.school_year) : (await rows('SELECT school_year FROM gr_settings WHERE id=1'))[0].school_year;
    const scope = center ? ' AND center_id=?' : '';
    const params = center ? [center] : [];
    const [students] = await rows(`SELECT COUNT(*) AS total,COALESCE(SUM(valid_until>?),0) AS active,COALESCE(SUM(valid_until>? AND DATEDIFF(valid_until,?)<=20),0) AS expiring,COALESCE(SUM(valid_until IS NULL OR valid_until<=?),0) AS unpaid FROM gr_students WHERE school_year=?${scope}`,[today(),today(),today(),today(),year,...params]);
    const [finance] = await rows(`SELECT COALESCE(SUM(amount),0) AS balance,COALESCE(SUM(CASE WHEN operation_date=? AND amount>0 THEN amount ELSE 0 END),0) AS today_income,COALESCE(SUM(CASE WHEN operation_date=? AND amount<0 THEN -amount ELSE 0 END),0) AS today_expenses FROM gr_ledger WHERE 1=1${scope}`,[today(),today(),...params]);
    const centers = await rows(`SELECT c.*,(SELECT COUNT(*) FROM gr_students s WHERE s.center_id=c.id AND school_year=?) AS student_count,(SELECT COALESCE(SUM(amount),0) FROM gr_ledger l WHERE l.center_id=c.id) AS balance,(SELECT COUNT(*) FROM gr_users u WHERE u.center_id=c.id AND active=1) AS secretary_count FROM gr_centers c${center ? ' WHERE c.id=?' : ''} ORDER BY c.name`,[year,...params]);
    const recent = await rows(`${ledgerSelect}${center ? ' WHERE l.center_id=?' : ''} ORDER BY l.id DESC LIMIT 6`,params);
    const alerts = await rows(`SELECT s.*,c.name AS center_name FROM gr_students s JOIN gr_centers c ON c.id=s.center_id WHERE s.school_year=? AND (s.valid_until IS NULL OR DATEDIFF(s.valid_until,?)<=20)${center ? ' AND s.center_id=?' : ''} ORDER BY s.valid_until,s.name LIMIT 6`,[year,today(),...params]);
    const chart = await rows(`SELECT operation_date,COALESCE(SUM(CASE WHEN amount>0 THEN amount ELSE 0 END),0) AS income,COALESCE(SUM(CASE WHEN amount<0 THEN -amount ELSE 0 END),0) AS expenses FROM gr_ledger WHERE operation_date>=DATE_SUB(?,INTERVAL 6 DAY)${scope} GROUP BY operation_date ORDER BY operation_date`,[today(),...params]);
    res.json({students,finance,centers,recent,alerts:alerts.map(s=>({...s,validity:validity(s.valid_until)})),chart,school_year:year});
  });
  app.get('/api/students',async (req,res) => {
    const center = centerScope(req.user,req.query.center_id);
    const where = ['1=1']; const params=[];
    if (center) {where.push('s.center_id=?');params.push(center);}
    if (req.query.school_year) {where.push('s.school_year=?');params.push(schoolYear.parse(req.query.school_year));}
    if (req.query.q) {
      const q=String(req.query.q).slice(0,100);
      where.push('(s.name LIKE ? OR s.parent_phone LIKE ? OR s.class_name LIKE ? OR s.group_name LIKE ? OR s.quarter LIKE ?)'); params.push(...Array(5).fill(`%${q}%`));
    }
    const clauses={unpaid:'s.valid_until IS NULL',expired:'s.valid_until<=?',expiring:'s.valid_until>? AND DATEDIFF(s.valid_until,?)<=20',active:'s.valid_until>?'};
    if (req.query.status && Object.hasOwn(clauses,req.query.status)) {
      where.push(clauses[req.query.status]);
      params.push(...Array((clauses[req.query.status].match(/\?/g)||[]).length).fill(today()));
    }
    const page=Math.max(1,Math.min(100000,Number.parseInt(req.query.page)||1)); const limit=25;
    const [count]=await rows(`SELECT COUNT(*) AS total FROM gr_students s WHERE ${where.join(' AND ')}`,params);
    const students=await rows(`SELECT s.*,c.name AS center_name FROM gr_students s JOIN gr_centers c ON c.id=s.center_id WHERE ${where.join(' AND ')} ORDER BY s.id DESC LIMIT ${limit} OFFSET ${(page-1)*limit}`,params);
    res.json({items:students.map(s=>({...s,validity:validity(s.valid_until)})),total:count.total,page,pages:Math.max(1,Math.ceil(count.total/limit))});
  });
  // Fiches existantes portant le même nom (dans le périmètre de l’utilisateur) : doublons et parcours (nouveau / redoublant).
  async function similarStudents(user,name,db=pool,{centerId,year,excludeId}={}) {
    const target=normalizeName(name); if (target.length<3) return [];
    const scope=centerScope(user); const where=['1=1']; const params=[];
    if (scope) {where.push('s.center_id=?');params.push(scope);}
    if (centerId) {where.push('s.center_id=?');params.push(centerId);}
    if (year) {where.push('s.school_year=?');params.push(year);}
    if (excludeId) {where.push('s.id<>?');params.push(excludeId);}
    const candidates=await rows(`SELECT s.id,s.name,s.class_name,s.school_year,s.center_id,s.parent_phone,c.name AS center_name FROM gr_students s JOIN gr_centers c ON c.id=s.center_id WHERE ${where.join(' AND ')} ORDER BY s.school_year DESC,s.id DESC LIMIT 5000`,params,db);
    return candidates.filter(s=>normalizeName(s.name)===target).slice(0,10);
  }
  app.get('/api/students/similar',async(req,res)=>{
    res.json(await similarStudents(req.user,String(req.query.name||'').slice(0,140)));
  });
  app.post('/api/students',async (req,res) => {
    const data=schemas.student.parse(req.body); ensureScope(req.user,data.center_id);
    const studentId=await transaction(async db=>{
      await checkCenter(data.center_id,db);
      await rows('SELECT id FROM gr_centers WHERE id=? FOR UPDATE',[data.center_id],db);
      const {date,source}=await operationDate({reprise:data.reprise,operation_date:data.enrolled_on},data.center_id,db);
      const same=await similarStudents(req.user,data.name,db,{centerId:data.center_id,year:data.school_year});
      if (same.length) duplicate(data,`Une fiche « ${same[0].name} » (${same[0].class_name}) existe déjà dans ce siège pour la session ${data.school_year}. Vérifiez qu’il ne s’agit pas du même élève.`);
      const result=await rows('INSERT INTO gr_students (center_id,name,class_name,group_name,school_year,parent_name,parent_phone,parent_email,quarter,school_status,enrolled_on,source,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[data.center_id,data.name,data.class_name,data.group_name,data.school_year,data.parent_name,data.parent_phone,data.parent_email,data.quarter,data.school_status,date,source,data.notes,req.user.id],db);
      await audit(db,req.user,'student.created','student',result.insertId,{name:data.name,school_status:data.school_status,enrolled_on:date,source},data.center_id);
      return result.insertId;
    }); res.status(201).json({id:studentId});
  });
  app.get('/api/students/:id',async (req,res) => {
    const student=await findStudent(req.user,req.params.id);
    const payments=await rows(`${ledgerSelect} WHERE l.student_id=? ORDER BY l.id DESC`,[student.id]);
    res.json({...student,validity:validity(student.valid_until),payments});
  });
  // Reste dû pour un tarif et un mois : sert au formulaire de paiement (montant proposé, mois non soldé).
  app.get('/api/students/:id/due',async(req,res)=>{
    const student=await findStudent(req.user,req.params.id);
    const [tariff]=await rows('SELECT * FROM gr_tariffs WHERE id=?',[id.parse(req.query.tariff_id)]);
    if (!tariff) throw new HttpError(404,'Tarif introuvable.');
    const date=req.query.date?isoDate.parse(req.query.date):today();
    const p=!tariff.duration_days?null:req.query.period?periodSchema.parse(req.query.period):await defaultPeriod(student,tariff,date);
    res.json(await studentDue(student,tariff,p));
  });
  app.put('/api/students/:id',async (req,res)=>{
    const data=schemas.student.parse(req.body); ensureScope(req.user,data.center_id);
    await transaction(async db=>{
      const student=await findStudent(req.user,req.params.id,db,true);
      if (data.center_id!==student.center_id || data.school_year!==student.school_year) throw new HttpError(400,'Le siège et la session d’une inscription ne peuvent pas être modifiés.');
      await rows('UPDATE gr_students SET name=?,class_name=?,group_name=?,parent_name=?,parent_phone=?,parent_email=?,quarter=?,school_status=?,notes=? WHERE id=?',[data.name,data.class_name,data.group_name,data.parent_name,data.parent_phone,data.parent_email,data.quarter,data.school_status,data.notes,student.id],db);
      await audit(db,req.user,'student.updated','student',student.id,{before:student,after:data},student.center_id);
    }); res.json({ok:true});
  });
  app.post('/api/payments',async (req,res)=>{
    const data=schemas.payment.parse(req.body);
    const result=await transaction(async db=>{
      const student=await findStudent(req.user,data.student_id,db,true);
      const [tariff]=await rows('SELECT * FROM gr_tariffs WHERE id=? AND active=1 LOCK IN SHARE MODE',[data.tariff_id],db);
      if (!tariff) throw new HttpError(400,'Tarif indisponible.');
      const {date,source}=await operationDate(data,student.center_id,db);
      // Mois concerné pour une mensualité ; aucun pour des frais sans durée (inscription), dus une seule fois.
      const p=!tariff.duration_days?null:data.period||await defaultPeriod(student,tariff,date,db);
      const due=await studentDue(student,tariff,p,db);
      if (due.remaining<=0) throw new HttpError(409,p?`${tariff.name} : ${monthLabel(p)} est déjà soldé pour cet élève.`:`${tariff.name} : déjà réglé pour cet élève.`);
      const amount=data.amount ?? due.remaining;
      if (amount>due.remaining) throw new HttpError(400,`Le montant dépasse le reste à payer (${due.remaining} FCFA).`);
      const receiptRef=await checkReceiptRef(data.receipt_ref,student.center_id,db);
      if (source==='reprise' && !receiptRef) {
        const [same]=await rows("SELECT l.reference FROM gr_ledger l LEFT JOIN gr_ledger r ON r.reversal_of=l.id WHERE l.student_id=? AND l.kind='payment' AND l.operation_date=? AND l.amount=? AND r.id IS NULL",[student.id,date,amount],db);
        if (same) duplicate(data,`Un paiement de ${amount} FCFA existe déjà pour cet élève à cette date (${same.reference}).`);
      }
      const attachment=await checkAttachment(data.attachment_id,student.center_id,db);
      const ref=reference(); const number=await receiptNumber(date,db);
      const description=`${tariff.name}${p?` · ${monthLabel(p)}`:''} · ${student.name}`.slice(0,300);
      const entry=await rows("INSERT INTO gr_ledger (reference,request_key,center_id,student_id,tariff_id,period,amount,kind,category,description,method,duration_days,operation_date,author_id,receipt_number,receipt_ref,due_amount,balance_after,source,attachment_file_id,missing_doc) VALUES (?,?,?,?,?,?,?,'payment',?,?,?,?,?,?,?,?,?,?,?,?,?)",[ref,data.request_key,student.center_id,student.id,tariff.id,p,amount,tariff.name,description,data.method,tariff.duration_days,date,req.user.id,number,receiptRef,tariff.amount,due.remaining-amount,source,attachment,data.missing_doc&&!attachment],db);
      const end=await refreshValidity(student.id,db);
      await audit(db,req.user,'payment.created','ledger',entry.insertId,{reference:ref,receipt_number:number,amount,period:p,operation_date:date,source},student.center_id);
      return {id:entry.insertId,reference:ref,receipt_number:number,valid_until:end,remaining:due.remaining-amount};
    }); res.status(201).json(result);
  });
  app.get('/api/ledger',async (req,res)=>{
    const center=centerScope(req.user,req.query.center_id); const where=['1=1']; const params=[];
    if (center) {where.push('l.center_id=?');params.push(center);}
    if (req.query.kind==='payment') where.push("l.kind='payment'");
    else if (req.query.kind==='income') where.push('l.amount>0');
    else if (req.query.kind==='expense') where.push('l.amount<0');
    else if (req.query.kind==='transfer') where.push("l.kind IN ('transfer','remittance')");
    else if (req.query.kind==='reprise') where.push("l.source='reprise'");
    else if (req.query.kind==='missing') where.push("l.missing_doc=1 AND l.attachment_file_id IS NULL AND l.kind<>'reversal'");
    if (req.query.q) {where.push('(l.reference LIKE ? OR l.description LIKE ? OR l.receipt_number LIKE ? OR l.receipt_ref LIKE ? OR l.beneficiary LIKE ?)');params.push(...Array(5).fill(`%${String(req.query.q).slice(0,100)}%`));}
    const page=Math.max(1,Math.min(100000,Number.parseInt(req.query.page)||1));
    const [count]=await rows(`SELECT COUNT(*) AS total FROM gr_ledger l WHERE ${where.join(' AND ')}`,params);
    const items=await rows(`${ledgerSelect} WHERE ${where.join(' AND ')} ORDER BY l.id DESC LIMIT 25 OFFSET ${(page-1)*25}`,params);
    const [totals]=await rows(`SELECT COALESCE(SUM(CASE WHEN amount>0 THEN amount ELSE 0 END),0) AS income,COALESCE(SUM(CASE WHEN amount<0 THEN -amount ELSE 0 END),0) AS expenses,COALESCE(SUM(amount),0) AS balance FROM gr_ledger${center ? ' WHERE center_id=?' : ''}`,center?[center]:[]);
    res.json({items,total:count.total,page,pages:Math.max(1,Math.ceil(count.total/25)),totals});
  });
  app.get('/api/ledger/:id',async (req,res)=>{
    const [entry]=await rows(`${ledgerSelect} WHERE l.id=?`,[id.parse(req.params.id)]);
    if (!entry) throw new HttpError(404,'Opération introuvable.'); ensureScope(req.user,entry.center_id);
    res.json(entry);
  });
  app.post('/api/ledger',async (req,res)=>{
    const data=schemas.movement.parse(req.body); ensureScope(req.user,data.center_id);
    if(data.kind==='opening' && req.user.role!=='manager') throw new HttpError(403,'Seul le manager peut enregistrer un solde initial.');
    const result=await transaction(async db=>{
      await checkCenter(data.center_id,db);
      await rows('SELECT id FROM gr_centers WHERE id=? FOR UPDATE',[data.center_id],db);
      if (data.kind==='opening' && (await rows("SELECT l.id FROM gr_ledger l LEFT JOIN gr_ledger r ON r.reversal_of=l.id WHERE l.center_id=? AND l.kind='opening' AND r.id IS NULL",[data.center_id],db)).length) throw new HttpError(409,'Un solde initial existe déjà pour ce siège. Annulez-le d’abord avec un motif pour le corriger.');
      const {date,source}=await operationDate(data,data.center_id,db);
      const amount=data.kind==='expense' ? -data.amount : data.amount;
      const receiptRef=await checkReceiptRef(data.receipt_ref,data.center_id,db);
      if (data.kind!=='opening') {
        const same=await rows("SELECT l.reference,l.category FROM gr_ledger l LEFT JOIN gr_ledger r ON r.reversal_of=l.id WHERE l.center_id=? AND l.kind=? AND l.operation_date=? AND l.amount=? AND r.id IS NULL",[data.center_id,data.kind,date,amount],db);
        const match=same.find(x=>normalizeName(x.category)===normalizeName(data.category));
        if (match) duplicate(data,`Une ${data.kind==='expense'?'dépense':'recette'} « ${match.category} » du même montant existe déjà à cette date (${match.reference}).`);
      }
      const attachment=await checkAttachment(data.attachment_id,data.center_id,db);
      const ref=reference(); const number=data.kind==='income'?await receiptNumber(date,db):null;
      const entry=await rows('INSERT INTO gr_ledger (reference,request_key,center_id,amount,kind,category,description,beneficiary,method,operation_date,author_id,receipt_number,receipt_ref,source,attachment_file_id,missing_doc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[ref,data.request_key,data.center_id,amount,data.kind,data.category,data.description,data.beneficiary,data.method,date,req.user.id,number,receiptRef,source,attachment,data.missing_doc&&!attachment],db);
      await audit(db,req.user,'ledger.created','ledger',entry.insertId,{reference:ref,amount,operation_date:date,source},data.center_id);
      return {id:entry.insertId,reference:ref};
    }); res.status(201).json(result);
  });
  // Transfert entre caisses (deux écritures liées) ou reversement au promoteur : mouvements de trésorerie, pas des dépenses.
  app.post('/api/transfers',async(req,res)=>{
    const data=schemas.transfer.parse(req.body); ensureScope(req.user,data.center_id);
    const result=await transaction(async db=>{
      await checkCenter(data.center_id,db); if (data.to_center_id) await checkCenter(data.to_center_id,db);
      // Verrous dans un ordre fixe pour éviter les interblocages entre deux transferts croisés.
      for (const c of [data.center_id,data.to_center_id].filter(Boolean).sort((a,b)=>a-b)) await rows('SELECT id FROM gr_centers WHERE id=? FOR UPDATE',[c],db);
      const {date,source}=await operationDate(data,data.center_id,db);
      if (data.to_center_id && source==='reprise' && await activeValidation(data.to_center_id,db)) throw new HttpError(409,'La reprise de la caisse qui reçoit est déjà validée.');
      const receiptRef=await checkReceiptRef(data.receipt_ref,data.center_id,db);
      const [same]=await rows("SELECT l.reference FROM gr_ledger l LEFT JOIN gr_ledger r ON r.reversal_of=l.id WHERE l.center_id=? AND l.kind=? AND l.operation_date=? AND l.amount=? AND r.id IS NULL",[data.center_id,data.kind,date,-data.amount],db);
      if (same) duplicate(data,`Un ${data.kind==='transfer'?'transfert':'reversement'} du même montant existe déjà à cette date depuis cette caisse (${same.reference}).`);
      const attachment=await checkAttachment(data.attachment_id,data.center_id,db);
      const [from]=await rows('SELECT name FROM gr_centers WHERE id=?',[data.center_id],db);
      const [to]=data.to_center_id?await rows('SELECT name FROM gr_centers WHERE id=?',[data.to_center_id],db):[null];
      const category=data.kind==='transfer'?'Transfert entre caisses':'Reversement au promoteur';
      const insert=(center,amount,key,description,ref)=>rows('INSERT INTO gr_ledger (reference,request_key,center_id,amount,kind,category,description,beneficiary,method,operation_date,author_id,receipt_ref,source,attachment_file_id,missing_doc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[reference(),key,center,amount,data.kind,category,description.slice(0,300),data.beneficiary,data.method,date,req.user.id,ref,source,attachment,data.missing_doc&&!attachment],db);
      const out=await insert(data.center_id,-data.amount,data.request_key,data.kind==='transfer'?`Vers ${to.name} — ${data.description}`:data.description,receiptRef);
      if (data.kind==='transfer') {
        const incoming=await insert(data.to_center_id,data.amount,createHash('sha256').update(`${data.request_key}:in`).digest('hex').slice(0,36),`Depuis ${from.name} — ${data.description}`,null);
        await rows('UPDATE gr_ledger SET link_id=? WHERE id=?',[incoming.insertId,out.insertId],db);
        await rows('UPDATE gr_ledger SET link_id=? WHERE id=?',[out.insertId,incoming.insertId],db);
      }
      await audit(db,req.user,data.kind==='transfer'?'ledger.transfer':'ledger.remittance','ledger',out.insertId,{amount:data.amount,to_center_id:data.to_center_id||null,operation_date:date,source},data.center_id);
      return {id:out.insertId};
    }); res.status(201).json(result);
  });
  // Ajout d’un justificatif après coup : n’altère ni le montant ni la date, et reste tracé.
  app.post('/api/ledger/:id/attachment',async(req,res)=>{
    const entryId=id.parse(req.params.id); const fileId=id.parse(req.body.attachment_id);
    await transaction(async db=>{
      const [entry]=await rows('SELECT * FROM gr_ledger WHERE id=? FOR UPDATE',[entryId],db);
      if (!entry) throw new HttpError(404,'Opération introuvable.'); ensureScope(req.user,entry.center_id);
      if (entry.attachment_file_id) throw new HttpError(409,'Un justificatif est déjà joint à cette opération.');
      await checkAttachment(fileId,entry.center_id,db);
      await rows('UPDATE gr_ledger SET attachment_file_id=?,missing_doc=0 WHERE id=?',[fileId,entry.id],db);
      await audit(db,req.user,'ledger.attachment_added','ledger',entry.id,{file_id:fileId},entry.center_id);
    }); res.json({ok:true});
  });
  app.post('/api/ledger/:id/reverse',manager,async (req,res)=>{
    const data=schemas.reversal.parse(req.body); const entryId=id.parse(req.params.id);
    const result=await transaction(async db=>{
      const [lookup]=await rows('SELECT student_id FROM gr_ledger WHERE id=?',[entryId],db);
      if (!lookup) throw new HttpError(404,'Opération introuvable.');
      // Toujours verrouiller l’élève avant son écriture, comme pour un paiement.
      if (lookup.student_id) await findStudent(req.user,lookup.student_id,db,true);
      const [entry]=await rows('SELECT * FROM gr_ledger WHERE id=? FOR UPDATE',[entryId],db);
      if (entry.kind==='reversal' || (await rows('SELECT id FROM gr_ledger WHERE reversal_of=?',[entry.id],db)).length) throw new HttpError(409,'Cette opération est déjà annulée ou constitue une annulation.');
      const ref=reference();
      const inserted=await rows("INSERT INTO gr_ledger (reference,request_key,center_id,student_id,teacher_id,period,amount,kind,category,description,method,operation_date,reversal_of,author_id) VALUES (?,?,?,?,?,?,?,'reversal','Annulation',?,?,?,?,?)",[ref,data.request_key,entry.center_id,entry.student_id,entry.teacher_id,entry.period,-entry.amount,data.reason,entry.method,today(),entry.id,req.user.id],db);
      // Un transfert entre caisses s’annule sur ses deux écritures à la fois.
      if (entry.kind==='transfer' && entry.link_id) {
        const [pair]=await rows('SELECT * FROM gr_ledger WHERE id=? FOR UPDATE',[entry.link_id],db);
        if (pair && !(await rows('SELECT id FROM gr_ledger WHERE reversal_of=?',[pair.id],db)).length) await rows("INSERT INTO gr_ledger (reference,request_key,center_id,amount,kind,category,description,method,operation_date,reversal_of,author_id) VALUES (?,?,?,?,'reversal','Annulation',?,?,?,?,?)",[reference(),createHash('sha256').update(`${data.request_key}:pair`).digest('hex').slice(0,36),pair.center_id,-pair.amount,data.reason,pair.method,today(),pair.id,req.user.id],db);
      }
      if (entry.student_id) await refreshValidity(entry.student_id,db);
      await audit(db,req.user,'ledger.reversed','ledger',entry.id,{reversal_id:inserted.insertId,reason:data.reason},entry.center_id);
      return {id:inserted.insertId,reference:ref};
    }); res.status(201).json(result);
  });
  // Enseignants et paie : le manager gère les fiches et barèmes ; les secrétaires saisissent séances, avances et salaires de leur siège.
  app.get('/api/teachers',async(req,res)=>{
    const p=req.query.period ? periodSchema.parse(req.query.period) : currentPeriod();
    const teachers=(await rows(`${teacherSelect} ORDER BY t.active DESC,t.name`)).map(withSubjects);
    const items=[];
    for (const teacher of teachers) {
      const summary=await teacherSummary(teacher,p);
      const activity=summary.sessions || summary.advances || summary.paid;
      if (activity || (teacher.active && summary.hired) || req.query.all==='1') items.push({...teacher,summary});
    }
    const totals=items.reduce((t,i)=>({gross:t.gross+i.summary.gross,advances:t.advances+i.summary.advances,paid:t.paid+i.summary.paid,remaining:t.remaining+Math.max(0,i.summary.remaining)}),{gross:0,advances:0,paid:0,remaining:0});
    res.json({period:p,current_period:currentPeriod(),items,totals});
  });
  app.get('/api/teachers/:id',async(req,res)=>{
    const teacher=await findTeacher(req.params.id); const p=req.query.period ? periodSchema.parse(req.query.period) : currentPeriod();
    const [start,end]=periodBounds(p); const center=centerScope(req.user);
    const sessions=await rows(`SELECT s.*,c.name AS center_name,u.name AS author_name FROM gr_teacher_sessions s JOIN gr_centers c ON c.id=s.center_id JOIN gr_users u ON u.id=s.created_by WHERE s.teacher_id=? AND s.session_date BETWEEN ? AND ?${center?' AND s.center_id=?':''} ORDER BY s.session_date DESC,s.id DESC`,[teacher.id,start,end,...(center?[center]:[])]);
    const movements=await rows(`${ledgerSelect} WHERE l.teacher_id=? AND l.period=?${center?' AND l.center_id=?':''} ORDER BY l.id DESC`,[teacher.id,p,...(center?[center]:[])]);
    const [full]=(await rows(`${teacherSelect} WHERE t.id=?`,[teacher.id])).map(withSubjects);
    res.json({...full,summary:await teacherSummary(teacher,p),sessions,movements});
  });
  // Dossier enseignant : créé et modifié par le directeur/manager ; photo et au moins une matière obligatoires.
  async function teacherDossier(data,db,current=null) {
    const photo=data.photo_file_id||current?.photo_file_id;
    if (!photo) throw new HttpError(400,'La photographie de l’enseignant est obligatoire.');
    if (data.photo_file_id && !(await rows("SELECT id FROM gr_files WHERE id=? AND purpose='photo'",[data.photo_file_id],db)).length) throw new HttpError(400,'Photographie introuvable. Choisissez-la à nouveau.');
    const subjects=await rows(`SELECT id,name FROM gr_subjects WHERE id IN (${data.subject_ids.map(()=>'?').join(',')})`,data.subject_ids,db);
    if (subjects.length!==new Set(data.subject_ids).size) throw new HttpError(400,'Une matière sélectionnée est introuvable.');
    const [same]=await rows('SELECT id FROM gr_teachers WHERE matricule=? AND id<>?',[data.matricule,current?.id||0],db);
    if (same) throw new HttpError(409,`Le matricule ${data.matricule} est déjà attribué à un autre enseignant.`);
    return {photo,subjects,name:`${data.last_name} ${data.first_name}`.slice(0,140),subjectNames:subjects.map(s=>s.name).join(', ').slice(0,200)};
  }
  async function saveTeacherSubjects(teacherId,subjects,db) {
    await rows('DELETE FROM gr_teacher_subjects WHERE teacher_id=?',[teacherId],db);
    await rows(`INSERT INTO gr_teacher_subjects (teacher_id,subject_id) VALUES ${subjects.map(()=>'(?,?)').join(',')}`,subjects.flatMap(s=>[teacherId,s.id]),db);
  }
  app.post('/api/teachers',manager,async(req,res)=>{
    const data=schemas.teacher.parse(req.body);
    const teacherId=await transaction(async db=>{
      const d=await teacherDossier(data,db);
      const r=await rows('INSERT INTO gr_teachers (matricule,name,last_name,first_name,address,grade,email,photo_file_id,phone,subjects,pay_type,hourly_rate,monthly_salary,hired_on,active,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[data.matricule,d.name,data.last_name,data.first_name,data.address,data.grade,data.email,d.photo,data.phone,d.subjectNames,data.pay_type,data.hourly_rate,data.monthly_salary,data.hired_on,data.active,data.notes,req.user.id],db);
      await saveTeacherSubjects(r.insertId,d.subjects,db);
      await audit(db,req.user,'teacher.created','teacher',r.insertId,{matricule:data.matricule,name:d.name,subjects:d.subjectNames,pay_type:data.pay_type,hourly_rate:data.hourly_rate,monthly_salary:data.monthly_salary});
      return r.insertId;
    }); res.status(201).json({id:teacherId});
  });
  app.put('/api/teachers/:id',manager,async(req,res)=>{
    const data=schemas.teacher.parse(req.body);
    await transaction(async db=>{
      const teacher=await findTeacher(req.params.id,db,true);
      const d=await teacherDossier(data,db,teacher);
      await rows('UPDATE gr_teachers SET matricule=?,name=?,last_name=?,first_name=?,address=?,grade=?,email=?,photo_file_id=?,phone=?,subjects=?,pay_type=?,hourly_rate=?,monthly_salary=?,hired_on=?,active=?,notes=? WHERE id=?',[data.matricule,d.name,data.last_name,data.first_name,data.address,data.grade,data.email,d.photo,data.phone,d.subjectNames,data.pay_type,data.hourly_rate,data.monthly_salary,data.hired_on,data.active,data.notes,teacher.id],db);
      await saveTeacherSubjects(teacher.id,d.subjects,db);
      await audit(db,req.user,'teacher.updated','teacher',teacher.id,{before:{matricule:teacher.matricule,subjects:teacher.subjects,pay_type:teacher.pay_type,hourly_rate:teacher.hourly_rate,monthly_salary:teacher.monthly_salary,active:teacher.active},after:{matricule:data.matricule,subjects:d.subjectNames,pay_type:data.pay_type,hourly_rate:data.hourly_rate,monthly_salary:data.monthly_salary,active:data.active}});
    }); res.json({ok:true});
  });
  app.post('/api/teacher-sessions',async(req,res)=>{
    const data=schemas.teacherSession.parse(req.body); ensureScope(req.user,data.center_id);
    if (data.session_date>today()) throw new HttpError(400,'Une séance ne peut pas être enregistrée à l’avance.');
    const result=await transaction(async db=>{
      await checkCenter(data.center_id,db);
      const teacher=await findTeacher(data.teacher_id,db,true);
      if (!teacher.active) throw new HttpError(400,'Cet enseignant est désactivé.');
      if (data.session_date<String(teacher.hired_on).slice(0,10)) throw new HttpError(400,'La séance précède la date d’entrée de l’enseignant.');
      const minutes=Math.round(data.hours*60); const rate=teacher.pay_type==='hourly'?teacher.hourly_rate:0; const amount=sessionAmount(minutes,rate);
      const r=await rows('INSERT INTO gr_teacher_sessions (request_key,teacher_id,center_id,session_date,minutes,subject,class_name,rate,amount,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',[data.request_key,teacher.id,data.center_id,data.session_date,minutes,data.subject,data.class_name,rate,amount,req.user.id],db);
      await audit(db,req.user,'teacher_session.created','teacher_session',r.insertId,{teacher_id:teacher.id,minutes,rate,amount},data.center_id);
      return {id:r.insertId,amount};
    }); res.status(201).json(result);
  });
  app.post('/api/teacher-sessions/:id/cancel',async(req,res)=>{
    const reason=schemas.reversal.shape.reason.parse(req.body.reason); const sessionId=id.parse(req.params.id);
    await transaction(async db=>{
      const [session]=await rows('SELECT * FROM gr_teacher_sessions WHERE id=? FOR UPDATE',[sessionId],db);
      if (!session) throw new HttpError(404,'Séance introuvable.'); ensureScope(req.user,session.center_id);
      if (session.cancelled_at) throw new HttpError(409,'Cette séance est déjà annulée.');
      await rows('UPDATE gr_teacher_sessions SET cancelled_at=CURRENT_TIMESTAMP,cancelled_by=?,cancel_reason=? WHERE id=?',[req.user.id,reason,session.id],db);
      await audit(db,req.user,'teacher_session.cancelled','teacher_session',session.id,{reason},session.center_id);
    }); res.json({ok:true});
  });
  app.post('/api/teachers/:id/payments',async(req,res)=>{
    const data=schemas.teacherPayment.parse(req.body); ensureScope(req.user,data.center_id);
    if (data.period>currentPeriod()) throw new HttpError(400,'Ce mois n’a pas encore commencé.');
    const result=await transaction(async db=>{
      await checkCenter(data.center_id,db);
      // Verrou sur l’enseignant : deux versements simultanés ne peuvent pas dépasser le reste dû.
      const teacher=await findTeacher(req.params.id,db,true);
      if (String(teacher.hired_on).slice(0,7)>data.period) throw new HttpError(400,'L’enseignant n’était pas encore en poste ce mois-là.');
      await rows('INSERT IGNORE INTO gr_teacher_periods (teacher_id,period,pay_type,monthly_salary) VALUES (?,?,?,?)',[teacher.id,data.period,teacher.pay_type,teacher.monthly_salary],db);
      const summary=await teacherSummary(teacher,data.period,db);
      if (data.kind==='salary' && summary.remaining<=0) throw new HttpError(409,'Aucun salaire restant à verser pour ce mois.');
      if (data.kind==='salary' && data.amount>summary.remaining) throw new HttpError(400,`Le montant dépasse le reste à payer (${summary.remaining} FCFA).`);
      const {date,source}=await operationDate(data,data.center_id,db);
      const receiptRef=await checkReceiptRef(data.receipt_ref,data.center_id,db);
      const attachment=await checkAttachment(data.attachment_id,data.center_id,db);
      const ref=reference(); const label=data.kind==='salary'?'Salaire':'Avance sur salaire';
      const description=`${label} ${monthLabel(data.period)} · ${teacher.name}${data.description?` — ${data.description}`:''}`.slice(0,300);
      const entry=await rows('INSERT INTO gr_ledger (reference,request_key,center_id,teacher_id,period,amount,kind,category,description,beneficiary,method,operation_date,author_id,receipt_ref,source,attachment_file_id,missing_doc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[ref,data.request_key,data.center_id,teacher.id,data.period,-data.amount,data.kind,data.kind==='salary'?'Salaire enseignant':'Avance sur salaire',description,teacher.name.slice(0,140),data.method,date,req.user.id,receiptRef,source,attachment,data.missing_doc&&!attachment],db);
      await audit(db,req.user,data.kind==='salary'?'teacher.salary_paid':'teacher.advance_paid','ledger',entry.insertId,{reference:ref,teacher_id:teacher.id,period:data.period,amount:data.amount},data.center_id);
      return {id:entry.insertId,reference:ref,remaining:summary.remaining-data.amount};
    }); res.status(201).json(result);
  });
  // Fichiers : contenu binaire brut (4 Mo maximum, limite de Vercel), type vérifié sur le contenu réel.
  app.post('/api/files',express.raw({type:()=>true,limit:'4mb'}),async(req,res)=>{
    const purpose=String(req.query.purpose||'');
    if (!Object.hasOwn(fileTypes,purpose)) throw new HttpError(400,'Type de fichier inconnu.');
    if (purpose==='photo' && req.user.role!=='manager') throw new HttpError(403,'Seul le manager gère les dossiers enseignants.');
    const buffer=req.body;
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw new HttpError(400,'Le fichier est vide.');
    const mime=sniff(buffer);
    if (!fileTypes[purpose].includes(mime)) throw new HttpError(400,purpose==='exam'?'Seuls les fichiers PDF sont acceptés dans la banque d’épreuves.':purpose==='photo'?'La photographie doit être une image JPEG, PNG ou WebP.':'Le justificatif doit être une photo (JPEG, PNG, WebP) ou un PDF.');
    const name=(String(req.query.name||'fichier').replace(/[\\/\r\n"<>:*?|]+/g,' ').trim()||'fichier').slice(0,200);
    const center=purpose==='justificatif'?centerScope(req.user,req.query.center_id):null;
    const sha=createHash('sha256').update(buffer).digest('hex');
    let existing=null;
    if (purpose==='exam') [existing]=await rows('SELECT e.reference,e.title FROM gr_exams e JOIN gr_files f ON f.id=e.file_id WHERE f.sha256=? AND e.archived_at IS NULL LIMIT 1',[sha]);
    if (existing) throw new HttpError(409,`Ce fichier PDF est déjà dans la banque d’épreuves : ${existing.reference} — « ${existing.title} ».`);
    const fileId=await transaction(async db=>{
      const r=await rows('INSERT INTO gr_files (purpose,original_name,mime,size,sha256,data,center_id,uploaded_by) VALUES (?,?,?,?,?,?,?,?)',[purpose,name,mime,buffer.length,sha,buffer,center,req.user.id],db);
      await audit(db,req.user,'file.uploaded','file',r.insertId,{purpose,name,size:buffer.length,sha256:sha},center);
      return r.insertId;
    });
    res.status(201).json({id:fileId,name,mime,size:buffer.length});
  });
  app.get('/api/files/:id',async(req,res)=>{
    const [file]=await rows('SELECT * FROM gr_files WHERE id=?',[id.parse(req.params.id)]);
    if (!file) throw new HttpError(404,'Fichier introuvable.');
    if (file.purpose==='justificatif' && file.center_id) ensureScope(req.user,file.center_id);
    const ext={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.mime];
    const filename=/\.[a-z0-9]{2,4}$/i.test(file.original_name)?file.original_name:`${file.original_name}.${ext}`;
    // Pas de CSP restrictive ici : le lecteur PDF du navigateur doit pouvoir afficher le document. Contenu vérifié (PDF/images uniquement).
    res.removeHeader('Content-Security-Policy');
    res.set({'Content-Type':file.mime,'Content-Length':String(file.size),'Content-Disposition':`${req.query.download==='1'?'attachment':'inline'}; filename="${filename.replace(/[^\x20-\x7e]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,'Cache-Control':'private, no-store'});
    res.end(file.data);
  });
  // Matières prédéfinies, gérées par le manager.
  app.post('/api/subjects',manager,async(req,res)=>{
    const data=schemas.subject.parse(req.body);
    const result=await transaction(async db=>{const r=await rows('INSERT INTO gr_subjects (name,active) VALUES (?,?)',[data.name,data.active],db);await audit(db,req.user,'subject.created','subject',r.insertId,data);return r;});
    res.status(201).json({id:result.insertId});
  });
  app.put('/api/subjects/:id',manager,async(req,res)=>{
    const data=schemas.subject.parse(req.body); const subjectId=id.parse(req.params.id);
    await transaction(async db=>{
      if (!(await rows('SELECT id FROM gr_subjects WHERE id=?',[subjectId],db)).length) throw new HttpError(404,'Matière introuvable.');
      await rows('UPDATE gr_subjects SET name=?,active=? WHERE id=?',[data.name,data.active,subjectId],db);
      // Le libellé dénormalisé des enseignants suit le changement de nom.
      for (const t of await rows('SELECT DISTINCT teacher_id FROM gr_teacher_subjects WHERE subject_id=?',[subjectId],db)) await rows("UPDATE gr_teachers SET subjects=(SELECT LEFT(GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', '),200) FROM gr_teacher_subjects ts JOIN gr_subjects s ON s.id=ts.subject_id WHERE ts.teacher_id=?) WHERE id=?",[t.teacher_id,t.teacher_id],db);
      await audit(db,req.user,'subject.updated','subject',subjectId,data);
    }); res.json({ok:true});
  });
  // Banque numérique d’épreuves : dépôt par les secrétaires et le manager, consultation par tous les comptes, gestion par le manager.
  const examSelect = `SELECT e.*,s.name AS subject_name,t.name AS teacher_name,u.name AS uploader_name,c.name AS center_name,f.original_name AS file_name,f.size AS file_size FROM gr_exams e JOIN gr_subjects s ON s.id=e.subject_id JOIN gr_files f ON f.id=e.file_id JOIN gr_users u ON u.id=e.uploaded_by LEFT JOIN gr_teachers t ON t.id=e.teacher_id LEFT JOIN gr_centers c ON c.id=e.center_id`;
  app.get('/api/exams',async(req,res)=>{
    const where=[req.query.archived==='1'?'e.archived_at IS NOT NULL':'e.archived_at IS NULL']; const params=[];
    if (req.query.subject_id) {where.push('e.subject_id=?');params.push(id.parse(req.query.subject_id));}
    if (req.query.class_name) {where.push('e.class_name=?');params.push(String(req.query.class_name).slice(0,60));}
    if (req.query.sequence) {where.push('e.sequence=?');params.push(String(req.query.sequence).slice(0,60));}
    if (req.query.school_year) {where.push('e.school_year=?');params.push(schoolYear.parse(req.query.school_year));}
    if (req.query.q) {where.push('(e.title LIKE ? OR e.reference LIKE ? OR s.name LIKE ? OR e.class_name LIKE ? OR t.name LIKE ?)');params.push(...Array(5).fill(`%${String(req.query.q).slice(0,100)}%`));}
    const page=Math.max(1,Math.min(100000,Number.parseInt(req.query.page)||1));
    const [count]=await rows(`SELECT COUNT(*) AS total FROM gr_exams e JOIN gr_subjects s ON s.id=e.subject_id LEFT JOIN gr_teachers t ON t.id=e.teacher_id WHERE ${where.join(' AND ')}`,params);
    const items=await rows(`${examSelect} WHERE ${where.join(' AND ')} ORDER BY e.school_year DESC,s.name,e.class_name,e.sequence,e.id DESC LIMIT 25 OFFSET ${(page-1)*25}`,params);
    const facets=await rows('SELECT DISTINCT class_name,sequence FROM gr_exams WHERE archived_at IS NULL');
    res.json({items,total:count.total,page,pages:Math.max(1,Math.ceil(count.total/25)),classes:[...new Set(facets.map(f=>f.class_name))].sort(),sequences:[...new Set(facets.map(f=>f.sequence))].sort()});
  });
  app.post('/api/exams',async(req,res)=>{
    const data=schemas.exam.parse(req.body);
    const result=await transaction(async db=>{
      const [file]=await rows("SELECT id,sha256,uploaded_by FROM gr_files WHERE id=? AND purpose='exam'",[data.file_id],db);
      if (!file || (file.uploaded_by!==req.user.id && req.user.role!=='manager')) throw new HttpError(400,'Fichier PDF introuvable. Déposez-le à nouveau.');
      if (!(await rows('SELECT id FROM gr_subjects WHERE id=?',[data.subject_id],db)).length) throw new HttpError(400,'Matière introuvable.');
      if (data.teacher_id) await findTeacher(data.teacher_id,db);
      await nextNumber('exam-lock',db); // sérialise les dépôts pour un contrôle de doublon fiable
      const [sameFile]=await rows('SELECT e.reference,e.title FROM gr_exams e JOIN gr_files f ON f.id=e.file_id WHERE f.sha256=? AND e.archived_at IS NULL',[file.sha256],db);
      if (sameFile) throw new HttpError(409,`Ce fichier PDF est déjà dans la banque d’épreuves : ${sameFile.reference} — « ${sameFile.title} ».`);
      const similar=await rows('SELECT reference,title FROM gr_exams WHERE subject_id=? AND class_name=? AND sequence=? AND school_year=? AND archived_at IS NULL',[data.subject_id,data.class_name,data.sequence,data.school_year],db);
      const match=similar.find(e=>normalizeName(e.title)===normalizeName(data.title));
      if (match) duplicate(data,`Un sujet portant le même titre existe déjà pour cette matière, cette classe et cette séquence (${match.reference}). Confirmez seulement s’il s’agit d’un sujet différent.`);
      const year=today().slice(0,4); const reference=`EP-${year}-${String(await nextNumber(`exam-${year}`,db)).padStart(4,'0')}`;
      const r=await rows('INSERT INTO gr_exams (reference,title,subject_id,class_name,sequence,school_year,file_id,teacher_id,notes,uploaded_by,center_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[reference,data.title,data.subject_id,data.class_name,data.sequence,data.school_year,file.id,data.teacher_id||null,data.notes,req.user.id,req.user.center_id],db);
      await audit(db,req.user,'exam.created','exam',r.insertId,{reference,title:data.title});
      return {id:r.insertId,reference};
    }); res.status(201).json(result);
  });
  app.put('/api/exams/:id',manager,async(req,res)=>{
    const data=schemas.examEdit.parse(req.body); const examId=id.parse(req.params.id);
    await transaction(async db=>{
      if (!(await rows('SELECT id FROM gr_exams WHERE id=? FOR UPDATE',[examId],db)).length) throw new HttpError(404,'Sujet introuvable.');
      if (data.teacher_id) await findTeacher(data.teacher_id,db);
      await rows('UPDATE gr_exams SET title=?,subject_id=?,class_name=?,sequence=?,school_year=?,teacher_id=?,notes=? WHERE id=?',[data.title,data.subject_id,data.class_name,data.sequence,data.school_year,data.teacher_id||null,data.notes,examId],db);
      await audit(db,req.user,'exam.updated','exam',examId,data);
    }); res.json({ok:true});
  });
  app.post('/api/exams/:id/archive',manager,async(req,res)=>{
    const examId=id.parse(req.params.id); const archive=req.body.archived!==false;
    await transaction(async db=>{
      const [exam]=await rows('SELECT e.*,f.sha256 FROM gr_exams e JOIN gr_files f ON f.id=e.file_id WHERE e.id=? FOR UPDATE',[examId],db);
      if (!exam) throw new HttpError(404,'Sujet introuvable.');
      if (!archive && (await rows('SELECT e.id FROM gr_exams e JOIN gr_files f ON f.id=e.file_id WHERE f.sha256=? AND e.archived_at IS NULL AND e.id<>?',[exam.sha256,examId],db)).length) throw new HttpError(409,'Le même fichier est déjà présent dans la banque active.');
      if (archive) await rows('UPDATE gr_exams SET archived_at=CURRENT_TIMESTAMP,archived_by=? WHERE id=?',[req.user.id,examId],db);
      else await rows('UPDATE gr_exams SET archived_at=NULL,archived_by=NULL WHERE id=?',[examId],db);
      await audit(db,req.user,archive?'exam.archived':'exam.restored','exam',examId,{reference:exam.reference});
    }); res.json({ok:true});
  });
  // Reprise comptable : tableau de rapprochement par siège, comptages physiques, validation par le promoteur (manager).
  app.get('/api/reprise',async(req,res)=>{
    const center=centerScope(req.user,req.query.center_id);
    const centers=await rows(`SELECT id,name FROM gr_centers${center?' WHERE id=?':''} ORDER BY name`,center?[center]:[]);
    const summaries=[]; for (const c of centers) summaries.push(await repriseSummary(c));
    const counts=await rows(`SELECT k.*,c.name AS center_name,u.name AS counted_by_name FROM gr_cash_counts k JOIN gr_centers c ON c.id=k.center_id JOIN gr_users u ON u.id=k.counted_by${center?' WHERE k.center_id=?':''} ORDER BY k.count_date DESC,k.id DESC LIMIT 30`,center?[center]:[]);
    const history=await rows(`SELECT v.id,v.center_id,v.cutoff_date,v.theoretical,v.physical,v.gap,v.explanation,v.validated_at,v.revoked_at,v.revoke_reason,c.name AS center_name,u.name AS validated_by_name,ru.name AS revoked_by_name FROM gr_reprise_validations v JOIN gr_centers c ON c.id=v.center_id JOIN gr_users u ON u.id=v.validated_by LEFT JOIN gr_users ru ON ru.id=v.revoked_by${center?' WHERE v.center_id=?':''} ORDER BY v.id DESC LIMIT 30`,center?[center]:[]);
    const [settings]=await rows('SELECT reprise_start,school_year FROM gr_settings WHERE id=1');
    res.json({reprise_start:String(settings.reprise_start).slice(0,10),school_year:settings.school_year,today:today(),centers:summaries,counts,history});
  });
  app.post('/api/cash-counts',async(req,res)=>{
    const data=schemas.cashCount.parse(req.body); ensureScope(req.user,data.center_id);
    if (data.count_date>today()) throw new HttpError(400,'Le comptage ne peut pas être daté dans le futur.');
    const countId=await transaction(async db=>{
      await checkCenter(data.center_id,db);
      const r=await rows('INSERT INTO gr_cash_counts (center_id,count_date,cash_amount,other_amount,notes,counted_by) VALUES (?,?,?,?,?,?)',[data.center_id,data.count_date,data.cash_amount,data.other_amount,data.notes,req.user.id],db);
      await audit(db,req.user,'cash.counted','cash_count',r.insertId,data,data.center_id);
      return r.insertId;
    }); res.status(201).json({id:countId});
  });
  app.post('/api/reprise/:center/validate',manager,async(req,res)=>{
    const data=schemas.repriseValidation.parse(req.body); const centerId=id.parse(req.params.center);
    const result=await transaction(async db=>{
      await checkCenter(centerId,db); await rows('SELECT id FROM gr_centers WHERE id=? FOR UPDATE',[centerId],db);
      if (await activeValidation(centerId,db)) throw new HttpError(409,'La reprise de ce siège est déjà validée.');
      const [center]=await rows('SELECT id,name FROM gr_centers WHERE id=?',[centerId],db);
      const summary=await repriseSummary(center,db);
      if (!summary.count) throw new HttpError(400,'Saisissez d’abord le comptage physique de la caisse de ce siège.');
      if (summary.gap!==0 && data.explanation.length<10) throw new HttpError(400,`Écart de ${summary.gap} FCFA entre le solde théorique et le comptage physique : expliquez-le (10 caractères minimum) avant de valider.`);
      const r=await rows('INSERT INTO gr_reprise_validations (center_id,cutoff_date,theoretical,physical,gap,explanation,snapshot,validated_by) VALUES (?,?,?,?,?,?,?,?)',[centerId,summary.until,summary.theoretical,summary.physical,summary.gap,data.explanation,JSON.stringify(summary),req.user.id],db);
      await audit(db,req.user,'reprise.validated','reprise',r.insertId,{theoretical:summary.theoretical,physical:summary.physical,gap:summary.gap,explanation:data.explanation},centerId);
      return {id:r.insertId,gap:summary.gap};
    }); res.status(201).json(result);
  });
  app.post('/api/reprise/:center/reopen',manager,async(req,res)=>{
    const reason=schemas.reversal.shape.reason.parse(req.body.reason); const centerId=id.parse(req.params.center);
    await transaction(async db=>{
      const validation=await activeValidation(centerId,db);
      if (!validation) throw new HttpError(409,'La reprise de ce siège n’est pas validée.');
      await rows('UPDATE gr_reprise_validations SET revoked_at=CURRENT_TIMESTAMP,revoked_by=?,revoke_reason=? WHERE id=?',[req.user.id,reason,validation.id],db);
      await audit(db,req.user,'reprise.reopened','reprise',validation.id,{reason},centerId);
    }); res.json({ok:true});
  });
  app.post('/api/centers',manager,async(req,res)=>{
    const data=schemas.center.parse(req.body);
    const result=await transaction(async db=>{const r=await rows('INSERT INTO gr_centers (name,address,phone) VALUES (?,?,?)',[data.name,data.address,data.phone],db);await audit(db,req.user,'center.created','center',r.insertId,data,r.insertId);return r;});
    res.status(201).json({id:result.insertId});
  });
  app.put('/api/centers/:id',manager,async(req,res)=>{
    const data=schemas.center.parse(req.body); const centerId=id.parse(req.params.id);
    await transaction(async db=>{await checkCenter(centerId,db);await rows('UPDATE gr_centers SET name=?,address=?,phone=? WHERE id=?',[data.name,data.address,data.phone,centerId],db);await audit(db,req.user,'center.updated','center',centerId,data,centerId);}); res.json({ok:true});
  });
  app.get('/api/users',manager,async(req,res)=>res.json(await rows('SELECT u.id,u.name,u.email,u.role,u.center_id,u.active,c.name AS center_name FROM gr_users u LEFT JOIN gr_centers c ON c.id=u.center_id ORDER BY u.role,u.name')));
  app.post('/api/users',manager,async(req,res)=>{
    const data=schemas.user.parse(req.body); const hash=await bcrypt.hash(data.password,12);
    const userId=await transaction(async db=>{await checkCenter(data.center_id,db);const r=await rows("INSERT INTO gr_users (name,email,password_hash,role,center_id) VALUES (?,?,?,'secretary',?)",[data.name,data.email,hash,data.center_id],db);await audit(db,req.user,'user.created','user',r.insertId,{email:data.email},data.center_id);return r.insertId;}); res.status(201).json({id:userId});
  });
  app.put('/api/users/:id',manager,async(req,res)=>{
    const data=schemas.userEdit.parse(req.body); const userId=id.parse(req.params.id); const hash=data.password ? await bcrypt.hash(data.password,12) : null;
    await transaction(async db=>{
      await checkCenter(data.center_id,db); const [user]=await rows('SELECT * FROM gr_users WHERE id=? FOR UPDATE',[userId],db);
      if (!user || user.role!=='secretary') throw new HttpError(400,'Seuls les comptes secrétaires peuvent être modifiés ici.');
      await rows('UPDATE gr_users SET name=?,email=?,center_id=?,active=?,password_hash=COALESCE(?,password_hash),auth_version=auth_version+1 WHERE id=?',[data.name,data.email,data.center_id,data.active,hash,userId],db);
      await audit(db,req.user,'user.updated','user',userId,{email:data.email,active:data.active,center_id:data.center_id},data.center_id);
    }); res.json({ok:true});
  });
  app.post('/api/tariffs',manager,async(req,res)=>{
    const data=schemas.tariff.parse(req.body);
    const result=await transaction(async db=>{const r=await rows('INSERT INTO gr_tariffs (name,amount,duration_days,active) VALUES (?,?,?,?)',[data.name,data.amount,data.duration_days,data.active],db);await audit(db,req.user,'tariff.created','tariff',r.insertId,data);return r;});res.status(201).json({id:result.insertId});
  });
  app.put('/api/tariffs/:id',manager,async(req,res)=>{
    const data=schemas.tariff.parse(req.body); const tariffId=id.parse(req.params.id);
    await transaction(async db=>{
      if (!(await rows('SELECT id FROM gr_tariffs WHERE id=?',[tariffId],db)).length) throw new HttpError(404,'Tarif introuvable.');
      await rows('UPDATE gr_tariffs SET name=?,amount=?,duration_days=?,active=? WHERE id=?',[data.name,data.amount,data.duration_days,data.active,tariffId],db);
      await audit(db,req.user,'tariff.updated','tariff',tariffId,data);
    });res.json({ok:true});
  });
  app.put('/api/settings',manager,async(req,res)=>{
    const year=schoolYear.parse(req.body.school_year);
    const start=req.body.reprise_start?isoDate.parse(req.body.reprise_start):null;
    if (start && start>today()) throw new HttpError(400,'Le début de la reprise ne peut pas être dans le futur.');
    await transaction(async db=>{
      await rows('UPDATE gr_settings SET school_year=?,reprise_start=COALESCE(?,reprise_start) WHERE id=1',[year,start],db);
      await audit(db,req.user,'settings.updated','settings',1,{school_year:year,reprise_start:start});
    });res.json({ok:true});
  });
  app.get('/api/audit',manager,async(req,res)=>{
    const page=Math.max(1,Math.min(100000,Number.parseInt(req.query.page)||1));
    const [count]=await rows('SELECT COUNT(*) AS total FROM gr_audit');
    const items=await rows(`SELECT a.id,a.action,a.entity,a.entity_id,a.created_at,u.name AS author_name,c.name AS center_name FROM gr_audit a LEFT JOIN gr_users u ON u.id=a.actor_id LEFT JOIN gr_centers c ON c.id=a.center_id ORDER BY a.id DESC LIMIT 30 OFFSET ${(page-1)*30}`);
    res.json({items,page,total:count.total,pages:Math.max(1,Math.ceil(count.total/30))});
  });
  app.use('/api',(req,res)=>res.status(404).json({error:'Ressource introuvable.'}));
  app.use(express.static(publicPath,{index:false}));
  for (const route of ['/','/login','/initialisation','/app']) app.get(route,(req,res)=>res.sendFile(path.join(publicPath,'index.html')));
  app.use((req,res)=>res.status(404).send('Page introuvable.'));
  app.use((error,req,res,next)=>{
    if (res.headersSent) return next(error);
    if (error instanceof ZodError) return res.status(400).json({error:'Vérifiez les informations du formulaire.',fields:error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
    if (error.code==='ER_DUP_ENTRY') return res.status(409).json({error:'Cet enregistrement existe déjà ou cette opération a déjà été traitée. Actualisez la liste avant de réessayer.'});
    if (error.code==='ER_NO_REFERENCED_ROW_2') return res.status(400).json({error:'Un enregistrement associé est introuvable.'});
    if (error.type==='entity.too.large') return res.status(413).json({error:'Fichier trop volumineux : 4 Mo maximum. Compressez le PDF ou réduisez la photo.'});
    if (error instanceof HttpError) return res.status(error.status).json({error:error.message,...(error.extra||{})});
    if (error.status && error.status<500) return res.status(error.status).json({error:error.message});
    console.error('Erreur serveur :',error.code || error.name);
    res.status(500).json({error:'Une erreur est survenue. Vérifiez la connexion à la base de données puis réessayez.'});
  });
  return app;
}
