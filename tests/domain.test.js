import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, calculateValidity, validity, schemas, schoolYear, ensureScope } from '../src/domain.js';

test('Seuils de validité : 21, 20, 10, 9, 1, 0 jours et non payé',()=>{
  for(const [days,status] of [[21,'active'],[20,'warning'],[10,'warning'],[9,'urgent'],[1,'urgent'],[0,'expired'],[-1,'expired']]) assert.equal(validity(addDays('2026-11-11',days),'2026-11-11').status,status);
  assert.equal(validity(null).status,'unpaid');
});
test('Renouvellement anticipé, reprise après expiration et inscription sans jours',()=>{
  assert.equal(calculateValidity([{operation_date:'2026-01-15',duration_days:30},{operation_date:'2026-01-20',duration_days:30}]),'2026-03-16');
  assert.equal(calculateValidity([{operation_date:'2026-01-15',duration_days:30},{operation_date:'2026-04-01',duration_days:30}]),'2026-05-01');
  assert.equal(calculateValidity([{operation_date:'2026-01-15',duration_days:0}]),null);
});
test('Validation des montants, mots de passe et sessions',()=>{
  assert.equal(schoolYear.safeParse('2026-2028').success,false);
  assert.equal(schemas.setup.safeParse({name:'Manager',email:'a@example.com',password:'short',token:'x'.repeat(32)}).success,false);
  assert.equal(schemas.tariff.safeParse({name:'Mensuel',amount:-10,duration_days:30}).success,false);
  assert.equal(schemas.tariff.safeParse({name:'Mensuel',amount:100.5,duration_days:30}).success,false);
});
test('Une secrétaire ne peut choisir le siège d’une autre secrétaire',()=>{
  assert.throws(()=>ensureScope({role:'secretary',center_id:1},2));
  assert.doesNotThrow(()=>ensureScope({role:'manager',center_id:null},2));
});
