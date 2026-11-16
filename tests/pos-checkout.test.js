const fs=require('fs'),vm=require('vm'),path=require('path');
const root=(process.argv[2] || require('path').join(__dirname, '..'));
const els={};
const mk=(id)=>{const cls=new Set();return els[id]||(els[id]={id,value:'',textContent:'',innerHTML:'',checked:true,disabled:false,style:{},dataset:{},
 classList:{add:(c)=>cls.add(c),remove:(c)=>cls.delete(c),contains:(c)=>cls.has(c),toggle(){},_s:cls},handlers:{},
 addEventListener(t,f){(this.handlers[t]=this.handlers[t]||[]).push(f)},focus(){},showModal(){this.open=true},close(){this.open=false},open:false,setAttribute(){},getAttribute(){return null},closest(){return null},querySelector(){return null},querySelectorAll(){return []}})};
const toasts=[];const calls={rpc:0,inserts:[],uploads:[],fetches:[]};
let failRpc=false,failUpload=false;
const doc={getElementById:mk,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},body:{classList:{add(){},remove(){},contains:()=>false}}};
const ctx={document:doc,console,Intl,Date,Math,JSON,Promise,Map,Set,Uint8Array,Blob,atob,setTimeout,clearTimeout,
 localStorage:{_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=String(v)},removeItem(k){delete this._d[k]}},
 matchMedia:()=>({matches:false,addEventListener(){}}),
 window:null,
 fetch:async(u,o)=>{calls.fetches.push({u,body:JSON.parse(o.body)});return {ok:true,json:async()=>({success:true})}}};
ctx.window=ctx;ctx.setInterval=()=>0;ctx.clearInterval=()=>{};ctx.sessionStorage={getItem(){return null},setItem(){},removeItem(){}};ctx.addEventListener=()=>{};ctx.removeEventListener=()=>{};
const client={from:(t)=>({insert:async(row)=>{calls.inserts.push({t,row});return {error:null}}}),
 rpc:async()=>{calls.rpc++;return failRpc?{data:null,error:{message:'boom'}}:{data:String(1000+calls.rpc-1).padStart(6,'0'),error:null}},
 storage:{from:(b)=>({upload:async(p)=>{if(failUpload)return {error:{message:'denied'}};calls.uploads.push({b,p});return {error:null}}})}};
ctx.WoofAuth={getClient:async()=>client,requireStaff:async()=>({}),getAccessToken:async()=>'tok',getSession:async()=>({}),signOut:async()=>{}};
ctx.SUPABASE_CONFIG={supabaseUrl:'x',supabaseAnonKey:'x'};
vm.createContext(ctx);
ctx.ui={showToast:(m,t)=>toasts.push({m,t}),confirm:async()=>true};
for(const f of ['js/utils.js','js/app.js']){vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});}
vm.runInContext('globalThis.POSApp=POSApp; globalThis.ui=globalThis.ui||ui;',ctx);
// utils defines its own ui; override toast sink
ctx.ui.showToast=(m,t)=>toasts.push({m,t});
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n)};
(async()=>{
 const app=new ctx.POSApp();
 await new Promise(r=>setTimeout(r,50));
 app.products=[{id:1,name:'Tag',price:35,category:'Tags',image:''},{id:2,name:'Charm',price:20,category:'Tags',image:''}];
 app.saveCart=()=>{};app.renderCart=()=>{};app.closeCartSheet=()=>{};app.updateCustomerEmailFromComposer=()=>{};app.clearCustomerInfo=()=>{};
 app.generateInvoicePdfBase64=async()=> 'QUJD';
 const fee=()=>els['delivery-fee'].textContent, tot=()=>els['total'].textContent, hint=()=>els['delivery-hint'];
 app.setFulfilment('delivery');
 app.cart=[{productId:1,name:'Tag',price:35,quantity:1}];app.updateTotals();
 ok(fee()==='$2.50'&&tot()==='$37.50','under 50: fee 2.50, total 37.50 ('+fee()+','+tot()+')');
 ok(!hint().classList.contains('hidden')&&/15\.00/.test(hint().textContent),'hint says add $15.00 ('+hint().textContent+')');
 app.cart=[{productId:1,name:'Tag',price:35,quantity:1},{productId:2,name:'Charm',price:15,quantity:1}];app.updateTotals();
 ok(fee()==='Free'&&tot()==='$50.00','exactly 50: free delivery');
 app.cart=[{productId:1,name:'Tag',price:52,quantity:1}];app.discountApplied=true;app.updateTotals();
 ok(fee()==='$2.50'&&tot()==='$51.90','52 with 5% off = 49.40 -> delivery charged, total 51.90 ('+tot()+')');
 app.discountApplied=false;app.cart=[{productId:1,name:'Tag',price:35,quantity:1}];
 app.setFulfilment('collect');app.updateTotals();
 ok(fee()==='Pickup'&&tot()==='$35.00'&&hint().classList.contains('hidden'),'pickup: no fee, total 35, hint hidden');
 app.setFulfilment('delivery');app.cart=[];app.updateTotals();
 ok(tot()==='$0.00','empty cart total 0');
 // order flow: delivery
 app.cart=[{productId:1,name:'Tag',price:35,quantity:1}];mk('customer-email').value='a@b.co';mk('customer-name').value='Sam';mk('customer-phone').value='91234567';mk('customer-address').value='1 Test Road';app.paymentMethod='paynow';
 await app.sendOrderEmail();
 let ins=calls.inserts[0]&&calls.inserts[0].row;
 ok(ins&&ins.order_id==='001000'&&ins.delivery_fee===2.5&&ins.total===37.5,'order 001000 logged with delivery 2.5, total 37.5');
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore'}).format(new Date());
 ok(calls.uploads[0]&&calls.uploads[0].b==='invoices'&&calls.uploads[0].p===day+'/WoofCrafts_Order_001000.pdf','pdf filed at '+(calls.uploads[0]&&calls.uploads[0].p));
 ok(calls.fetches[0]&&calls.fetches[0].body.invoiceNumber==='001000'&&calls.fetches[0].u==='/api/send-invoice','email request for 001000');
 ok(app.cart.length===0&&app.pendingOrderId===null&&app.fulfilmentTouched===false&&app.paymentMethod==='','cart cleared, pending id reset, choices reset');
 ok(/Order #001000 saved/.test(els['order-done-body'].innerHTML)&&els['order-done'].open===true,'saved screen shown for 001000');
 // second order, pickup
 app.cart=[{productId:1,name:'Tag',price:35,quantity:1}];app.setFulfilment('collect');app.paymentMethod='cash';mk('customer-email').value='c@d.co';
 await app.sendOrderEmail();
 ins=calls.inserts[1].row;
 ok(ins.order_id==='001001'&&ins.delivery_fee===0&&ins.total===35,'order 001001 pickup: delivery 0, total 35');
 // rpc failure
 failRpc=true;app.cart=[{productId:1,name:'Tag',price:10,quantity:1}];app.setFulfilment('delivery');app.paymentMethod='cash';mk('customer-email').value='e@f.co';
 const before=calls.inserts.length;await app.sendOrderEmail();failRpc=false;
 ok(calls.inserts.length===before&&!mk('send-banner').classList.contains('hidden')&&/boom/.test(mk('send-banner-text').textContent)&&mk('send-email-btn').disabled===false,'rpc failure: no order saved, persistent banner, button re-enabled');
 // upload failure still emails
 failUpload=true;const fb=calls.fetches.length;app.cart=[{productId:1,name:'Tag',price:60,quantity:1}];app.paymentMethod='cash';
 await app.sendOrderEmail();failUpload=false;
 ok(calls.fetches.length===fb+1&&/PDF could not be filed/.test(els['order-done-body'].innerHTML),'upload failure: email still sent, warning shown');
 ok(app.invoiceFolderFor('2026-11-14T17:30:00Z')==='2026-11-15','Singapore date folder rolls over at 16:00 UTC');
 const list=mk('purchases-list');app.renderPurchasesList([{id:'a',order_id:'001001',total:35,created_at:'2026-11-15T03:00:00Z'},{id:'b',order_id:'001000',total:37.5,created_at:'2026-11-15T01:00:00Z'},{id:'c',order_id:'009344',total:20,created_at:'2026-11-13T05:00:00Z'}]);
 ok((list.innerHTML.match(/purchase-date-heading/g)||[]).length===2&&/Sun, 15 Nov 2026/.test(list.innerHTML),'purchases grouped under 2 date headings');
 const det=mk('purchase-details');app.renderPurchaseDetails({order_id:'001000',created_at:'2026-11-15T01:00:00Z',items:[{name:'Tag',quantity:1,price:35,subtotal:35}],subtotal:35,discount_amount:0,delivery_fee:2.5,total:37.5});
 ok(/Delivery/.test(det.innerHTML)&&/invoice-open-btn/.test(det.innerHTML)&&/data-invoice-order="001000"/.test(det.innerHTML),'details show delivery row and invoice button');
 console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2)});
