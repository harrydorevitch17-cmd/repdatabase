'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('let adminSaving=false;'),html.indexOf('async function deleteAdmin'));
function setup(result={data:{id:1},error:null}){
 const fields={aName:'Test product',aBrand:'Brand',aCategory:'Shirts',aSeller:'Seller',aPrice:'100',aRating:'0',aStatus:'In stock',aImage:'',aProduct:'https://item.taobao.com/item.htm?id=1',aKakobuy:'',aAffiliate:'',aNotes:'',aSave:''};
 const nodes=Object.fromEntries(Object.entries(fields).map(([k,value])=>[k,{value,disabled:false,textContent:''}]));
 let calls=0;const chain={update(){return this},insert(){return this},eq(){return this},select(){return this},single(){calls++;return typeof result==='function'?result():Promise.resolve(result)}};
 const context=vm.createContext({currentUser:{id:'owner'},draftImages:['/img/local.webp'],$:selector=>nodes[selector.slice(1)],sb:{from:()=>chain},messages:[],closed:false,showToast(message){context.messages.push(message)},closeAdmin(){context.closed=true},loadProducts:async()=>{}});
 vm.runInContext(source,context);return {context,nodes,calls:()=>calls};
}
test('local-image edits succeed only after the database confirms the row',async()=>{const t=setup();await t.context.saveAdmin(1);assert(t.context.closed);assert(t.context.messages.includes('Updated.'));assert.equal(t.nodes.aSave.disabled,false)});
test('zero-row writes are not reported as successful saves',async()=>{const t=setup({data:null,error:null});await t.context.saveAdmin(1);assert.equal(t.context.closed,false);assert(t.context.messages[0].includes('No item was saved'));assert.equal(t.nodes.aSave.disabled,false)});
test('concurrent save clicks cause one write',async()=>{let finish;const t=setup(()=>new Promise(r=>finish=r));const first=t.context.saveAdmin(1),second=t.context.saveAdmin(1);assert.equal(t.calls(),1);finish({data:{id:1},error:null});await Promise.all([first,second]);assert.equal(t.nodes.aSave.disabled,false)});
test('network failures restore the save control and keep the editor open',async()=>{const t=setup(()=>Promise.reject(Error('Offline')));await t.context.saveAdmin(1);assert.equal(t.context.closed,false);assert.equal(t.nodes.aSave.disabled,false);assert(t.context.messages[0].includes('Offline'))});
test('invalid prices and ratings never reach the database',async()=>{for(const [key,value] of [['aPrice','-10'],['aPrice','not a number'],['aRating','6']]){const t=setup();t.nodes[key].value=value;await t.context.saveAdmin(1);assert.equal(t.calls(),0);assert.equal(t.context.closed,false)}});
