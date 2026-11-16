// Weak Wi-Fi protection: queue, sync, product cache, draft, service worker routing.
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=process.argv[2]||path.join(__dirname,'..');
const els={};
const mk=(id)=>{const cls=new Set();return els[id]||(els[id]={id,value:'',textContent:'',innerHTML:'',checked:true,disabled:false,style:{},dataset:{},
 classList:{add:(...c)=>c.forEach(x=>cls.add(x)),remove:(...c)=>c.forEach(x=>cls.delete(x)),contains:(c)=>cls.has(c),toggle(c,f){f?cls.add(c):cls.delete(c)}},
 addEventListener(){},focus(){},showModal(){this.open=true},close(){this.open=false},open:false,setAttribute(){},removeAttribute(){},getAttribute(){return null},closest(){return null},querySelector(){return null},querySelectorAll(){return []}})};
const calls={rpc:0,inserts:[],uploads:[],fetches:[],updates:[]};
let net=true,failSelect=false;
const netErr=()=>({message:'TypeError: Failed to fetch'});
const client={
 from:(t)=>({
  insert:async(row)=>{if(!net)return{error:netErr()};if(calls.inserts.some(i=>i.row.id&&i.row.id===row.id))return{error:{code:'23505',message:'duplicate key value'}};calls.inserts.push({t,row});return{error:null}},
  select:()=>{if(failSelect||!net)return{order:()=>Promise.resolve({data:null,error:netErr()})};return{order:()=>Promise.resolve({data:[{id:1,title:'Tag',description:'',price:10,category:'tags',image_url:'',needs_details:true}],error:null})}},
  update:(v)=>({eq:async()=>{if(!net)return{error:netErr()};calls.updates.push(v);return{error:null}}})}),
 rpc:async()=>{if(!net)return{data:null,error:netErr()};calls.rpc++;return{data:String(2000+calls.rpc),error:null}},
 storage:{from:()=>({upload:async(p)=>{if(!net)return{error:netErr()};calls.uploads.push(p);return{error:null}}})}};
const store=new Map();
const WoofQueue={
 newRecord(details,photos){return{queueId:details.rowId||'q'+store.size,queuedAt:new Date().toISOString(),details,photos:photos||[],progress:{orderId:null,logged:false,photosSaved:false,pdfSaved:false,emailed:false},attempts:0,lastError:''}},
 async add(r){store.set(r.queueId,JSON.parse(JSON.stringify({...r,photos:0}))&&{...r});},async put(r){store.set(r.queueId,r)},
 async all(){return [...store.values()]},async remove(id){store.delete(id)},async count(){return store.size}};
const nav={onLine:true};
const ctx={document:{getElementById:mk,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},body:{classList:{add(){},remove(){},contains:()=>false}}},
 console:{log(){},warn(){},error(){}},Intl,Date,Math,JSON,Promise,Map,Set,Uint8Array,Blob,atob,setTimeout,clearTimeout,
 localStorage:{_d:{},getItem(k){return this._d[k]??null},setItem(k,v){this._d[k]=String(v)},removeItem(k){delete this._d[k]}},
 matchMedia:()=>({matches:false,addEventListener(){}}),navigator:nav,WoofQueue,
 fetch:async(u,o)=>{if(!net)throw new TypeError('Failed to fetch');calls.fetches.push({u,body:JSON.parse(o.body)});return{ok:true,json:async()=>({success:true})}}};
ctx.window=ctx;ctx.setInterval=()=>0;ctx.clearInterval=()=>{};ctx.sessionStorage={getItem(){return null},setItem(){},removeItem(){}};ctx.addEventListener=()=>{};
ctx.WoofAuth={getClient:async()=>client,requireStaff:async()=>({}),getAccessToken:async()=>'tok',getSession:async()=>({}),signOut:async()=>{}};
ctx.SUPABASE_CONFIG={supabaseUrl:'x',supabaseAnonKey:'x'};
vm.createContext(ctx);
for(const f of ['js/utils.js','js/app.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
vm.runInContext('globalThis.POSApp=POSApp;',ctx);
const toasts=[];ctx.ui.showToast=(m,t)=>toasts.push({m,t});ctx.ui.confirm=async()=>true;
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n)};
(async()=>{
 const app=new ctx.POSApp();await new Promise(r=>setTimeout(r,50));
 app.products=[{id:1,name:'Tag',price:10,category:'Tags',image:''}];
 app.saveCart=()=>{};app.renderCart=()=>{};app.closeCartSheet=()=>{};app.updateCustomerEmailFromComposer=()=>{};
 app.generateInvoicePdfBase64=async()=>'QUJD';
 const fill=()=>{app.cart=[{productId:1,name:'Tag',price:10,quantity:1}];app.setFulfilment('taken_now');app.paymentMethod='cash';mk('customer-name').value='Amy';mk('customer-phone').value='91234567';mk('customer-email').value='a@b.co';app.syncCartTags&&app.syncCartTags();app.cart.forEach(i=>{if(i.tags)i.tags=[{pet:'Milo',ring:'silver',front:'MILO',back:'9123'}]});};

 // 1. offline at the counter: queued, cart cleared, nothing lost
 net=false;nav.onLine=false;fill();
 await app.sendOrderEmail();
 ok(store.size===1,'offline sale is queued');
 ok(app.cart.length===0,'cart cleared after queueing');
 ok(/Saved on this phone/.test(els['order-done-body'].innerHTML),'saved-on-phone screen shown');
 ok(mk('send-banner').classList.contains('hidden'),'no error banner for a queued sale');
 const rec=[...store.values()][0];
 ok(rec.details.orderId===null&&rec.details.customerName==='Amy'&&rec.details.tags.length===1,'queued record holds the full order, no order number yet');
 ok(!mk('conn-chip').classList.contains('hidden')&&/Offline · 1 waiting/.test(mk('conn-chip-text').textContent),'chip says Offline · 1 waiting ('+mk('conn-chip-text').textContent+')');
 await app.syncQueue();
 ok(store.size===1&&calls.inserts.length===0,'sync while offline does nothing');

 // 2. signal returns but drops mid-way: progress is kept, no duplicate
 nav.onLine=true;net=true;
 const realSave=app.saveInvoicePdf.bind(app);let failPdf=true;
 app.saveInvoicePdf=async(...a)=>{if(failPdf)throw new TypeError('Failed to fetch');return realSave(...a)};
 await app.syncQueue();
 const r1=[...store.values()][0];
 ok(store.size===1&&r1.progress.logged&&r1.progress.orderId==='2001'&&calls.inserts.length===1,'row inserted once, order number kept after a dropped signal');
 ok(r1.lastError==='Waiting for signal'&&/waiting/.test(mk('conn-chip-text').textContent),'queue shows waiting for signal');
 failPdf=false;
 await app.syncQueue();
 ok(store.size===0,'queue empties once everything uploads');
 ok(calls.inserts.length===1&&calls.rpc===1,'no second order row and no second order number');
 ok(calls.inserts[0].row.created_at&&calls.inserts[0].row.order_id==='2001','row keeps the time of the sale');
 ok(calls.fetches.length===1&&calls.fetches[0].body.invoiceNumber==='2001','invoice emailed once with the real order number');
 ok(mk('conn-chip').classList.contains('hidden'),'chip hidden when nothing waits');

 // 3. a duplicate row (earlier insert whose reply was lost) counts as done
 fill();net=false;nav.onLine=false;await app.sendOrderEmail();net=true;nav.onLine=true;
 const q=[...store.values()][0];calls.inserts.push({t:'orders',row:{id:q.details.rowId}});
 await app.syncQueue();
 ok(store.size===0,'duplicate-key reply treated as already saved');

 // 3b. two triggers at once never upload the same order twice
 fill();net=false;nav.onLine=false;await app.sendOrderEmail();net=true;nav.onLine=true;
 {const r0=calls.rpc;await Promise.all([app.syncQueue(),app.syncQueue(),app.syncQueue()]);ok(calls.rpc===r0+1&&store.size===0,'simultaneous syncs allocate one order number');}

 // 4. online but the invoice step fails: persistent banner, retry does not duplicate
 fill();let failEmail=true;const f0=ctx.fetch;
 ctx.fetch=async(u,o)=>{if(failEmail)return{ok:false,json:async()=>({success:false,error:'Mail server down'})};return f0(u,o)};
 const ins0=calls.inserts.length;
 await app.sendOrderEmail();
 ok(!mk('send-banner').classList.contains('hidden')&&/Mail server down/.test(mk('send-banner-text').textContent),'email failure leaves a persistent banner');
 ok(app.cart.length===1,'cart kept for retry');
 failEmail=false;await app.sendOrderEmail();
 ok(calls.inserts.length===ins0+1&&mk('send-banner').classList.contains('hidden'),'retry succeeds with one order row, banner cleared');

 // 5. product list cached and used when the load fails
 net=true;await app.loadProducts();
 ok(JSON.parse(ctx.localStorage.getItem('woofcrafts_products_cache')).products.length===1,'product list cached after a good load');
 failSelect=true;app.products=[];app.loadError=null;await app.loadProducts();failSelect=false;
 ok(app.products.length===1&&!app.loadError&&app.productsFromCache,'failed load falls back to saved product list');
 ctx.localStorage.removeItem('woofcrafts_products_cache');failSelect=true;await app.loadProducts();failSelect=false;
 ok(app.products.length===0&&app.loadError,'no saved list: the existing error state still shows');

 // 6. draft
 fill();mk('customer-comment').value='gift wrap';app.saveDraft();
 mk('customer-name').value='';mk('customer-comment').value='';
 app.restoreDraft();
 ok(mk('customer-name').value==='Amy'&&mk('customer-comment').value==='gift wrap','draft restores typed details');
 app.cart=[];app.saveDraft();
 ok(ctx.localStorage.getItem('woofcrafts_draft')===null,'draft dropped when the cart is empty');

 // 7. service worker routing
 const sw=require(path.join(root,'sw.js'));const O='https://pos.test';
 const st=(u,m='GET',mode='no-cors')=>sw.strategyFor(u,m,mode,O);
 ok(st(O+'/api/send-invoice','POST')==='skip'&&st(O+'/api/x')==='skip','API never cached');
 ok(st('https://x.supabase.co/rest/v1/orders')==='skip'&&st('https://x.supabase.co/auth/v1/token')==='skip','database and sign-in never cached');
 ok(st('https://x.supabase.co/storage/v1/object/sign/invoices/a.pdf')==='skip'&&st('https://x.supabase.co/storage/v1/object/authenticated/order-photos/a.jpg')==='skip','private files never cached');
 ok(st('https://x.supabase.co/storage/v1/object/public/product-images/a.jpg')==='stale-while-revalidate','public product photos cached');
 ok(st('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')==='stale-while-revalidate'&&st('https://esm.sh/@supabase/supabase-js@2')==='stale-while-revalidate','CDN libraries cached');
 ok(st(O+'/pos','GET','navigate')==='network-first'&&st(O+'/js/app.js')==='network-first','app files: newest when online, saved copy when not');
 ok(st('https://evil.example/x.js')==='skip','other sites untouched');
 console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})().catch(e=>{console.log('HARNESS ERROR',e);process.exit(1)});
