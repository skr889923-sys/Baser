'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NavigationPoint, Route, RouteStep } from '@baser/types';
import { supabase } from '@/lib/supabase';
import { administrationError } from '@/lib/administration';
import { useAdminDialogFocus } from '@/components/useAdminDialogFocus';

type StepDraft = { key: string; id?: string; from_point_id: string; to_point_id: string; instruction_ar: string; instruction_en: string; distance_meters: string; direction: string; haptic_pattern: string; warning_level: string };
type Snapshot = { route: Route; steps: RouteStep[] };
const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900';
const directions = [['straight','للأمام'],['left','يسار'],['right','يمين'],['slight_left','يسار قليلًا'],['slight_right','يمين قليلًا'],['u_turn','عودة'],['stairs_up','درج صعود'],['stairs_down','درج نزول'],['elevator_up','مصعد صعود'],['elevator_down','مصعد نزول']];
const haptics = [['continue','استمرار'],['turn_left','يسار'],['turn_right','يمين'],['warning','تحذير'],['arrived','وصول'],['emergency','طوارئ']];
const newStep = (from: string, to: string): StepDraft => ({ key: crypto.randomUUID(), from_point_id: from, to_point_id: to, instruction_ar: '', instruction_en: '', distance_meters: '', direction: '', haptic_pattern: '', warning_level: 'none' });

export default function RouteEditDialog({ route, points, onClose, onSaved }: { route: Route; points: NavigationPoint[]; onClose: () => void; onSaved: (snapshot: Snapshot) => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState(route);
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const dialogRef = useAdminDialogFocus(true, onClose, saving);
  useEffect(() => {
    let current = true;
    supabase.rpc('get_route_for_edit', { route_id: route.id }).then(({ data, error }) => {
      if (!current) return;
      if (error || !data?.route || !Array.isArray(data.steps)) { setError(administrationError(error || new Error('تعذر تحميل المسار وخطواته.'))); return; }
      const loaded = data as Snapshot;
      setSnapshot(loaded); setDraft(loaded.route);
      setSteps(loaded.steps.map(step => ({ key: step.id, id: step.id, from_point_id: step.from_point_id, to_point_id: step.to_point_id,
        instruction_ar: step.instruction_ar || '', instruction_en: step.instruction_en || '', distance_meters: String(step.distance_meters),
        direction: step.direction || '', haptic_pattern: haptics.some(([value]) => value === step.haptic_pattern) ? step.haptic_pattern : '', warning_level: step.warning_level || '' })));
    }, cause => { if (current) setError(administrationError(cause)); });
    return () => { current = false; };
  }, [route.id]);
  const patchStep = (key: string, field: keyof StepDraft, value: string) => setSteps(current => current.map(step => step.key === key ? { ...step, [field]: value } : step));
  const select = (label: string, value: string, choices: string[][], change: (value: string) => void) => <label className="block text-sm font-semibold">{label}<select required className={inputClass} value={value} onChange={event => change(event.target.value)}><option value="">اختر…</option>{choices.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
  const pointChoices = points.map(point => [point.id,point.name_ar]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!snapshot || lock.current) return;
    if (!steps.length) { setError('أضف خطوة توجيه واحدة على الأقل.'); return; }
    let from = draft.start_point_id;
    for (const step of steps) {
      if (step.from_point_id !== from || !step.to_point_id || step.to_point_id === from || !Number.isFinite(Number(step.distance_meters)) || Number(step.distance_meters) <= 0) {
        setError('راجع اتصال الخطوات من بداية المسار إلى نهايته والمسافة الموجبة لكل خطوة.'); return;
      }
      from = step.to_point_id;
    }
    if (from !== draft.end_point_id) { setError('آخر خطوة يجب أن تصل إلى نقطة نهاية المسار.'); return; }
    lock.current = true; setSaving(true); setError('');
    try {
      const { data, error } = await supabase.rpc('save_route_edit', {
        route_id: route.id, expected_updated_at: snapshot.route.updated_at, expected_steps: snapshot.steps,
        route_data: { ...draft, distance_meters: steps.reduce((total,step) => total + Number(step.distance_meters),0) },
        steps_data: steps.map(({ key, distance_meters, ...step }) => ({ ...step, distance_meters: Number(distance_meters) })),
      });
      if (error) throw error;
      if (data?.route?.id !== route.id || !Array.isArray(data.steps)) throw new Error('لم يُؤكّد حفظ المسار وخطواته. حدّث القائمة.');
      onSaved(data as Snapshot);
    } catch (cause) { setError(administrationError(cause)); }
    finally { lock.current = false; setSaving(false); }
  };
  return createPortal(<div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/50 p-3" dir="rtl">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="تعديل المسار وخطواته" className="max-h-[94dvh] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-5 md:p-7">
      <h2 className="text-xl font-bold">تعديل المسار وخطواته</h2>
      <p className="my-3 text-sm text-slate-600">راجع التعليمات لكل خطوة. تُحسب المسافة من مجموع الخطوات، وتُحفظ جميع التعديلات معًا.</p>
      <p className="mb-4 text-sm text-slate-600">تغيير نص توجيه مسجّل أو إزالة خطوته يلغي ربط التسجيل القديم؛ راجعه في قسم التعليق الصوتي بعد الحفظ.</p>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      {!snapshot && <p role="status">{error ? 'تعذر تجهيز نموذج التعديل.' : 'جارٍ تحميل أحدث نسخة…'}</p>}
      <form onSubmit={submit}><fieldset disabled={!snapshot || saving} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          {(['name_ar','name_en'] as const).map(key => <label key={key} className="block text-sm font-semibold">{key === 'name_ar' ? 'اسم المسار بالعربية' : 'اسم المسار بالإنجليزية'}<input required autoFocus={key === 'name_ar'} className={inputClass} value={draft[key] || ''} onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))}/></label>)}
          {select('البداية',draft.start_point_id,pointChoices,value => setDraft(current => ({ ...current,start_point_id:value })))}
          {select('النهاية',draft.end_point_id,pointChoices,value => setDraft(current => ({ ...current,end_point_id:value })))}
          {select('نوع المسار',draft.route_type,[['fastest','الأسرع'],['safe_accessible','آمن ومهيأ'],['wheelchair','كرسي متحرك'],['blind_friendly','مهيأ للمكفوفين']],value => setDraft(current => ({ ...current,route_type:value as Route['route_type'] })))}
          {select('الحالة',draft.status,[['active','نشط'],['closed','مغلق'],['maintenance','صيانة']],value => setDraft(current => ({ ...current,status:value as Route['status'] })))}
          <label className="text-sm font-semibold">المدة بالدقائق<input required type="number" min="1" step="1" className={inputClass} value={draft.estimated_minutes} onChange={event => setDraft(current => ({ ...current,estimated_minutes:Number(event.target.value) }))}/></label>
          <p className="self-center text-sm">مجموع مسافات الخطوات: {steps.reduce((total,step) => total + (Number(step.distance_meters) || 0),0)} متر</p>
        </div>
        <div className="flex flex-wrap gap-4">{([['has_stairs','يحتوي درجًا'],['has_ramp','يحتوي منحدرًا'],['wheelchair_accessible','مهيأ للكراسي'],['visually_impaired_friendly','مهيأ للمكفوفين']] as const).map(([key,label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft[key]} onChange={event => setDraft(current => ({ ...current,[key]:event.target.checked }))}/>{label}</label>)}</div>
        {steps.map((step,index) => <section key={step.key} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">الخطوة {index+1}</h3><div className="flex gap-3">
            <button type="button" disabled={index===0} onClick={() => setSteps(current => { const next=[...current]; [next[index-1],next[index]]=[next[index],next[index-1]]; return next; })} className="secondary-action disabled:opacity-40">نقل لأعلى</button>
            <button type="button" onClick={() => setSteps(current => current.filter(item => item.key!==step.key))} className="text-red-700">إزالة الخطوة</button>
          </div></div>
          <div className="grid gap-3 md:grid-cols-2">{select('من نقطة',step.from_point_id,pointChoices,value => patchStep(step.key,'from_point_id',value))}{select('إلى نقطة',step.to_point_id,pointChoices,value => patchStep(step.key,'to_point_id',value))}
            <label className="block text-sm font-semibold">المسافة بالمتر<input required type="number" min="0.01" step="any" className={inputClass} value={step.distance_meters} onChange={event => patchStep(step.key,'distance_meters',event.target.value)}/></label>
            {select('الاتجاه',step.direction,directions,value => patchStep(step.key,'direction',value))}
            {select('الاهتزاز',step.haptic_pattern,haptics,value => patchStep(step.key,'haptic_pattern',value))}
            {select('التحذير',step.warning_level,[['none','لا يوجد'],['caution','تنبيه'],['danger','خطر']],value => patchStep(step.key,'warning_level',value))}
            {(['instruction_ar','instruction_en'] as const).map(key => <label key={key} className="block text-sm font-semibold">{key==='instruction_ar'?'التوجيه بالعربية':'التوجيه بالإنجليزية'}<textarea required rows={2} className={inputClass} value={step[key]} onChange={event => patchStep(step.key,key,event.target.value)}/></label>)}
          </div>
        </section>)}
        <button type="button" className="secondary-action" onClick={() => setSteps(current => [...current,newStep(current.at(-1)?.to_point_id || draft.start_point_id,draft.end_point_id)])}>إضافة خطوة</button>
        <div className="flex flex-wrap gap-3 border-t pt-4"><button type="submit" className="primary-action">{saving?'جارٍ الحفظ…':'حفظ المسار وخطواته'}</button></div>
      </fieldset></form>
      <button type="button" disabled={saving} className="secondary-action mt-3" onClick={onClose}>إلغاء</button>
    </section>
  </div>,document.body);
}
