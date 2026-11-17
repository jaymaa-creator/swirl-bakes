import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

test('bake dashboard renders fulfilment and independent paid/completed controls with honest totals',async()=>{
  const server=await createServer({cacheDir:'node_modules/.vite-bake-orders-test',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
  try{
    const {comingSaturday}=await server.ssrLoadModule('/src/admin/stockDates.js');
    for(const value of ['2026-11-19T16:01:00Z','2026-11-20T16:01:00Z','2026-11-21T15:59:00Z'])assert.equal(comingSaturday(new Date(value)),'2026-11-21');
    assert.equal(comingSaturday(new Date('2026-11-21T16:00:00Z')),'2026-11-28');
    const {BakeOrdersView}=await server.ssrLoadModule('/src/admin/BakeOrders.jsx');
    const order={orderNumber:'SG-FIXTURE',revision:'a'.repeat(64),name:'Fixture Customer',phone:'6591234567',itemsText:'Cake (box) x2',items:[{name:'Cake (box)',quantity:2}],amountCents:2550,deliveryCostCents:null,deliveryCostInvalid:false,status:'New',paid:false,completed:false,cancelled:false,duplicate:false,editable:true,fulfilment:'Delivery',address:'10 Fixture Road',notes:'Allergy note',collectionSlot:''};
    const props={data:{batch:'2026-11-21',bakeDates:['2026-11-21'],orders:[order],source:'test-orders',refreshedAt:'2026-11-10T00:00:00Z',quality:{invalidDate:0,duplicates:0,missingReference:0,invalidAmount:0,invalidItems:0}},filter:'all'};
    const render=changes=>renderToStaticMarkup(React.createElement(BakeOrdersView,{...props,...changes}));
    const html=render();for(const text of ['This coming bake','Quantities to prepare','Mark paid','Mark completed','10 Fixture Road','Allergy note','Test Sheet','Paid','Our delivery cost (S$)','Save delivery cost'])assert.ok(html.includes(text));
    assert.match(html,/placeholder="Not recorded"/);
    const zeroCost=render({data:{...props.data,orders:[{...order,deliveryCostCents:0}]}});assert.match(zeroCost,/value="0.00"/);
    const collection=render({data:{...props.data,orders:[{...order,fulfilment:'Self-collection'}]}});assert.doesNotMatch(collection,/Save delivery cost/);
    const confirm=render({confirmation:{order,change:'paid'}});assert.match(confirm,/checked that this payment arrived in the bank/);assert.match(confirm,/Confirm paid/);
    const completed=render({data:{...props.data,orders:[{...order,completed:true,status:'Closed'}]}});assert.match(completed,/Mark paid/);assert.doesNotMatch(completed,/Mark completed/);
    const conflict=render({error:'Refresh before updating'});assert.match(conflict,/disabled=""[^>]*>Mark paid/);
    assert.match(render({data:{...props.data,orders:[],batch:''}}),/No upcoming bake is scheduled/);
  }finally{await server.close();}
});
