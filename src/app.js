import express from 'express';
import session from 'express-session';
import mysqlSession from 'express-mysql-session';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { pool, rows, transaction } from './db.js';
import { config } from './config.js';
import { schemas, id, schoolYear, today, calculateValidity, validity, centerScope, ensureScope, HttpError, period as periodSchema, periodBounds, sessionAmount, payrollSummary } from './domain.js';

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
  const payments = await rows(`SELECT l.operation_date,l.duration_days FROM gr_ledger l LEFT JOIN gr_ledger r ON r.reversal_of=l.id WHERE l.student_id=? AND l.kind='payment' AND r.id IS NULL ORDER BY l.operation_date,l.id`,[studentId],db);
  const end = calculateValidity(payments);
  await rows('UPDATE gr_students SET valid_until=? WHERE id=?',[end,studentId],db);
  return end;
}
const ledgerSelect = `SELECT l.*,c.name AS center_name,u.name AS author_name,s.name AS student_name,s.class_name,t.name AS teacher_name,r.id AS reversed_by FROM gr_ledger l JOIN gr_centers c ON c.id=l.center_id JOIN gr_users u ON u.id=l.author_id LEFT JOIN gr_students s ON s.id=l.student_id LEFT JOIN gr_teachers t ON t.id=l.teacher_id LEFT JOIN gr_ledger r ON r.reversal_of=l.id`;
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
    const [centers,tariffs,settings] = await Promise.all([
      rows(`SELECT * FROM gr_centers${center ? ' WHERE id=?' : ''} ORDER BY name`,center ? [center] : []),
      rows('SELECT * FROM gr_tariffs ORDER BY amount'),rows('SELECT * FROM gr_settings WHERE id=1'),
    ]);
    const years = await rows(`SELECT DISTINCT school_year FROM gr_students${center ? ' WHERE center_id=?' : ''} ORDER BY school_year DESC`,center ? [center] : []);
    res.json({centers,tariffs,school_year:settings[0].school_year,years:[...new Set([settings[0].school_year,...years.map(y=>y.school_year)])],today:today()});
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
      where.push('(s.name LIKE ? OR s.parent_phone LIKE ? OR s.class_name LIKE ? OR s.group_name LIKE ?)'); params.push(...Array(4).fill(`%${q}%`));
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
  app.post('/api/students',async (req,res) => {
    const data=schemas.student.parse(req.body); ensureScope(req.user,data.center_id);
    const studentId=await transaction(async db=>{
      await checkCenter(data.center_id,db);
      const result=await rows('INSERT INTO gr_students (center_id,name,class_name,group_name,school_year,parent_name,parent_phone,parent_email,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',[data.center_id,data.name,data.class_name,data.group_name,data.school_year,data.parent_name,data.parent_phone,data.parent_email,data.notes,req.user.id],db);
      await audit(db,req.user,'student.created','student',result.insertId,{name:data.name},data.center_id);
      return result.insertId;
    }); res.status(201).json({id:studentId});
  });
  app.get('/api/students/:id',async (req,res) => {
    const student=await findStudent(req.user,req.params.id);
    const payments=await rows(`${ledgerSelect} WHERE l.student_id=? ORDER BY l.id DESC`,[student.id]);
    res.json({...student,validity:validity(student.valid_until),payments});
  });
  app.put('/api/students/:id',async (req,res)=>{
    const data=schemas.student.parse(req.body); ensureScope(req.user,data.center_id);
    await transaction(async db=>{
      const student=await findStudent(req.user,req.params.id,db,true);
      if (data.center_id!==student.center_id || data.school_year!==student.school_year) throw new HttpError(400,'Le siège et la session d’une inscription ne peuvent pas être modifiés.');
      await rows('UPDATE gr_students SET name=?,class_name=?,group_name=?,parent_name=?,parent_phone=?,parent_email=?,notes=? WHERE id=?',[data.name,data.class_name,data.group_name,data.parent_name,data.parent_phone,data.parent_email,data.notes,student.id],db);
      await audit(db,req.user,'student.updated','student',student.id,{before:student,after:data},student.center_id);
    }); res.json({ok:true});
  });
  app.post('/api/payments',async (req,res)=>{
    const data=schemas.payment.parse(req.body);
    const result=await transaction(async db=>{
      const student=await findStudent(req.user,data.student_id,db,true);
      const [tariff]=await rows('SELECT * FROM gr_tariffs WHERE id=? AND active=1 LOCK IN SHARE MODE',[data.tariff_id],db);
      if (!tariff) throw new HttpError(400,'Tarif indisponible.');
      const ref=reference();
      const entry=await rows("INSERT INTO gr_ledger (reference,request_key,center_id,student_id,tariff_id,amount,kind,category,description,method,duration_days,operation_date,author_id) VALUES (?,?,?,?,?,?,'payment',?,?,?,?,?,?)",[ref,data.request_key,student.center_id,student.id,tariff.id,tariff.amount,tariff.name,`${tariff.name} · ${student.name}`,data.method,tariff.duration_days,today(),req.user.id],db);
      const end=await refreshValidity(student.id,db);
      await audit(db,req.user,'payment.created','ledger',entry.insertId,{reference:ref,amount:tariff.amount},student.center_id);
      return {id:entry.insertId,reference:ref,valid_until:end};
    }); res.status(201).json(result);
  });
  app.get('/api/ledger',async (req,res)=>{
    const center=centerScope(req.user,req.query.center_id); const where=['1=1']; const params=[];
    if (center) {where.push('l.center_id=?');params.push(center);}
    if (req.query.kind==='payment') where.push("l.kind='payment'");
    else if (req.query.kind==='income') where.push('l.amount>0');
    else if (req.query.kind==='expense') where.push('l.amount<0');
    if (req.query.q) {where.push('(l.reference LIKE ? OR l.description LIKE ?)');params.push(...Array(2).fill(`%${String(req.query.q).slice(0,100)}%`));}
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
      if (data.kind==='opening' && (await rows("SELECT id FROM gr_ledger WHERE center_id=? AND kind='opening'",[data.center_id],db)).length) throw new HttpError(409,'Un solde initial existe déjà pour ce siège. Utilisez une rectification.');
      const ref=reference(); const amount=data.kind==='expense' ? -data.amount : data.amount;
      const entry=await rows('INSERT INTO gr_ledger (reference,request_key,center_id,amount,kind,category,description,method,operation_date,author_id) VALUES (?,?,?,?,?,?,?,?,?,?)',[ref,data.request_key,data.center_id,amount,data.kind,data.category,data.description,data.method,today(),req.user.id],db);
      await audit(db,req.user,'ledger.created','ledger',entry.insertId,{reference:ref,amount},data.center_id);
      return {id:entry.insertId,reference:ref};
    }); res.status(201).json(result);
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
      if (entry.student_id) await refreshValidity(entry.student_id,db);
      await audit(db,req.user,'ledger.reversed','ledger',entry.id,{reversal_id:inserted.insertId,reason:data.reason},entry.center_id);
      return {id:inserted.insertId,reference:ref};
    }); res.status(201).json(result);
  });
  // Enseignants et paie : le manager gère les fiches et barèmes ; les secrétaires saisissent séances, avances et salaires de leur siège.
  app.get('/api/teachers',async(req,res)=>{
    const p=req.query.period ? periodSchema.parse(req.query.period) : currentPeriod();
    const teachers=await rows('SELECT * FROM gr_teachers ORDER BY active DESC,name');
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
    res.json({...teacher,summary:await teacherSummary(teacher,p),sessions,movements});
  });
  app.post('/api/teachers',manager,async(req,res)=>{
    const data=schemas.teacher.parse(req.body);
    const teacherId=await transaction(async db=>{
      const r=await rows('INSERT INTO gr_teachers (name,phone,subjects,pay_type,hourly_rate,monthly_salary,hired_on,active,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',[data.name,data.phone,data.subjects,data.pay_type,data.hourly_rate,data.monthly_salary,data.hired_on,data.active,data.notes,req.user.id],db);
      await audit(db,req.user,'teacher.created','teacher',r.insertId,{name:data.name,pay_type:data.pay_type,hourly_rate:data.hourly_rate,monthly_salary:data.monthly_salary});
      return r.insertId;
    }); res.status(201).json({id:teacherId});
  });
  app.put('/api/teachers/:id',manager,async(req,res)=>{
    const data=schemas.teacher.parse(req.body);
    await transaction(async db=>{
      const teacher=await findTeacher(req.params.id,db,true);
      await rows('UPDATE gr_teachers SET name=?,phone=?,subjects=?,pay_type=?,hourly_rate=?,monthly_salary=?,hired_on=?,active=?,notes=? WHERE id=?',[data.name,data.phone,data.subjects,data.pay_type,data.hourly_rate,data.monthly_salary,data.hired_on,data.active,data.notes,teacher.id],db);
      await audit(db,req.user,'teacher.updated','teacher',teacher.id,{before:{pay_type:teacher.pay_type,hourly_rate:teacher.hourly_rate,monthly_salary:teacher.monthly_salary,active:teacher.active},after:{pay_type:data.pay_type,hourly_rate:data.hourly_rate,monthly_salary:data.monthly_salary,active:data.active}});
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
      const ref=reference(); const label=data.kind==='salary'?'Salaire':'Avance sur salaire';
      const description=`${label} ${monthLabel(data.period)} · ${teacher.name}${data.description?` — ${data.description}`:''}`.slice(0,300);
      const entry=await rows('INSERT INTO gr_ledger (reference,request_key,center_id,teacher_id,period,amount,kind,category,description,method,operation_date,author_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[ref,data.request_key,data.center_id,teacher.id,data.period,-data.amount,data.kind,data.kind==='salary'?'Salaire enseignant':'Avance sur salaire',description,data.method,today(),req.user.id],db);
      await audit(db,req.user,data.kind==='salary'?'teacher.salary_paid':'teacher.advance_paid','ledger',entry.insertId,{reference:ref,teacher_id:teacher.id,period:data.period,amount:data.amount},data.center_id);
      return {id:entry.insertId,reference:ref,remaining:summary.remaining-data.amount};
    }); res.status(201).json(result);
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
    await transaction(async db=>{await rows('UPDATE gr_settings SET school_year=? WHERE id=1',[year],db);await audit(db,req.user,'settings.updated','settings',1,{school_year:year});});res.json({ok:true});
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
    if (error.status && error.status<500) return res.status(error.status).json({error:error.message});
    console.error('Erreur serveur :',error.code || error.name);
    res.status(500).json({error:'Une erreur est survenue. Vérifiez la connexion à la base de données puis réessayez.'});
  });
  return app;
}
