import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createTestDatabase } from './database.js';
import { today, payrollSummary, periodBounds, sessionAmount, schemas } from '../src/domain.js';

let cleanup,app,pool,rows,manager,secretary,other,mCsrf,sCsrf,oCsrf,hourly,monthly,session1,salaryId,photoId;
const password='Un mot de passe de test 2026!';
const period=today().slice(0,7);
const post=(agent,path,csrf,body)=>agent.post(path).set('X-CSRF-Token',csrf).send(body);
const login=async(agent,email)=>{const csrf=(await agent.get('/api/auth/bootstrap')).body.csrf;return (await post(agent,'/api/auth/login',csrf,{email,password}).expect(200)).body.csrf;};
// Dossier enseignant complet : matricule, nom, prénom, téléphone, photo et matières obligatoires.
const teacherData=({name='Enseignant Test',...extra}={})=>{const [last_name,...first]=name.split(' ');return {matricule:`MAT-${name.replace(/\s+/g,'-')}`,last_name,first_name:first.join(' ')||'Test',address:'Yaoundé',grade:'PLEG',email:'',phone:'+237 699 11 22 33',photo_file_id:photoId,subject_ids:[1],pay_type:'hourly',hourly_rate:2000,monthly_salary:0,hired_on:`${period}-01`,active:true,...extra};};
const pngBytes=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),Buffer.from('image de test')]);
const summary=async(agent,id)=>(await agent.get(`/api/teachers/${id}?period=${period}`).expect(200)).body.summary;
const pay=(agent,csrf,id,extra)=>post(agent,`/api/teachers/${id}/payments`,csrf,{center_id:1,period,kind:'salary',method:'cash',request_key:randomUUID(),...extra});

before(async()=>{
  cleanup=await createTestDatabase();
  ({pool,rows}=await import('../src/db.js'));
  app=(await import('../src/app.js')).createApp();await app.locals.sessionStore.onReady();
  manager=request.agent(app);secretary=request.agent(app);other=request.agent(app);
  mCsrf=(await manager.get('/api/auth/bootstrap')).body.csrf;
  mCsrf=(await post(manager,'/api/auth/setup',mCsrf,{name:'Manager',email:'manager@example.com',password,token:process.env.SETUP_TOKEN}).expect(201)).body.csrf;
  await post(manager,'/api/users',mCsrf,{name:'Secrétaire Biyem',email:'s1@example.com',password,center_id:1}).expect(201);
  await post(manager,'/api/users',mCsrf,{name:'Secrétaire Mendong',email:'s2@example.com',password,center_id:2}).expect(201);
  sCsrf=await login(secretary,'s1@example.com');oCsrf=await login(other,'s2@example.com');
  photoId=(await manager.post('/api/files?purpose=photo&name=photo.png').set('X-CSRF-Token',mCsrf).set('Content-Type','application/octet-stream').send(pngBytes).expect(201)).body.id;
});
after(async()=>{await app?.locals.sessionStore.close();await pool?.end();await cleanup?.();});

test('Calculs de paie : montant d’une séance, bornes du mois, reste à payer',()=>{
  assert.equal(sessionAmount(90,2000),3000);assert.equal(sessionAmount(45,1500),1125);
  assert.deepEqual(periodBounds('2027-02'),['2027-02-01','2027-02-28']);assert.deepEqual(periodBounds('2028-02'),['2028-02-01','2028-02-29']);
  assert.deepEqual(payrollSummary({pay_type:'monthly',monthly_salary:80000,sessions_amount:999,advances:20000,paid:0}),{gross:80000,advances:20000,paid:0,remaining:60000,status:'partial'});
  assert.equal(payrollSummary({pay_type:'hourly',sessions_amount:3000,advances:5000,paid:0}).status,'overpaid');
  assert.equal(schemas.teacher.safeParse(teacherData({hourly_rate:0})).success,false);
  assert.equal(schemas.teacher.safeParse(teacherData({pay_type:'monthly',monthly_salary:0})).success,false);
});
test('Seul le manager crée et modifie les enseignants',async()=>{
  hourly=(await post(manager,'/api/teachers',mCsrf,teacherData({name:'Prof Horaire'})).expect(201)).body.id;
  monthly=(await post(manager,'/api/teachers',mCsrf,teacherData({name:'Prof Mensuel',pay_type:'monthly',monthly_salary:80000})).expect(201)).body.id;
  await post(secretary,'/api/teachers',sCsrf,teacherData()).expect(403);
  await secretary.put(`/api/teachers/${hourly}`).set('X-CSRF-Token',sCsrf).send(teacherData()).expect(403);
  await post(manager,'/api/teachers',mCsrf,teacherData({hourly_rate:0})).expect(400);
  const list=(await secretary.get('/api/teachers').expect(200)).body;
  assert.deepEqual(list.items.map(t=>t.name).sort(),['Prof Horaire','Prof Mensuel']);
  assert.equal(list.items.find(t=>t.id===monthly).summary.gross,80000);
});
test('Séances : siège de la secrétaire, date passée, taux figé',async()=>{
  const body={teacher_id:hourly,center_id:1,session_date:today(),hours:1.5,subject:'Maths',class_name:'Terminale A',request_key:randomUUID()};
  session1=(await post(secretary,'/api/teacher-sessions',sCsrf,body).expect(201)).body.id;
  await post(secretary,'/api/teacher-sessions',sCsrf,body).expect(409);
  await post(secretary,'/api/teacher-sessions',sCsrf,{...body,center_id:2,request_key:randomUUID()}).expect(403);
  await post(secretary,'/api/teacher-sessions',sCsrf,{...body,session_date:'2099-01-01',request_key:randomUUID()}).expect(400);
  await post(other,'/api/teacher-sessions',oCsrf,{...body,center_id:2,hours:1,request_key:randomUUID()}).expect(201);
  assert.equal((await summary(manager,hourly)).gross,5000);
  await manager.put(`/api/teachers/${hourly}`).set('X-CSRF-Token',mCsrf).send(teacherData({name:'Prof Horaire',hourly_rate:3000})).expect(200);
  assert.equal((await summary(manager,hourly)).gross,5000,'les séances déjà saisies gardent leur taux');
  const detail=(await secretary.get(`/api/teachers/${hourly}?period=${period}`)).body;
  assert.deepEqual(detail.sessions.map(s=>s.center_id),[1],'la secrétaire ne voit que les séances de son siège');
  await post(other,`/api/teacher-sessions/${session1}/cancel`,oCsrf,{reason:'Erreur de siège'}).expect(403);
});
test('Avance, salaire plafonné au reste dû et sortie de caisse',async()=>{
  await pay(secretary,sCsrf,hourly,{kind:'advance',amount:1000}).expect(201);
  await pay(secretary,sCsrf,hourly,{amount:4500}).expect(400);
  salaryId=(await pay(secretary,sCsrf,hourly,{amount:4000,method:'mtn'}).expect(201)).body.id;
  const s=await summary(secretary,hourly);assert.deepEqual([s.gross,s.advances,s.paid,s.remaining,s.status],[5000,1000,4000,0,'paid']);
  await pay(secretary,sCsrf,hourly,{amount:1}).expect(409);
  await pay(secretary,sCsrf,hourly,{center_id:2,amount:1}).expect(403);
  await pay(secretary,sCsrf,hourly,{period:'2099-01',amount:1}).expect(400);
  assert.equal((await secretary.get('/api/ledger')).body.totals.balance,-5000);
  const entry=(await secretary.get(`/api/ledger/${salaryId}`)).body;assert.equal(entry.kind,'salary');assert.equal(entry.teacher_name,'Prof Horaire');assert.equal(entry.amount,-4000);
});
test('Annulations : séance et salaire recalculent le reste dû',async()=>{
  await post(secretary,`/api/teacher-sessions/${session1}/cancel`,sCsrf,{reason:'Séance non tenue'}).expect(200);
  await post(secretary,`/api/teacher-sessions/${session1}/cancel`,sCsrf,{reason:'Séance non tenue'}).expect(409);
  assert.deepEqual(Object.values((({gross,remaining,status})=>({gross,remaining,status}))(await summary(manager,hourly))),[2000,-3000,'overpaid']);
  await post(secretary,`/api/ledger/${salaryId}/reverse`,sCsrf,{reason:'Erreur',request_key:randomUUID()}).expect(403);
  await post(manager,`/api/ledger/${salaryId}/reverse`,mCsrf,{reason:'Montant erroné',request_key:randomUUID()}).expect(201);
  const s=await summary(manager,hourly);assert.equal(s.paid,0);assert.equal(s.remaining,1000);
  const [reversal]=await rows("SELECT teacher_id,period FROM gr_ledger WHERE kind='reversal'");assert.deepEqual(reversal,{teacher_id:hourly,period});
});
test('Salaire fixe : barème figé au premier versement et versements simultanés',async()=>{
  await pay(manager,mCsrf,monthly,{kind:'advance',amount:20000,center_id:2}).expect(201);
  await manager.put(`/api/teachers/${monthly}`).set('X-CSRF-Token',mCsrf).send(teacherData({name:'Prof Mensuel',pay_type:'monthly',monthly_salary:100000})).expect(200);
  assert.equal((await summary(manager,monthly)).gross,80000,'le mois entamé garde son salaire');
  const results=await Promise.all([pay(secretary,sCsrf,monthly,{amount:40000}),pay(other,oCsrf,monthly,{amount:40000,center_id:2})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,400]);
  const s=await summary(manager,monthly);assert.equal(s.paid,40000);assert.equal(s.remaining,20000);
});
test('Enseignant désactivé : plus de séance, historique conservé',async()=>{
  await manager.put(`/api/teachers/${hourly}`).set('X-CSRF-Token',mCsrf).send(teacherData({name:'Prof Horaire',hourly_rate:3000,active:false})).expect(200);
  await post(secretary,'/api/teacher-sessions',sCsrf,{teacher_id:hourly,center_id:1,session_date:today(),hours:1,request_key:randomUUID()}).expect(400);
  assert.ok((await manager.get(`/api/teachers?period=${period}`)).body.items.some(t=>t.id===hourly));
  assert.ok((await rows("SELECT id FROM gr_audit WHERE action='teacher.salary_paid'")).length);
});
