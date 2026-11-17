import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAdminStock} from '../src/admin/stock.js';
const batch='2026-11-21';
const menu={batchKey:batch,shopping:{batchKey:batch,generatedAt:'2026-11-17T00:00:00Z',warnings:[],items:[{id:'flour',name:'Flour',unit:'g',quantity:1200,location:'Cupboard',forProducts:['Sourdough']}],privateRows:['no']},privateRows:['no']};
const req=(host='swirlgirl.sg',query=batch,method='GET')=>new Request(`https://${host}/api/admin/stock?batch=${query}`,{method});
test('private stock read validates published bake and allowlists ingredients only',async()=>{
 const response=await handleAdminStock(req(),{},async()=>menu),data=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(data.source,'production');
 assert.equal(data.shopping.items[0].quantity,1200);assert.equal(data.privateRows,undefined);assert.equal(data.shopping.privateRows,undefined);
 for(const bad of [{...menu,batchKey:'2026-11-28'},{...menu,shopping:{...menu.shopping,batchKey:'2026-11-28'}},{...menu,shopping:null}])assert.equal((await handleAdminStock(req(),{},async()=>bad)).status,409);
 assert.equal((await handleAdminStock(req(),{},async()=>{throw Error('private');})).status,503);
});
test('stock read rejects wrong hosts, environment mixing, invalid dates and writes',async()=>{
 const noRead=()=>assert.fail('must not read');
 assert.equal((await handleAdminStock(req('preview.invalid'),{},noRead)).status,503);
 assert.equal((await handleAdminStock(req(),{ISOLATED_TEST_BACKEND:true},noRead)).status,503);
 assert.equal((await handleAdminStock(req('test-swirl-girl.jaemcd95.workers.dev'),{},noRead)).status,503);
 assert.equal((await handleAdminStock(req('swirlgirl.sg',batch,'POST'),{},noRead)).status,405);
 for(const date of ['', '2026-02-30','2026-11-20','bad'])assert.equal((await handleAdminStock(req('swirlgirl.sg',date),{},noRead)).status,400);
 const response=await handleAdminStock(req('test-swirl-girl.jaemcd95.workers.dev'),{ISOLATED_TEST_BACKEND:true},async()=>menu);assert.equal((await response.json()).source,'test');
 for(const item of [{...menu.shopping.items[0],quantity:-1},{...menu.shopping.items[0],name:null}])assert.equal((await handleAdminStock(req(),{},async()=>({...menu,shopping:{...menu.shopping,items:[item]}}))).status,503);
});
