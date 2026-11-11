import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { handleBakeOrders, validateBakeOrders } from '../src/admin/bakeOrders.js';
import { summariseBakeOrders, parseDeliveryCost } from '../src/admin/bakeOrderSummary.js';
const source = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const headers = ['Order No','Saturday Batch','Name','Phone','Items','Amount Due','Total','Paid?','Status','Fulfilment','Collection Slot','Delivery Address','Notes','Request ID'];
const row = (changes = {}) => Object.assign(['SG-001','2026-11-21','Fixture','+33687146229','Cinnamon Swirls (box of 3) x1, Sourdough (loaf) x2',25.5,99,false,'New','Self-collection','11am-12pm','','Allergy note','request-1'], changes);
const clean = value => JSON.parse(JSON.stringify(value));
function harness(rows = [row()], columns = headers, formulas = {}) {
  const events = [], values = rows.map(r => [...r]), sheetHeaders = [...columns];
  const sheet = { getLastRow: () => values.length + 1, getLastColumn: () => sheetHeaders.length, getMaxColumns:()=>100, insertColumnsAfter: (column, count)=>events.push(['insertColumns',column,count]),
    getDataRange: () => ({ getValues: () => [sheetHeaders, ...values.map(r => Array.from({length:sheetHeaders.length},(_,i)=>r[i] ?? ""))] }),
    getRange: (r, c) => ({ getFormula:()=>formulas[`${r},${c}`] || '', setValue: value => { events.push(['write',r,c,value]); if(r===1)sheetHeaders[c-1]=value;else values[r-2][c-1] = value; } }) };
  const ctx = vm.createContext({ Date, console, ScriptApp: { getScriptId: () => '1YfNLgt5YZnDv8CwcR9zcGICM4v0jjfMCs9lzD_pWVh5M8O5Yc5xMVnhf' },
    Utilities: { DigestAlgorithm: {SHA_256:'sha256'}, Charset: {UTF_8:'utf8'}, computeDigest: (_type,text) => [...createHash('sha256').update(text).digest()], formatDate: date => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).format(date) },
    SpreadsheetApp: { openById: () => ({getSheetByName:()=>sheet}), flush: () => events.push('flush') },
    LockService: { getScriptLock: () => ({waitLock:()=>events.push('lock'),releaseLock:()=>events.push('unlock')}) } });
  vm.runInContext(source,ctx);
  ctx.earnReferralCreditForOrder = () => events.push('referral');
  ctx.reportReferralLedgerSyncFailure = () => events.push('deferred');
  ctx.readBakeCalendar = () => [{date:'2026-11-21',open:true}];
  const report = (requested='',today='2026-11-10',calendar=[{date:'2026-11-21',open:true}]) => clean(ctx.buildAdminBakeOrders(sheetHeaders,values,calendar,requested,today));
  const update = (change='paid',overrides={}) => clean(ctx.updateAdminBakeOrder({environment:'production',orderNumber:values[0][0],batch:'2026-11-21',revision:ctx.adminOrderRevision(values[0]),change,...overrides}));
  return {ctx,values,events,report,update,sheetHeaders};
}

test('upcoming bake remains through cutoff and bake day, honours closed dates with orders and handles no future bake',()=>{
  const h=harness();
  for(const today of ['2026-11-10','2026-11-20','2026-11-21']) assert.equal(h.report('',today).batch,'2026-11-21');
  assert.equal(h.report('','2026-11-22').batch,'');
  assert.equal(h.report('','2026-11-20',[{date:'2026-11-28',open:true}]).batch,'2026-11-21');
  assert.equal(h.report('2026-11-28').orders.length,0);
  assert.equal(h.ctx.adminBakeDate(new Date('2026-11-20T16:01:00Z')),'2026-11-21');
  assert.equal(h.ctx.adminBakeDate('21/11/2026'),'2026-11-21');
  assert.equal(h.ctx.adminBakeDate('Sat, 21 Nov 2026'),'2026-11-21');
  assert.equal(h.ctx.adminBakeDate('31/02/2026'),'');
});

test('item totals preserve units, add-ons, names and cancellations; duplicates never inflate summary',()=>{
  const h=harness([row(),row({0:'SG-002',4:'Banana Cake (cake) x2, Chocolate chips for Banana Cake x2 (+S$4.00), Tote bag (bag) x1',5:54,7:true,8:'Closed',13:'r2'}),row({0:'SG-003',8:'Cancelled',13:'r3'}),row({0:'SG-004',13:'duplicate'}),row({0:'SG-005',13:'duplicate'})]);
  const report=h.report(), summary=summariseBakeOrders(report.orders);
  assert.equal(summary.orders,2);assert.equal(summary.completed,1);assert.equal(summary.unpaid,1);assert.equal(summary.unpaidCents,2550);
  assert.equal(summary.items.find(i=>i.name==='Sourdough (loaf)').quantity,2);
  assert.equal(summary.items.find(i=>i.name==='Chocolate chips for Banana Cake').quantity,2);
  assert.equal(summary.items.find(i=>i.name==='Tote bag (bag)').quantity,1);
  assert.equal(report.quality.duplicates,2);assert.equal(report.orders[2].editable,false);
  assert.equal(report.orders[0].phone,'33687146229');assert.equal(report.orders[0].amountCents,2550);
  assert.equal(h.ctx.adminOrderItems('Cake x2, unknown'),null);
  assert.equal(h.ctx.adminOrderItems('Cake x0'),null);
});

test('quality warnings expose unsafe records and empty formatted rows do not become orders',()=>{
  const h=harness([row({0:'',4:'handwritten order',5:'bad'}),row({0:'SG-bad-date',1:'nonsense',13:'other'}),Array(headers.length).fill('')]);
  const report=h.report();assert.equal(report.orders.length,1);assert.equal(report.orders[0].editable,false);
  assert.deepEqual(report.quality,{invalidDate:1,duplicates:0,missingReference:1,invalidAmount:1,invalidItems:1});
  assert.equal(summariseBakeOrders(report.orders).orders,0);
});

test('paid updates only Paid under lock, reruns idempotent referral processing and reports deferred credits',()=>{
  const h=harness(), before=[...h.values[0]], revision=h.ctx.adminOrderRevision(before);
  assert.deepEqual(h.update(),{ok:true,saved:true,referralDeferred:false});
  assert.deepEqual(h.values[0],Object.assign([...before],{7:true}));
  assert.deepEqual(h.events,['lock',['write',2,8,true],'flush','referral','flush','unlock']);
  assert.equal(h.update('paid',{revision}).ok,true);assert.equal(h.events.filter(e=>Array.isArray(e)).length,1);
  h.ctx.earnReferralCreditForOrder=()=>{throw new Error('failure');};
  assert.equal(h.update().referralDeferred,true);assert.equal(h.values[0][7],true);
});

test('completion writes existing Closed value, leaves unpaid orders unpaid and preserves legacy Paid',()=>{
  for(const [status,paid] of [['New',false],['Paid',true]]){
    const h=harness([row({8:status})]), before=[...h.values[0]];
    assert.equal(h.update('completed').ok,true);assert.equal(h.values[0][8],'Closed');assert.equal(h.values[0][7],paid);
    assert.equal(h.events.includes('referral'),false);assert.equal(h.values[0][4],before[4]);assert.equal(h.values[0][5],before[5]);
    const writes=h.events.filter(e=>Array.isArray(e)).length;assert.equal(h.update('completed').ok,true);assert.equal(h.events.filter(e=>Array.isArray(e)).length,writes);
  }
});

test('stale revisions, wrong dates, duplicate references and cancelled or malformed records never update',()=>{
  for(const rows of [[row({8:'Cancelled'})],[row(),row({13:'r2'})],[row(),row({0:'SG-other'})],[row({5:'invalid'})],[row({4:'unreadable'})]]){
    const h=harness(rows);assert.equal(h.update().ok,false);assert.equal(h.events.some(e=>Array.isArray(e)),false);
  }
  const h=harness();for(const overrides of [{revision:'a'.repeat(64)},{batch:'2026-11-28'},{environment:'test'},{change:'refunded'},{batch:'2026-02-30'}])assert.equal(h.update('paid',overrides).ok,false);
  assert.equal(h.events.some(e=>Array.isArray(e)),false);
  h.ctx.SpreadsheetApp.openById=()=>{throw new Error('lost');};assert.equal(h.update().errorCode,'ORDER_UPDATE_UNVERIFIED');assert.equal(h.events.at(-1),'unlock');
});

const host='https://swirlgirl.sg';
const env={ORDER_WEBHOOK_SECRET:'fixture-secret',ORDER_SHEET_WEBHOOK_URL:'https://fixture.invalid/script'};
const req=(data,headers={})=>new Request(host+'/api/admin/bake-orders',{method:'POST',headers:{Origin:host,'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
test('Worker restricts hosts, methods, origins, size and input before any backend request',async(t)=>{
  t.mock.method(globalThis,'fetch',()=>assert.fail('No backend request expected'));
  const update={orderNumber:'SG-001',batch:'2026-11-21',revision:'a'.repeat(64),change:'paid'};
  for(const origin of ['http://swirlgirl.sg','https://www.swirlgirl.sg','https://preview.example','https://test-swirl-girl.jaemcd95.workers.dev'])assert.equal((await handleBakeOrders(new Request(origin+'/api/admin/bake-orders'),env)).status,503);
  assert.equal((await handleBakeOrders(req(update,{Origin:'https://evil.example'}),env)).status,403);
  assert.equal((await handleBakeOrders(req(update,{'Content-Type':'text/plain'}),env)).status,415);
  assert.equal((await handleBakeOrders(req({...update,notes:'x'.repeat(2001)}),env)).status,413);
  for(const change of ['cancelled','refunded','unpaid',null])assert.equal((await handleBakeOrders(req({...update,change}),env)).status,400);
  assert.equal((await handleBakeOrders(new Request(host+'/api/admin/bake-orders?batch=2026-02-30'),env)).status,400);
});

test('Worker allowlists private response fields and update command, labels source, and preserves ambiguous failure',async(t)=>{
  const h=harness();const report={...h.report(),source:'production-orders',refreshedAt:new Date().toISOString()};
  let reply={...report,secret:'private',rawRows:['private']}, sent;
  t.mock.method(globalThis,'fetch',async(_url,options)=>{sent=JSON.parse(options.body);return Response.json(reply);});
  const response=await handleBakeOrders(new Request(host+'/api/admin/bake-orders'),env);assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal((await response.json()).rawRows,undefined);
  assert.equal(sent.action,'adminBakeOrders');assert.equal(sent.environment,'production');
  assert.throws(()=>validateBakeOrders({...report,source:'test-orders'},'production'));
  reply={ok:true,saved:true,referralDeferred:false,rawRows:['private']};
  const update={orderNumber:'SG-001',batch:'2026-11-21',revision:'a'.repeat(64),change:'paid'};
  assert.deepEqual(await(await handleBakeOrders(req({...update,secret:'attacker',environment:'test',paid:false}),env)).json(),{ok:true,referralDeferred:false});
  assert.equal(sent.secret,'fixture-secret');assert.equal(sent.environment,'production');assert.equal(sent.paid,undefined);
  reply={ok:false,errorCode:'ORDER_CONFLICT'};assert.equal((await handleBakeOrders(req(update),env)).status,409);
  reply={ok:false,errorCode:'ORDER_UPDATE_UNVERIFIED',saved:true};assert.match((await(await handleBakeOrders(req(update),env)).json()).error,/Refresh/);
});


test('delivery cost uses exact cents, distinguishes blank from zero and saves only the expense cell',()=>{
  for(const [text,cents] of [['0',0],['0.00',0],['12.5',1250],[' 12.59 ',1259],['1000',100000]])assert.equal(parseDeliveryCost(text),cents);
  for(const text of ['', ' ', '-1', '12.345', '1e2', '1,000', '1000.01', 'NaN', '0x10', '.5'])assert.equal(parseDeliveryCost(text),null);
  const delivery=row({9:'Delivery - S$15'}), h=harness([delivery]);
  assert.equal(h.report().orders[0].deliveryCostCents,null);
  h.ctx.SpreadsheetApp.openById().getSheetByName().getMaxColumns=()=>14;
  const before=[...h.values[0]];
  assert.deepEqual(h.update('deliveryCost',{deliveryCostCents:1259}),{ok:true,saved:true,referralDeferred:false});
  assert.deepEqual(h.events.find(e=>Array.isArray(e)&&e[0]==='insertColumns'),['insertColumns',14,1]);
  assert.equal(h.sheetHeaders.at(-1),'delivery_cost');assert.equal(h.values[0][14],12.59);
  assert.deepEqual(h.values[0].slice(0,14),before);assert.equal(h.events.includes('referral'),false);
  assert.equal(h.report().orders[0].deliveryCostCents,1259);
  assert.equal(h.update('deliveryCost',{deliveryCostCents:0}).ok,true);assert.equal(h.report().orders[0].deliveryCostCents,0);
  assert.equal(h.sheetHeaders.filter(c=>c==='delivery_cost').length,1);
});

test('delivery expense updates paid/completed orders but rejects stale, cancelled, collection, formulas and invalid input',()=>{
  const columns=[...headers,'delivery_cost'];
  for(const status of ['New','Closed','Paid']){
    const h=harness([row({9:'Delivery',8:status,14:10})],columns),before=[...h.values[0]],stale=h.ctx.adminOrderRevision(before);
    assert.equal(h.update('deliveryCost',{deliveryCostCents:1700}).ok,true);
    assert.deepEqual(h.values[0],Object.assign([...before],{14:17}));
    assert.equal(h.update('deliveryCost',{deliveryCostCents:1900,revision:stale}).errorCode,'ORDER_CONFLICT');
    assert.equal(h.values[0][14],17);assert.equal(h.events.includes('referral'),false);
  }
  for(const [values,formulas] of [[row(),{}],[row({9:'Delivery',8:'Cancelled'}),{}],[row({9:'Delivery',14:12}),{'2,15':'=6*2'}]]){
    const h=harness([values],columns,formulas);assert.equal(h.update('deliveryCost',{deliveryCostCents:1200}).ok,false);assert.equal(h.events.some(Array.isArray),false);
  }
  const h=harness([row({9:'Delivery'})]);
  for(const value of [-1,1.2,100001,'1200',null,undefined,NaN,Infinity])assert.equal(h.update('deliveryCost',{deliveryCostCents:value}).errorCode,'ORDERS_INPUT');
  assert.equal(h.events.some(Array.isArray),false);
  const duplicate=harness([row({9:'Delivery',14:1,15:2})],[...columns,'delivery_cost']);
  assert.equal(duplicate.update('deliveryCost',{deliveryCostCents:1200}).errorCode,'ORDERS_SCHEMA');assert.equal(duplicate.events.some(Array.isArray),false);
  const invalid=harness([row({9:'Delivery',14:'unknown'})],columns).report().orders[0];assert.equal(invalid.deliveryCostInvalid,true);assert.equal(invalid.deliveryCostCents,null);
});

test('Worker validates and allowlists delivery costs without forwarding customer total changes',async(t)=>{
  let sent;
  t.mock.method(globalThis,'fetch',async(_url,options)=>{sent=JSON.parse(options.body);return Response.json({ok:true,saved:true,referralDeferred:false});});
  const update={orderNumber:'SG-001',batch:'2026-11-21',revision:'a'.repeat(64),change:'deliveryCost'};
  for(const deliveryCostCents of [-1,0.1,100001,'1200',null])assert.equal((await handleBakeOrders(req({...update,deliveryCostCents}),env)).status,400);
  assert.equal(sent,undefined);
  assert.equal((await handleBakeOrders(req({...update,deliveryCostCents:1259,amountDue:99,paid:true}),env)).status,200);
  assert.equal(sent.deliveryCostCents,1259);assert.equal(sent.amountDue,undefined);assert.equal(sent.paid,undefined);
  const h=harness(),report={...h.report(),source:'production-orders',refreshedAt:new Date().toISOString()};
  const validate=order=>validateBakeOrders({...report,orders:[{...report.orders[0],...order}]},'production');
  assert.throws(()=>validate({deliveryCostCents:-1}));assert.throws(()=>validate({deliveryCostInvalid:'yes'}));
  assert.equal(validate({deliveryCostCents:0}).orders[0].deliveryCostCents,0);
});
