const { test } = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../../../data/campus-fixture/network.json');
const { parseNetwork, findNetworkPath, toNavigationPlan, traversalInstruction, distance } = require('../../../.test-build/packages/navigation/src');
const copy = () => structuredClone(fixture);
const sim = { simulation: true };
const trip = (network, destination, profile = 'wheelchair', start = 'n_gate_main') => findNetworkPath(network, start, destination, profile, sim);

test('synthetic network has 16 nodes, 17 edges and 4 buildings; live boundaries reject it', () => {
  const n = parseNetwork(copy());
  assert.deepEqual([n.nodes.features.length,n.edges.features.length,n.buildings.features.length],[16,17,4]);
  assert.throws(()=>parseNetwork(n,{live:true}), /fixture data/);
  assert.throws(()=>toNavigationPlan(n,trip(n,{buildingId:'b_engineering'})), /fixture/);
});
test('wheelchair chooses the 468 m side entrance; fastest chooses the 365 m staircase', () => {
  const n=copy();
  const wheelchair=trip(n,{buildingId:'b_engineering'});
  assert.equal(wheelchair.distance_m,468);
  assert.equal(wheelchair.legs.at(-1).to.properties.id,'n_eng_side');
  assert.equal(trip(n,{nodeId:'n_eng_main'}),null);
  assert.equal(trip(n,{buildingId:'b_engineering'},'fastest').distance_m,365);
  assert.equal(trip(n,{buildingId:'b_science'}),null); // Limited entrance is not silently accepted.
});
test('unverified administration route is rejected for every profile',()=>{
  for(const profile of ['fastest','wheelchair','blind_friendly','safe_accessible']) assert.equal(trip(copy(),{buildingId:'b_admin'},profile),null);
});
test('one-way north gate works inward only',()=>{
  assert.ok(trip(copy(),{nodeId:'n_gate_main'},'fastest','n_gate_north'));
  assert.equal(trip(copy(),{nodeId:'n_gate_north'},'fastest'),null);
});
test('closed ramp, unknown steps, width, grade and access cannot fall back to stairs',()=>{
  for(const patch of [
    {status:'closed',closure_reason:'Obstacle',closed_at:'2026-09-06T00:00:00Z'},
    {steps:null}, {width_m:null}, {incline_pct:null}, {wheelchair:'unknown'},
  ]) {
    const n=copy(); Object.assign(n.edges.features.find(e=>e.properties.id==='e_0010').properties,patch);
    assert.equal(trip(n,{buildingId:'b_engineering'}),null);
  }
});
test('validator rejects malformed numeric, topology and fixture inputs',()=>{
  const mutations = [
    n=>n.edges.features=[], n=>n.nodes.features=[],
    n=>n.edges.features[0].properties.steps=-5,
    n=>n.edges.features[0].properties.width_m=-2,
    n=>n.edges.features[0].properties.steps=1.5,
    n=>n.edges.features[0].properties.oneway='false',
    n=>n.nodes.features[0].geometry.coordinates=[NaN,30],
    n=>n.edges.features[0].geometry.coordinates[0]=[0,0],
    n=>n.edges.features[0].properties.from='missing',
    n=>n.nodes.features.push(n.nodes.features[0]),
    n=>n.buildings.features[0].properties.entrance_nodes=['n_lib_entrance'],
    n=>n.nodes.fixture=false,
  ];
  for(const mutate of mutations){const n=copy(); mutate(n);assert.throws(()=>parseNetwork(n));}
});
test('reverse guidance uses a separately recorded instruction; never repeats forward right/left',()=>{
  const n=copy(); const e=n.edges.features.find(e=>e.properties.id==='e_0001').properties;
  e.guidance_forward={instruction_ar:'كشك الأمن على اليمين',instruction_en:'Security booth on your right'};
  e.guidance_reverse={instruction_ar:'كشك الأمن على اليسار',instruction_en:'Security booth on your left'};
  const back=trip(n,{nodeId:'n_gate_main'},'fastest','n_plaza_c');
  assert.equal(traversalInstruction(back.legs[0],'ar'),'كشك الأمن على اليسار');
  e.guidance_reverse=null;
  assert.match(traversalInstruction(trip(n,{nodeId:'n_gate_main'},'fastest','n_plaza_c').legs[0],'ar'),/معاينة فقط/);
  assert.doesNotMatch(traversalInstruction(back.legs[0],'ar'),/على اليمين/);
});

// Independent exhaustive search is a small-graph oracle, including costs below physical distance.
function exhaustive(n,start,goal) {
  const adj=new Map(n.nodes.features.map(f=>[f.properties.id,[]]));
  for(const f of n.edges.features){const e=f.properties;if(e.survey_status!=='verified')continue;
    let c=e.length_m;if(e.tactile_paving)c*=.7;if(e.landmarks_ar.length)c*=.85;
    if(e.steps>0)c*=e.handrail?1.4:2.2;if(e.hazards_ar.length)c*=1.5;
    if(e.lighting==='poor')c*=1.3;if(e.lighting==='none')c*=1.8;
    adj.get(e.from).push([e.to,c]);if(!e.oneway)adj.get(e.to).push([e.from,c]);
  }
  const walk=(u,seen,cost)=>{if(u===goal)return cost;let best=Infinity;
    for(const [v,c] of adj.get(u)){if(!seen.has(v))best=Math.min(best,walk(v,new Set([...seen,v]),cost+c));}return best;};
  return walk(start,new Set([start]),0);
}
test('low-vision costs agree with exhaustive path search for all verified node pairs',()=>{
  const n=copy();const ids=n.nodes.features.filter(f=>f.properties.survey_status==='verified').map(f=>f.properties.id);
  for(const a of ids)for(const b of ids){const result=trip(n,{nodeId:b},'blind_friendly',a),expected=exhaustive(n,a,b);
    if(expected===Infinity)assert.equal(result,null);else assert.ok(Math.abs(result.cost-expected)<1e-8,`${a} -> ${b}`);}
});

test('live payloads require current evidence and bilingual guidance in both directions',()=>{
  const n=copy();n.fixture=false;for(const group of ['nodes','edges','buildings'])n[group].fixture=false;
  assert.throws(()=>parseNetwork(n,{live:true}),/field evidence/);
  // Structural validation alone deliberately does not make it publishable.
  assert.ok(parseNetwork(n));
});

test('a fully evidenced non-fixture network converts to a valid mobile plan; expired evidence fails',()=>{
  // Synthetic values created in memory solely to exercise the live boundary; never exported or published.
  const n=copy();n.fixture=false;
  n.nodes.features=n.nodes.features.filter(f=>f.properties.survey_status==='verified');
  const ids=new Set(n.nodes.features.map(f=>f.properties.id));
  n.edges.features=n.edges.features.filter(f=>ids.has(f.properties.from)&&ids.has(f.properties.to)&&f.properties.survey_status==='verified');
  n.buildings.features=n.buildings.features.filter(f=>f.properties.entrance_nodes.every(id=>ids.has(id)));
  const now=Date.now();
  for(const group of ['nodes','edges','buildings'])n[group].fixture=false;
  for(const group of ['nodes','edges'])for(const f of n[group].features){Object.assign(f.properties,{
    survey_source:'UNIT TEST ONLY',surveyed_by:'test-team',surveyed_at:new Date(now-60000).toISOString(),valid_until:new Date(now+60000).toISOString(),photo_refs:['test-only.png'],
  });if(group==='edges'){f.properties.guidance_forward={instruction_ar:'تعليمات اختبار للذهاب',instruction_en:'Test forward instruction'};f.properties.guidance_reverse={instruction_ar:'تعليمات اختبار للعودة',instruction_en:'Test reverse instruction'};}}
  parseNetwork(n,{live:true,now});
  const path=findNetworkPath(n,'n_gate_main',{buildingId:'b_engineering'},'wheelchair',{now});
  const plan=toNavigationPlan(n,path);
  const {canStartNavigation}=require('../../../.test-build/packages/navigation/src');
  assert.equal(canStartNavigation(plan.route,plan.steps,'wheelchair'),true);
  assert.equal(plan.destination.id,'synthetic-campus:n_eng_side');
  assert.equal(plan.network.revision,1);
  assert.throws(()=>parseNetwork(n,{live:true,now:now+120000}),/field evidence/);
  n.edges.features[0].properties.guidance_reverse=null;
  assert.throws(()=>parseNetwork(n,{live:true,now}),/each permitted direction/);
});
