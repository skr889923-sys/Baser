const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const scope = {exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/administration.ts'),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
}).outputText,scope);
const {isAdministrator,manageRecord,administrationError}=scope.exports;
test('only system and university administrators receive complete management',()=>{
  for(const role of ['super_admin','university_admin'])assert.equal(isAdministrator(role),true);
  for(const role of [null,'student','building_manager','support_agent','security_staff'])assert.equal(isAdministrator(role),false);
});
test('administrative edits compare the displayed version and require the exact server receipt',async()=>{
  const row={id:'id',updated_at:'old',name:'Name'};
  const client=result=>({rpc:async(name,args)=>{
    assert.equal(name,'admin_manage_record');assert.equal(args.record_id,row.id);
    assert.equal(args.expected.updated_at,'old');assert.equal(args.expected.name,'Name');return result;
  }});
  const fields=[{key:'name',label:'Name'}];
  assert.equal((await manageRecord(client({data:row,error:null}),'voice_characters',row,fields,{name:'Edited'})).id,row.id);
  for(const result of [{data:null,error:null},{data:{id:'other'},error:null},{data:null,error:{code:'42501'}},{data:null,error:{code:'PGRST202'}}]){
    await assert.rejects(manageRecord(client(result),'voice_characters',row,fields,null));
  }
  assert.match(administrationError({code:'PGRST202'}),/تحديث الإدارة الشاملة/);
});
