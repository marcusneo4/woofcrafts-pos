const fs=require('fs'),vm=require('vm'),path=require('path');const root=(process.argv[2] || require('path').join(__dirname, '..'));
const els={};const mk=(id)=>{const cls=new Set();return els[id]||(els[id]={id,value:'',innerHTML:'',textContent:'',disabled:false,files:[],style:{},classList:{add:c=>cls.add(c),remove:c=>cls.delete(c),contains:c=>cls.has(c)},addEventListener(){},reset(){Object.values(els).forEach(e=>{});},scrollIntoView(){},focus(){}})};
const toasts=[];const up={calls:[],fail:false,upsert:[],deleted:[]};let rows=[];
const doc={getElementById:mk,querySelector:()=>({scrollIntoView(){}}),querySelectorAll:()=>[],addEventListener(){},createElement:()=>({getContext:()=>({drawImage(){}}),toBlob(cb){cb({size:1000})}}),body:{classList:{add(){},remove(){}}}};
const ctx={document:doc,console,Intl,Date,Math,JSON,Promise,Map,Set,Number,setTimeout,FileReader:function(){this.readAsDataURL=()=>{this.onload&&this.onload({target:{result:'data:image/jpeg;base64,AA'}})}},
 localStorage:{_d:{},getItem(k){return this._d[k]??null},setItem(k,v){this._d[k]=String(v)},removeItem(k){delete this._d[k]}},
 sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},CustomEvent:function(n){this.type=n},dispatchEvent(){},setInterval:()=>0,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
ctx.window=ctx;ctx.FormData=class{constructor(f){this._=f.__data||{}}get(k){return this._[k]}};
vm.createContext(ctx);
const client={from:()=>({select(){return this},order(){return this},upsert:async(p)=>{up.upsert.push(p);rows.push(p);return {error:null}},delete(){return this},eq:async(c,v)=>{up.deleted.push(v);return {error:null}},
 then(res){return Promise.resolve({data:rows,error:null}).then(res)}}),
 storage:{from:()=>({upload:async(p,b)=>up.fail?{error:{message:'exceeded the maximum allowed size'}}:(up.calls.push({p,size:b&&b.size}),{error:null}),
  getPublicUrl:(p)=>({data:{publicUrl:'https://fsbehijyxypruzfdhxxo.supabase.co/storage/v1/object/public/product-images/'+p}})})}};
ctx.WoofAuth={getClient:async()=>client,requireStaff:async()=>({})};ctx.SUPABASE_CONFIG={supabaseUrl:'x',supabaseAnonKey:'k'};
for(const f of ['js/utils.js','js/products.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
vm.runInContext('globalThis.ProductManager=ProductManager;',ctx);
ctx.ui.showToast=(m,t)=>toasts.push({m,t});ctx.ui.confirm=async()=>true;
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n)};
const submit=async(pm,data)=>{toasts.length=0;return pm.handleFormSubmit({preventDefault(){},target:{__data:data}})};
(async()=>{
 const pm=new ctx.ProductManager();await new Promise(r=>setTimeout(r,30));
 pm.prepareImageForUpload=async()=>({size:180*1024});
 pm.renderProducts=()=>{};
 const file={name:'IMG_4821.HEIC',size:8*1024*1024,type:'image/heic'};
 await submit(pm,{name:'Candy Cane',price:'18',category:'  Christmas Gifts  ',image:file});
 ok(up.upsert[0]&&up.upsert[0].category==='christmas gifts','typed category is tidied: '+(up.upsert[0]||{}).category);
 ok(/^https:.*product-images\/products\/.*\/photo-\d+\.jpg$/.test(up.upsert[0].image_url),'photo went to storage as jpg: '+up.upsert[0].image_url.slice(-30));
 ok(ctx.localStorage.getItem('woofcrafts_last_category')==='christmas gifts','last category remembered');
 ok(els['submit-btn'].disabled===false,'button re-enabled after save');
 ok(toasts.some(t=>t.t==='success'),'success toast');
 pm.resetForm();ok(els['product-category'].value==='christmas gifts','form reopens with last category');
 up.fail=true;const before=up.upsert.length;
 await submit(pm,{name:'Big Tag',price:'20',category:'tags',image:file});
 ok(up.upsert.length===before,'upload failure saves nothing');
 ok(toasts.at(-1).t==='error'&&/did not upload/.test(toasts.at(-1).m),'clear upload error: '+toasts.at(-1).m);
 ok(els['submit-btn'].disabled===false,'button re-enabled after failure');
 up.fail=false;
 await submit(pm,{name:'Freebie',price:'0',category:'promotion',image:file});
 ok(up.upsert.at(-1).price===0,'price 0 is allowed');
 await submit(pm,{name:'Bad',price:'-5',category:'tags',image:file});
 ok(/price of 0 or more/.test(toasts.at(-1).m),'negative price rejected');
 await submit(pm,{name:'  ',price:'5',category:'tags',image:file});
 ok(/product name/.test(toasts.at(-1).m),'blank name rejected');
 pm.editingId='abc';pm.products=[{id:'abc',name:'Old',price:5,image:'https://x/p.jpg',category:'tags'}];
 await submit(pm,{name:'Old',price:'6',category:'tags',image:{size:0}});
 ok(up.upsert.at(-1).image_url==='https://x/p.jpg','editing without a new photo keeps the old one');
 pm.editingId=null;
 pm.products=[{id:'1',name:'Heavy',price:5,image:'data:image/jpeg;base64,AAAA',category:'x'},{id:'2',name:'Fine',price:5,image:'https://x/p.jpg',category:'x'}];
 delete pm.renderProducts;const list=mk('products-list');ctx.ProductManager.prototype.renderProducts.call(pm);
 ok((list.innerHTML.match(/product-list-warning/g)||[]).length===1&&/Heavy/.test(list.innerHTML),'only the heavy photo is flagged');
 pm.loadError='TypeError: Failed to fetch';
 ctx.ProductManager.prototype.renderProducts.call(pm);
 ok(/did not load/.test(list.innerHTML)&&/Failed to fetch/.test(list.innerHTML)&&/retry-products-btn/.test(list.innerHTML),'load failure shows a reason and a retry button');
 ok(!/No products yet/.test(list.innerHTML),'load failure is not shown as an empty shop');
 pm.loadError=null;pm.products=[{id:'3',name:'NoPic',price:5,image:'',category:'x'}];
 ctx.ProductManager.prototype.renderProducts.call(pm);
 ok(/No photo yet/.test(list.innerHTML),'product with no photo is flagged');
 console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2)});
