import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createTestDatabase } from './database.js';
import { addDays, today } from '../src/domain.js';

let cleanup,app,pool,rows,manager,secretary,other,managerCsrf,secretaryCsrf,otherCsrf,student1,student2,payment1,payment2,secretaryId;
const password='Un mot de passe de test 2026!';
const studentData=center=>({center_id:center,name:center===1?'Marie Atangana':'Paul Mballa',class_name:'Terminale A',group_name:'Soir',school_year:'2026-2027',parent_name:'Parent exemple',parent_phone:'+237 699 00 00 00',parent_email:'parent@example.com',quarter:'Biyem-Assi Lac',school_status:'nouveau'});
const post=(agent,path,csrf,body)=>agent.post(path).set('X-CSRF-Token',csrf).send(body);
before(async()=>{
  cleanup=await createTestDatabase();
  ({pool,rows}=await import('../src/db.js'));
  app=(await import('../src/app.js')).createApp();await app.locals.sessionStore.onReady();
  manager=request.agent(app);secretary=request.agent(app);other=request.agent(app);
});
after(async()=>{await app?.locals.sessionStore.close();await pool?.end();await cleanup?.();});

test('Routes privées, CSRF et en-têtes de sécurité',async()=>{
  await request(app).get('/api/students').expect(401);
  await request(app).post('/api/auth/login').send({email:'x@x.cm',password:'password'}).expect(403);
  const result=await manager.get('/api/auth/bootstrap').expect(200);managerCsrf=result.body.csrf;
  assert.equal(result.body.needsSetup,true);assert.ok(result.headers['content-security-policy']);assert.equal(result.headers['x-powered-by'],undefined);
  await post(manager,'/api/auth/setup',managerCsrf,{name:'Manager',email:'manager@example.com',password,token:'x'.repeat(32)}).expect(403);
});
test('Initialisation unique, mot de passe haché et renouvellement de session',async()=>{
  const beforeCsrf=managerCsrf;
  const result=await post(manager,'/api/auth/setup',managerCsrf,{name:'Manager Test',email:'manager@example.com',password,token:process.env.SETUP_TOKEN}).expect(201);
  managerCsrf=result.body.csrf;assert.notEqual(managerCsrf,beforeCsrf);
  assert.match(result.headers['set-cookie'][0],/HttpOnly/);assert.match(result.headers['set-cookie'][0],/SameSite=Lax/);
  const [user]=await rows('SELECT * FROM gr_users WHERE email=?',['manager@example.com']);assert.match(user.password_hash,/^\$2[aby]\$/);assert.notEqual(user.password_hash,password);
  await post(manager,'/api/auth/setup',managerCsrf,{name:'Deuxième Manager',email:'autre@example.com',password,token:process.env.SETUP_TOKEN}).expect(409);
});
test('Création de comptes secrétaires et connexion avec rôles contrôlés',async()=>{
  const one=await post(manager,'/api/users',managerCsrf,{name:'Secrétaire Biyem',email:'secretary@example.com',password,center_id:1,role:'manager'}).expect(201);secretaryId=one.body.id;
  await post(manager,'/api/users',managerCsrf,{name:'Secrétaire Mendong',email:'other@example.com',password,center_id:2}).expect(201);
  secretaryCsrf=(await secretary.get('/api/auth/bootstrap')).body.csrf;
  const login=await post(secretary,'/api/auth/login',secretaryCsrf,{email:'secretary@example.com',password}).expect(200);secretaryCsrf=login.body.csrf;assert.equal(login.body.user.role,'secretary');
  otherCsrf=(await other.get('/api/auth/bootstrap')).body.csrf;
  otherCsrf=(await post(other,'/api/auth/login',otherCsrf,{email:'other@example.com',password}).expect(200)).body.csrf;
});
test('Chaque secrétaire inscrit seulement les élèves de son siège',async()=>{
  student1=(await post(secretary,'/api/students',secretaryCsrf,studentData(1)).expect(201)).body.id;
  student2=(await post(other,'/api/students',otherCsrf,studentData(2)).expect(201)).body.id;
  await post(secretary,'/api/students',secretaryCsrf,studentData(2)).expect(403);
  await secretary.get(`/api/students/${student2}`).expect(403);
  await secretary.put(`/api/students/${student2}`).set('X-CSRF-Token',secretaryCsrf).send(studentData(2)).expect(403);
  const list=await secretary.get('/api/students').expect(200);assert.deepEqual(list.body.items.map(s=>s.id),[student1]);
  await secretary.get('/api/students?center_id=2').expect(403);
  const meta=await secretary.get('/api/meta').expect(200);assert.deepEqual(meta.body.centers.map(c=>c.id),[1]);
});
test('Protection des routes manager et des filtres de tableau de bord',async()=>{
  for(const url of ['/api/users','/api/audit','/api/dashboard?center_id=2','/api/ledger?center_id=2']) await secretary.get(url).expect(403);
  await post(secretary,'/api/centers',secretaryCsrf,{name:'Faux siège',address:'Yaoundé'}).expect(403);
  await secretary.put('/api/settings').set('X-CSRF-Token',secretaryCsrf).send({school_year:'2027-2028'}).expect(403);
});
test('Inscription sans prolongation et paiement au montant du tarif serveur',async()=>{
  await post(secretary,'/api/payments',secretaryCsrf,{student_id:student1,tariff_id:2,method:'cash',request_key:randomUUID(),amount:2501}).expect(400);
  await post(secretary,'/api/payments',secretaryCsrf,{student_id:student1,tariff_id:2,method:'cash',request_key:randomUUID()}).expect(201);
  await post(secretary,'/api/payments',secretaryCsrf,{student_id:student1,tariff_id:2,method:'cash',request_key:randomUUID()}).expect(409);
  assert.equal((await secretary.get(`/api/students/${student1}`)).body.valid_until,null);
  await post(secretary,'/api/payments',secretaryCsrf,{student_id:student1,tariff_id:1,method:'cash',request_key:randomUUID(),amount:-1}).expect(400);
  const paid=await post(secretary,'/api/payments',secretaryCsrf,{student_id:student1,tariff_id:1,method:'cash',request_key:randomUUID()}).expect(201);payment1=paid.body.id;
  assert.match(paid.body.receipt_number,/^REC-\d{4}-\d{6}$/);
  assert.equal(paid.body.valid_until,addDays(today(),30));
  const entry=(await secretary.get(`/api/ledger/${payment1}`)).body;assert.equal(entry.amount,5000);assert.equal(entry.center_id,1);
  await other.get(`/api/ledger/${payment1}`).expect(403);
  await post(other,'/api/payments',otherCsrf,{student_id:student1,tariff_id:1,method:'cash',request_key:randomUUID()}).expect(403);
});
test('Double envoi simultané : une seule écriture, une seule prolongation',async()=>{
  const body={student_id:student1,tariff_id:1,method:'mtn',request_key:randomUUID()};
  const result=await Promise.all([post(secretary,'/api/payments',secretaryCsrf,body),post(secretary,'/api/payments',secretaryCsrf,body)]);
  assert.deepEqual(result.map(r=>r.status).sort(),[201,409]);payment2=result.find(r=>r.status===201).body.id;
  assert.equal((await secretary.get(`/api/students/${student1}`)).body.valid_until,addDays(today(),60));
  assert.equal((await rows('SELECT COUNT(*) AS total FROM gr_ledger WHERE request_key=?',[body.request_key]))[0].total,1);
});
test('Dépense et solde exact par siège',async()=>{
  const movement={center_id:1,kind:'expense',amount:1500,category:'Fournitures',description:'Achat de craies',method:'cash',request_key:randomUUID()};
  await post(secretary,'/api/ledger',secretaryCsrf,movement).expect(201);
  const data=(await secretary.get('/api/ledger')).body;assert.equal(data.totals.balance,11000);
  assert.equal((await other.get('/api/ledger')).body.totals.balance,0);
  await post(secretary,'/api/ledger',secretaryCsrf,{...movement,center_id:2,request_key:randomUUID()}).expect(403);
  await post(secretary,'/api/ledger',secretaryCsrf,{...movement,amount:-5,request_key:randomUUID()}).expect(400);
  await post(secretary,'/api/ledger',secretaryCsrf,{...movement,kind:'opening',request_key:randomUUID()}).expect(403);
});
test('Les modifications de tarif préservent les anciens paiements',async()=>{
  await manager.put('/api/tariffs/1').set('X-CSRF-Token',managerCsrf).send({name:'Nouveau tarif',amount:6000,duration_days:45,active:true}).expect(200);
  const entry=(await manager.get(`/api/ledger/${payment1}`)).body;assert.equal(entry.amount,5000);assert.equal(entry.duration_days,30);
});
test('Annulation : contre-écriture, recalcul de validité, historique conservé',async()=>{
  await post(secretary,`/api/ledger/${payment1}/reverse`,secretaryCsrf,{reason:'Erreur de saisie',request_key:randomUUID()}).expect(403);
  const reversed=await post(manager,`/api/ledger/${payment1}/reverse`,managerCsrf,{reason:'Paiement enregistré deux fois',request_key:randomUUID()}).expect(201);
  const original=(await manager.get(`/api/ledger/${payment1}`)).body;assert.equal(original.reversed_by,reversed.body.id);assert.equal(original.amount,5000);
  assert.equal((await secretary.get(`/api/students/${student1}`)).body.valid_until,addDays(today(),30));
  assert.equal((await secretary.get('/api/ledger')).body.totals.balance,6000);
  await post(manager,`/api/ledger/${payment1}/reverse`,managerCsrf,{reason:'Deuxième annulation',request_key:randomUUID()}).expect(409);
  await post(manager,`/api/ledger/${reversed.body.id}/reverse`,managerCsrf,{reason:'Annuler une annulation',request_key:randomUUID()}).expect(409);
  await post(manager,`/api/ledger/${payment2}/reverse`,managerCsrf,{reason:'Autre paiement à corriger',request_key:randomUUID()}).expect(201);
  assert.equal((await secretary.get(`/api/students/${student1}`)).body.valid_until,null);
  await manager.delete(`/api/ledger/${payment1}`).set('X-CSRF-Token',managerCsrf).expect(404);
  assert.equal((await rows('SELECT COUNT(*) AS total FROM gr_ledger WHERE id=?',[payment1]))[0].total,1);
});
test('Absence de SQL injectée et refus des identifiants invalides',async()=>{
  const result=await secretary.get('/api/students').query({q:"' OR 1=1 --"}).expect(200);assert.equal(result.body.total,0);
  await secretary.get('/api/students/abc').expect(400);
  await secretary.get('/api/dashboard?school_year=2026-2028').expect(400);
  await secretary.get('/api/students?status=toString').expect(200);
});
test('Paiement et annulation simultanés : pas de validité perdue',async()=>{
  const first=await post(other,'/api/payments',otherCsrf,{student_id:student2,tariff_id:1,method:'cash',request_key:randomUUID()}).expect(201);
  const results=await Promise.all([
    post(other,'/api/payments',otherCsrf,{student_id:student2,tariff_id:1,method:'cash',request_key:randomUUID()}),
    post(manager,`/api/ledger/${first.body.id}/reverse`,managerCsrf,{reason:'Correction pendant renouvellement',request_key:randomUUID()}),
  ]);
  assert.deepEqual(results.map(r=>r.status),[201,201]);
  assert.equal((await other.get(`/api/students/${student2}`)).body.valid_until,addDays(today(),45));
  assert.equal((await other.get('/api/ledger')).body.totals.balance,6000);
});
test('Modification d’accès : révocation immédiate des sessions',async()=>{
  await manager.put(`/api/users/${secretaryId}`).set('X-CSRF-Token',managerCsrf).send({name:'Secrétaire Biyem',email:'secretary@example.com',center_id:1,active:false,password:''}).expect(200);
  await secretary.get('/api/students').expect(401);
  secretaryCsrf=(await secretary.get('/api/auth/bootstrap')).body.csrf;
  await post(secretary,'/api/auth/login',secretaryCsrf,{email:'secretary@example.com',password}).expect(401);
});
test('Changement du mot de passe : toutes les sessions sont révoquées',async()=>{
  const second=request.agent(app);let csrf=(await second.get('/api/auth/bootstrap')).body.csrf;
  csrf=(await post(second,'/api/auth/login',csrf,{email:'manager@example.com',password}).expect(200)).body.csrf;
  await post(manager,'/api/auth/password',managerCsrf,{current_password:password,password:'Ma nouvelle phrase de passe 2026!'}).expect(200);
  await manager.get('/api/dashboard').expect(401);await second.get('/api/dashboard').expect(401);
  assert.ok((await rows("SELECT id FROM gr_audit WHERE action='account.password_changed'")).length);
});
