const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');
const React=require('react');const {JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/buildings'});
global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=require('react-dom/client');
const calls=[];let response={data:null,error:{code:'PT409'}};let confirmed=false;let saved=null;let deleted=null;
dom.window.confirm=()=>confirmed;
const modules=new Map();
function load(file){if(modules.has(file))return modules.get(file);
  const context={exports:{},window:dom.window,document:dom.window.document,console,require(name){
    if(name==='@/lib/supabase')return {supabase:{rpc:async(name,args)=>{calls.push({name,args});return response;}}};
    if(name.startsWith('@/')||name.startsWith('.')){const base=name.startsWith('@/')?path.join(__dirname,'../src',name.slice(2)):path.resolve(path.dirname(file),name);return load(fs.existsSync(base+'.ts')?base+'.ts':base+'.tsx');}
    return require(name);
  }};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,context);modules.set(file,context.exports);return context.exports;
}
const Actions=load(path.join(__dirname,'../src/components/AdminRecordActions.tsx')).default;
const {AdminRoleContext}=load(path.join(__dirname,'../src/components/AdminRoleContext.tsx'));
const root=createRoot(document.getElementById('root'));
const props=row=>({table:'voice_characters',record:row,label:'Voice',fields:[{key:'name',label:'Name',required:true}],deleteNotice:'Record deletion',onSaved:row=>{saved=row;},onDeleted:id=>{deleted=id;}});
const render=async(role,row)=>{await React.act(async()=>root.render(React.createElement(AdminRoleContext.Provider,{value:{role,userId:'admin'}},React.createElement(Actions,props(row)))));};
const click=async label=>{await React.act(async()=>{[...document.querySelectorAll('button')].find(button=>button.getAttribute('aria-label')===label||button.textContent===label).click();});};
test('admin actions enforce role visibility, keep the opened snapshot, and require confirmed matching receipts',async t=>{
  t.after(async()=>{await React.act(async()=>root.unmount());dom.window.close();});
  const original={id:'voice',name:'Original',updated_at:'v1'};
  await render('support_agent',original);assert.equal(document.querySelectorAll('button').length,0);
  await render('super_admin',original);await click('تعديل Voice');
  assert.ok(document.querySelector('[role="dialog"]'));
  await render('super_admin',{...original,name:'Concurrent',updated_at:'v2'});
  await React.act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(calls[0].args.expected.updated_at,'v1','Editing must compare the version originally opened');
  assert.equal(calls[0].args.patch.name,'Original');assert.ok(document.querySelector('[role="alert"]'));assert.equal(saved,null);
  response={data:{...original,name:'Saved'},error:null};
  await React.act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(saved.name,'Saved');assert.equal(document.querySelector('[role="dialog"]'),null);
  const count=calls.length;await click('حذف Voice');assert.equal(calls.length,count,'Cancel must not call RPC');
  confirmed=true;response={data:{id:'wrong'},error:null};await click('حذف Voice');assert.equal(deleted,null);
  response={data:{id:'voice'},error:null};await click('حذف Voice');assert.equal(deleted,'voice');
});
