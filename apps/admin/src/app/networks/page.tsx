'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { CampusNetwork, CampusEdge, CampusNode, NetworkPath, NetworkValidationError, parseNetwork, findNetworkPath, traversalInstruction } from '@baser/navigation';
import type { RouteType } from '@baser/types';
import { supabase } from '@/lib/supabase';
import NetworkDiagram from '@/components/NetworkDiagram';

type Snapshot = { id: string; revision: number; document: CampusNetwork; is_published: boolean };
const inputClass = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900';
const buttonClass = 'rounded-xl bg-[#12383e] px-5 py-3 font-bold text-white disabled:opacity-40';

export default function NetworksPage() {
  const [records, setRecords] = useState<Snapshot[]>([]);
  const [network, setNetwork] = useState<CampusNetwork | null>(null);
  const [saved, setSaved] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState('');
  const [start, setStart] = useState('');
  const [building, setBuilding] = useState('');
  const [profile, setProfile] = useState<RouteType>('wheelchair');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const load = async () => {
    const {data,error}=await supabase.from('campus_networks').select('id,revision,document,is_published').order('updated_at',{ascending:false});
    if(error){setMessage('تعذر تحميل الشبكات المحفوظة. تأكد من تسجيل الدخول وتطبيق ترحيل قاعدة البيانات. يمكنك معاينة ملف محلي الآن.');return;}
    setRecords(data ?? []);
  };
  useEffect(()=>{load();},[]);
  const choose = (n: CampusNetwork, record: Snapshot | null) => {
    setNetwork(n);setSaved(record);setDirty(!record);setSelected(n.edges.features[0].properties.id);
    setStart(n.nodes.features.find(f=>f.properties.type==='campus_gate')?.properties.id ?? n.nodes.features[0].properties.id);
    setBuilding(n.buildings.features[0].properties.id);setMessage('');
  };
  const importFile = async (file?: File) => {
    if(!file)return;
    try {
      if(file.size>10_000_000)throw new Error('الحد الأقصى للملف 10 ميغابايت.');
      const n=parseNetwork(JSON.parse(await file.text()));
      choose(n,null);
    }catch(e){setMessage(e instanceof Error ? e.message : 'تعذر قراءة الملف.');}
  };
  const preview = useMemo(()=>{
    if(!network)return {path:null as NetworkPath|null,errors:[] as string[],publication:[] as string[]};
    let errors:string[]=[],publication:string[]=[],path:NetworkPath|null=null;
    try {parseNetwork(network);path=findNetworkPath(network,start,{buildingId:building},profile,{simulation:true});}
    catch(e){errors=e instanceof NetworkValidationError?e.issues:[String(e)];}
    try {parseNetwork(network,{live:true});}catch(e){publication=e instanceof NetworkValidationError?e.issues:[String(e)];}
    return {path,errors,publication};
  },[network,start,building,profile]);
  const feature = network?.edges.features.find(f=>f.properties.id===selected) ?? network?.nodes.features.find(f=>f.properties.id===selected);
  const properties=feature?.properties;
  const isEdge=!!properties && 'from' in properties;
  const patch = (values: Partial<CampusEdge & CampusNode>) => {
    if(!network)return;
    const next=structuredClone(network);
    const f=next.edges.features.find(f=>f.properties.id===selected) ?? next.nodes.features.find(f=>f.properties.id===selected);
    if(f)Object.assign(f.properties,values);
    setNetwork(next);setDirty(true);
  };
  const save = async (publish: boolean) => {
    if(!network || busy)return;setBusy(true);setMessage('');
    try {
      const next={...network,revision:saved?saved.revision+1:1};
      parseNetwork(next,{live:publish});
      let result;
      if(saved){result=await supabase.from('campus_networks').update({document:next,revision:next.revision,is_published:publish}).eq('id',saved.id).eq('revision',saved.revision).select('id,revision,document,is_published').maybeSingle();}
      else {result=await supabase.from('campus_networks').insert({id:next.id,document:next,revision:1,is_published:publish}).select('id,revision,document,is_published').single();}
      if(result.error)throw result.error;
      if(!result.data)throw new Error('عدّل مستخدم آخر هذه الشبكة. حمّل أحدث نسخة قبل الحفظ.');
      choose(next,result.data);await load();setMessage(publish?'تم نشر النسخة الميدانية. ستتوقف الرحلات القديمة عند إعادة التحقق لتستخدم النسخة الجديدة.':'حُفظت المسودة. هذه الشبكة غير متاحة للإرشاد العام.');
    }catch(e){setMessage(e instanceof Error?e.message:(e as {message?:string})?.message ?? 'تعذر الحفظ.');}
    finally{setBusy(false);}
  };
  const download = () => {
    if(!network)return;const url=URL.createObjectURL(new Blob([JSON.stringify(network,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`${network.id}.json`;a.click();URL.revokeObjectURL(url);
  };
  const field = (label:string,key:keyof (CampusEdge & CampusNode),value:string|number|null|undefined,kind='text') => <label className="block text-sm font-bold text-slate-700">{label}
    <input type={kind} className={inputClass} value={value ?? ''} onChange={e=>patch({[key]:kind==='number'?(e.target.value===''?null:Number(e.target.value)):(e.target.value||null)})} />
  </label>;
  return <div dir="rtl" className="space-y-6">
    <div><p className="text-sm font-bold text-teal-700">المسح والمراجعة</p><h1 className="mt-2 text-3xl font-black text-slate-900">شبكات الحرم</h1>
      <p className="mt-3 max-w-3xl leading-7 text-slate-600">استورد شبكة الممرات، راجع المداخل وأدلة المسح وتعليمات الاتجاهين، ثم انشر النسخة المتحققة. البيانات المصطنعة متاحة للمعاينة فقط.</p></div>
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5">
      <label className="font-bold">استيراد ملف الشبكة <input aria-label="استيراد ملف الشبكة" type="file" accept=".json,application/json" disabled={busy} onChange={e=>importFile(e.target.files?.[0])} className="mr-3 text-sm" /></label>
      <a href="/fixtures/campus-network.json" download className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700">تنزيل نموذج الاختبار المصطنع</a>
      <button onClick={load} className="rounded-xl border border-slate-300 px-4 py-3" disabled={busy}>تحديث المحفوظات</button>
    </div>
    {message?<p role="alert" className="whitespace-pre-wrap rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">{message}</p>:null}
    {records.length>0?<label className="block max-w-xl font-bold">الشبكات المحفوظة<select className={inputClass} value={saved?.id??''} disabled={busy} onChange={e=>{
      const r=records.find(r=>r.id===e.target.value);if(r)try{choose(parseNetwork(r.document),r);}catch(error){setMessage(String(error));}
    }}><option value="">اختر شبكة</option>{records.map(r=><option key={r.id} value={r.id}>{r.document.name_ar} · {r.is_published?'منشورة':'مسودة'} · إصدار {r.revision}</option>)}</select></label>:null}
    {network?<>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#12383e] p-5 text-white">
        <div><h2 className="text-xl font-black">{network.name_ar}</h2><p className="mt-2 text-sm">{network.nodes.features.length} نقطة · {network.edges.features.length} مقطع · {network.buildings.features.length} مبانٍ · {network.fixture?'بيانات مصطنعة — ليست موقعًا حقيقيًا':saved?.is_published?'نسخة منشورة':'مسودة ميدانية'}{dirty?' · تغييرات غير محفوظة':''}</p></div>
        <button onClick={download} className="rounded-xl border border-white/40 px-4 py-2">تصدير نسخة للمراجعة</button>
      </div>
      {preview.errors.length===0?<NetworkDiagram network={network} path={preview.path} selected={selected} onSelect={setSelected}/>:null}
      <div className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-3">
        <label className="font-bold">بداية المعاينة<select className={inputClass} value={start} onChange={e=>setStart(e.target.value)}>{network.nodes.features.map(n=><option key={n.properties.id} value={n.properties.id}>{n.properties.name_ar||n.properties.id}</option>)}</select></label>
        <label className="font-bold">المبنى المقصود<select className={inputClass} value={building} onChange={e=>setBuilding(e.target.value)}>{network.buildings.features.map(b=><option key={b.properties.id} value={b.properties.id}>{b.properties.name_ar}</option>)}</select></label>
        <label className="font-bold">احتياجات المسار<select className={inputClass} value={profile} onChange={e=>setProfile(e.target.value as RouteType)}><option value="wheelchair">كرسي متحرك</option><option value="safe_accessible">مهيأ للكراسي والتوجيه الصوتي</option><option value="blind_friendly">مكفوف أو ضعيف بصر</option><option value="fastest">الأقصر وقد يحتوي على سلالم</option></select></label>
        <div className="md:col-span-3" aria-live="polite">{preview.path?<><p className="font-bold text-teal-800">{preview.path.distance_m} متر · {preview.path.legs.length} مقاطع · المدخل: {preview.path.legs.at(-1)?.to.properties.name_ar ?? 'أنت عند الوجهة'}</p><ol className="mt-3 list-inside list-decimal space-y-2 text-slate-600">{preview.path.legs.map((leg,i)=><li key={i}>{traversalInstruction(leg,'ar')}</li>)}</ol></>:<p className="text-amber-800">لا يوجد مسار مطابق. راجع حالة الممرات والمداخل والقياسات؛ لا تُستخدم المسارات غير المتحققة كبديل.</p>}</div>
      </div>
      <fieldset disabled={busy} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-black">سجل المسح والإغلاق</h2>
        <label className="block font-bold">النقطة أو المقطع<select className={inputClass} value={selected} onChange={e=>setSelected(e.target.value)}>
          <optgroup label="المقاطع">{network.edges.features.map(e=><option key={e.properties.id} value={e.properties.id}>{e.properties.id} · {e.properties.from} ← {e.properties.to}</option>)}</optgroup>
          <optgroup label="النقاط">{network.nodes.features.map(n=><option key={n.properties.id} value={n.properties.id}>{n.properties.id} · {n.properties.name_ar}</option>)}</optgroup>
        </select></label>
        {properties?<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {!isEdge ? <>{field('اسم النقطة بالعربية','name_ar',(properties as CampusNode).name_ar)}{field('اسم النقطة بالإنجليزية','name_en',(properties as CampusNode).name_en)}</> : null}
          <label className="font-bold">حالة المسح<select className={inputClass} value={properties.survey_status} onChange={e=>patch({survey_status:e.target.value as CampusNode['survey_status']})}><option value="unknown">غير معروف</option><option value="imagery">مرسوم من صورة</option><option value="verified">تمت المعاينة الميدانية</option></select></label>
          {field('مصدر المسح / رقم الاستمارة','survey_source',properties.survey_source)}
          {field('معرّف فريق المسح (سيظهر مع البيانات المنشورة)','surveyed_by',properties.surveyed_by)}
          {field('تاريخ المسح مع المنطقة الزمنية (ISO)','surveyed_at',properties.surveyed_at)}
          {field('موعد انتهاء صلاحية المراجعة (ISO)','valid_until',properties.valid_until)}
          <label className="font-bold">مراجع الصور — كل مرجع في سطر<textarea className={inputClass} value={properties.photo_refs.join('\n')} onChange={e=>patch({photo_refs:e.target.value ? e.target.value.split('\n').map(s=>s.trim()) : []})}/></label>
          <label className="font-bold">الإتاحة الحالية<select className={inputClass} value={properties.status} onChange={e=>patch({status:e.target.value as CampusNode['status'],closed_at:['closed','maintenance'].includes(e.target.value)?new Date().toISOString():null,closure_reason:e.target.value==='active'?null:properties.closure_reason})}><option value="unknown">لم يتم التحقق</option><option value="active">مفتوح</option><option value="closed">مغلق مؤقتًا</option><option value="maintenance">صيانة</option></select></label>
          {field('سبب الإغلاق أو الصيانة','closure_reason',properties.closure_reason)}
          <label className="font-bold">إتاحة الكرسي المتحرك<select className={inputClass} value={properties.wheelchair} onChange={e=>patch({wheelchair:e.target.value as CampusNode['wheelchair']})}><option value="unknown">غير معروفة</option><option value="yes">مهيأ</option><option value="limited">محدودة / يحتاج مساعدة</option><option value="no">غير مهيأ</option></select></label>
          {isEdge?(()=>{const e=properties as CampusEdge;return <>
            {field('عدد درجات السلم — فارغ يعني غير معروف','steps',e.steps,'number')}
            {field('أضيق عرض بالمتر','width_m',e.width_m,'number')}
            {field('أقصى ميل مطلق بالنسبة المئوية','incline_pct',e.incline_pct,'number')}
            {field('ارتفاع الدرجة بالسنتيمتر','step_height_cm',e.step_height_cm,'number')}
            <label className="font-bold">السطح<select className={inputClass} value={e.surface} onChange={v=>patch({surface:v.target.value})}>{['unknown','paved','tiled','concrete','cobblestone','gravel','sand','grass','dirt'].map(s=><option key={s}>{s}</option>)}</select></label>
            <label className="font-bold">الإضاءة<select className={inputClass} value={e.lighting} onChange={v=>patch({lighting:v.target.value as CampusEdge['lighting']})}>{['unknown','good','poor','none'].map(s=><option key={s}>{s}</option>)}</select></label>
            <label className="font-bold">الدرابزين<select className={inputClass} value={e.handrail===null?'unknown':String(e.handrail)} onChange={v=>patch({handrail:v.target.value==='unknown'?null:v.target.value==='true'})}><option value="unknown">غير معروف</option><option value="true">موجود</option><option value="false">غير موجود</option></select></label>
            {(['guidance_forward','guidance_reverse'] as const).map(key=><div key={key} className="space-y-3 md:col-span-2 lg:col-span-3">
              <p className="font-bold">{key==='guidance_forward'?`تعليمات من ${e.from} إلى ${e.to}`:`تعليمات العودة من ${e.to} إلى ${e.from}${e.oneway?' — غير مستخدمة لأن المقطع باتجاه واحد':''}`}</p>
              <p className="text-sm text-slate-500">سجّل التحذيرات قبل العائق، والانعطافات والمعالم بالنسبة لهذا الاتجاه. لا تنسخ يمين ويسار من الاتجاه الآخر.</p>
              {(['ar','en'] as const).map(lang=><label className="block text-sm" key={lang}>{lang==='ar'?'العربية':'English'}<textarea className={inputClass} dir={lang==='ar'?'rtl':'ltr'} value={e[key]?.[`instruction_${lang}`]??''} onChange={v=>patch({[key]:{instruction_ar:e[key]?.instruction_ar??'',instruction_en:e[key]?.instruction_en??'',[`instruction_${lang}`]:v.target.value}})} /></label>)}
            </div>)}
          </>})():null}
        </div>:null}
      </fieldset>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-black">مراجعة قبل النشر</h2>
        <p className="my-3 text-slate-600">يلزم مسح موثّق وساري لكل نقطة ومقطع، وقياسات مكتملة وتعليمات باللغتين لكل اتجاه مسموح. إعادة فتح مقطع مغلق تتم يدويًا بعد التحقق.</p>
        <details open={preview.errors.length>0}><summary className="cursor-pointer font-bold">{preview.errors.length} مشكلة في بنية البيانات · {preview.publication.length} مانع للنشر</summary>
          <ul dir="ltr" className="my-4 max-h-64 list-inside list-disc overflow-auto text-left text-sm leading-6 text-amber-900">{Array.from(new Set([...preview.errors,...preview.publication])).map(e=><li key={e}>{e}</li>)}</ul>
        </details>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className={buttonClass} disabled={busy||preview.errors.length>0} onClick={()=>save(false)}>حفظ مسودة{saved?.is_published?' وسحب الشبكة من الإرشاد':''}</button>
          <button className={buttonClass} disabled={busy||preview.publication.length>0} onClick={()=>save(true)}>{saved?.is_published?'نشر التحديث':'نشر الشبكة المتحققة'}</button>
        </div>
      </section>
    </>:<div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">استورد ملف الشبكة أو اختر شبكة محفوظة لبدء المراجعة.</div>}
  </div>;
}
