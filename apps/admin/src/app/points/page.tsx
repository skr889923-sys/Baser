'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { NavigationPoint, Building, Floor } from '@baser/types';
import { MapPin, Plus, RefreshCw, Trash2, Edit2, Volume2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { requireMapEditorAccess } from '@/lib/map-permissions';
import { emptyPointDraft, pointDraft, pointTypes, saveNavigationPoint, deleteNavigationPoint,
  setNavigationPointActive, pointWriteError, type PointDraft } from '@/lib/point-editor';

type PointRow = NavigationPoint & { building?: { name_ar: string } | null };
const fieldClass = 'w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500';
const fields: { key: keyof PointDraft; label: string; required?: boolean; multiline?: boolean;
  numeric?: boolean; min?: number; max?: number; dir?: 'ltr' }[] = [
  { key: 'name_ar', label: 'اسم النقطة بالعربية *', required: true },
  { key: 'name_en', label: 'اسم النقطة بالإنجليزية *', required: true, dir: 'ltr' },
  { key: 'description_ar', label: 'الوصف بالعربية', multiline: true },
  { key: 'description_en', label: 'الوصف بالإنجليزية', multiline: true, dir: 'ltr' },
  { key: 'audio_instruction_ar', label: 'التوجيه الصوتي بالعربية', multiline: true },
  { key: 'audio_instruction_en', label: 'التوجيه الصوتي بالإنجليزية', multiline: true, dir: 'ltr' },
  { key: 'latitude', label: 'خط العرض', numeric: true, min: -90, max: 90, dir: 'ltr' },
  { key: 'longitude', label: 'خط الطول', numeric: true, min: -180, max: 180, dir: 'ltr' },
  { key: 'indoor_x', label: 'الإحداثي الداخلي X', numeric: true, dir: 'ltr' },
  { key: 'indoor_y', label: 'الإحداثي الداخلي Y', numeric: true, dir: 'ltr' },
];
const flags: [keyof PointDraft, string][] = [
  ['is_accessible', 'مهيّأة للوصول'], ['is_hazard', 'نقطة خطر'], ['is_active', 'نقطة مفعّلة'],
];

export default function PointsPage() {
  const [points, setPoints] = useState<PointRow[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<NavigationPoint | null>(null);
  const [draft, setDraft] = useState(emptyPointDraft);
  const busy = useRef(false);
  const request = useRef(0);
  const openedFromMap = useRef(false);
  const editorRef = useRef<HTMLFormElement>(null);

  const fetchData = useCallback(async () => {
    const currentRequest = ++request.current;
    setLoading(true); setError(null);
    try {
      let query = supabase.from('navigation_points').select('*, building:buildings(name_ar)').order('created_at', { ascending: false });
      if (selectedBuilding !== 'all') query = query.eq('building_id', selectedBuilding);
      const [bResult, pResult, fResult] = await Promise.all([
        supabase.from('buildings').select('*').order('name_ar', { ascending: true }),
        query,
        supabase.from('floors').select('*').order('floor_number', { ascending: true }),
      ]);
      if (currentRequest !== request.current) return;
      if (bResult.error || pResult.error || fResult.error) throw new Error('تعذر تحميل النقاط والمباني والطوابق. أعد المحاولة.');
      setBuildings(bResult.data || []); setPoints(pResult.data || []); setFloors(fResult.data || []);
    } catch (cause) {
      if (currentRequest === request.current) setError(pointWriteError(cause));
    } finally {
      if (currentRequest === request.current) setLoading(false);
    }
  }, [selectedBuilding]);

  useEffect(() => {
    void fetchData();
    return () => { request.current++; };
  }, [fetchData]);

  useEffect(() => {
    if (loading || error || openedFromMap.current) return;
    openedFromMap.current = true;
    const id = new URLSearchParams(window.location.search).get('edit');
    if (!id) return;
    const point = points.find(item => item.id === id);
    if (point) {
      setEditing(point); setDraft(pointDraft(point)); setShowForm(true);
    } else setError('النقطة المطلوبة غير موجودة أو لا تملك صلاحية عرضها.');
  }, [loading, error, points]);

  useEffect(() => {
    if (showForm) {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      editorRef.current?.querySelector<HTMLInputElement>('input[name="name_ar"]')?.focus({ preventScroll: true });
    }
  }, [showForm, editing?.id]);

  const openForm = (point: NavigationPoint | null) => {
    setEditing(point); setDraft(point ? pointDraft(point) : { ...emptyPointDraft(), building_id: selectedBuilding === 'all' ? '' : selectedBuilding });
    setError(null); setMessage(null); setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditing(null); setDraft(emptyPointDraft()); };
  const change = (field: keyof PointDraft, value: string | boolean) => setDraft(current => ({
    ...current, [field]: value, ...(field === 'building_id' ? { floor_id: '' } : {}),
  }));
  const remember = (row: NavigationPoint) => setPoints(current => {
    if (selectedBuilding !== 'all' && row.building_id !== selectedBuilding) return current.filter(item => item.id !== row.id);
    const point = { ...row, building: buildings.find(item => item.id === row.building_id) || null };
    return current.some(item => item.id === row.id) ? current.map(item => item.id === row.id ? point : item) : [point, ...current];
  });

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current || loading) return;
    busy.current = true; setSaving(true); setError(null); setMessage(null);
    try {
      await requireMapEditorAccess(supabase);
      if (draft.floor_id && !floors.some(floor => floor.id === draft.floor_id && floor.building_id === draft.building_id)) {
        throw new Error('الطابق المحدد لا يتبع المبنى. اختر الطابق مجددًا.');
      }
      const row = await saveNavigationPoint(supabase, draft, editing);
      remember(row); closeForm(); setMessage(editing ? 'تم تأكيد تعديل النقطة.' : 'تم تأكيد إضافة النقطة.');
    } catch (cause) { setError(pointWriteError(cause)); }
    finally { busy.current = false; setSaving(false); }
  };

  const toggleActive = async (point: NavigationPoint) => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError(null); setMessage(null);
    try {
      await requireMapEditorAccess(supabase);
      const row = await setNavigationPointActive(supabase, point);
      remember(row); setMessage(row.is_active ? 'تم تفعيل النقطة.' : 'تم تعطيل النقطة.');
    } catch (cause) { setError(pointWriteError(cause)); }
    finally { busy.current = false; setSaving(false); }
  };

  const handleDelete = async (point: NavigationPoint) => {
    if (busy.current) return;
    if (!window.confirm(`هل تريد حذف النقطة «${point.name_ar}» نهائيًا؟ لا يمكن التراجع عن الحذف. النقاط المرتبطة بمسارات أو رموز QR تتطلب إزالة الارتباطات أولًا.`)) return;
    busy.current = true; setSaving(true); setError(null); setMessage(null);
    try {
      await requireMapEditorAccess(supabase);
      const id = await deleteNavigationPoint(supabase, point);
      setPoints(current => current.filter(item => item.id !== id)); setMessage('تم تأكيد حذف النقطة.');
    } catch (cause) { setError(pointWriteError(cause)); }
    finally { busy.current = false; setSaving(false); }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3"><MapPin className="w-8 h-8 text-indigo-600" />النقاط الملاحية والوصف الصوتي</h1>
          <p className="text-slate-500 mt-2">إضافة نقاط التوجيه وتعديل بياناتها ومواقعها وحذف النقاط غير المرتبطة.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} disabled={saving || loading} aria-label="تحديث النقاط" className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => openForm(null)} disabled={saving || loading} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50"><Plus className="w-5 h-5" />إضافة نقطة جديدة</button>
        </div>
      </div>
      {error && <p role="alert" className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-3">{error}</p>}
      {message && <p role="status" className="bg-emerald-50 text-emerald-800 rounded-lg p-3">{message}</p>}

      {showForm && <form ref={editorRef} onSubmit={handleSave} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-6">{editing ? `تعديل النقطة: ${editing.name_ar}` : 'إضافة نقطة ملاحية'}</h2>
        <fieldset disabled={saving || loading} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <label className="block text-sm font-medium text-slate-700">المبنى
            <select value={draft.building_id} onChange={e => change('building_id', e.target.value)} className={fieldClass}>
              <option value="">نقطة خارجية / دون مبنى</option>{buildings.map(b => <option key={b.id} value={b.id}>{b.name_ar}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">الطابق
            <select disabled={!draft.building_id} value={draft.floor_id} onChange={e => change('floor_id', e.target.value)} className={fieldClass}>
              <option value="">دون طابق محدد</option>{floors.filter(f => f.building_id === draft.building_id).map(f => <option key={f.id} value={f.id}>{f.name_ar}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">نوع النقطة *
            <select required value={draft.type} onChange={e => change('type', e.target.value)} className={fieldClass}>{pointTypes.map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select>
          </label>
          {fields.map(field => <label key={field.key} className={`block text-sm font-medium text-slate-700 ${field.key.startsWith('audio_') ? 'md:col-span-2' : ''}`}>{field.label}
            {field.multiline
              ? <textarea name={field.key} rows={2} dir={field.dir} value={String(draft[field.key])} onChange={e => change(field.key, e.target.value)} className={fieldClass} />
              : <input name={field.key} required={field.required} type={field.numeric ? 'number' : 'text'} step={field.numeric ? 'any' : undefined} min={field.min} max={field.max} dir={field.dir} value={String(draft[field.key])} onChange={e => change(field.key, e.target.value)} className={fieldClass} />}
          </label>)}
          <p className="md:col-span-2 text-sm text-slate-500">أدخل كل زوج من الإحداثيات معًا، أو اتركه فارغًا إذا لم يُحدّد الموقع بعد.</p>
          <div className="md:col-span-2 flex flex-wrap gap-5 text-sm">{flags.map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={Boolean(draft[key])} onChange={e => change(key, e.target.checked)} />{label}</label>)}</div>
          <div className="md:col-span-2 flex justify-end gap-3 border-t pt-5">
            <button type="button" onClick={closeForm} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">إلغاء</button>
            <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50">{saving ? 'جارٍ الحفظ…' : editing ? 'حفظ التعديلات' : 'حفظ النقطة الملاحية'}</button>
          </div>
        </fieldset>
      </form>}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <label className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-4 font-bold text-slate-700">تصفية حسب المبنى:
          <select disabled={saving || showForm} value={selectedBuilding} onChange={e => setSelectedBuilding(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 outline-none min-w-48 bg-white">
            <option value="all">جميع المباني</option>{buildings.map(b => <option key={b.id} value={b.id}>{b.name_ar}</option>)}
          </select>
        </label>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-white border-b border-slate-200 text-slate-500 font-medium text-sm"><tr><th className="p-4">الاسم والنوع</th><th className="p-4">المبنى</th><th className="p-4 w-1/3">الوصف الصوتي (عربي)</th><th className="p-4 text-center">الحالة</th><th className="p-4 text-center">الإجراءات</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">جارٍ التحميل…</td></tr>
                : points.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">{error ? 'تعذر تأكيد بيانات القائمة.' : 'لا توجد نقاط مسجلة.'}</td></tr>
                : points.map(point => <tr key={point.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4"><div className="font-bold text-slate-800">{point.name_ar}</div><div className="text-xs text-indigo-600 font-bold mt-1 px-2 py-0.5 bg-indigo-50 inline-block rounded-md">{pointTypes.find(([type]) => type === point.type)?.[1] || point.type}</div></td>
                  <td className="p-4 text-slate-800">{point.building?.name_ar || 'دون مبنى'}</td>
                  <td className="p-4"><div className="flex items-start gap-2"><Volume2 className="w-4 h-4 text-slate-400 mt-1 shrink-0" /><p className="text-sm text-slate-600 line-clamp-2" title={point.audio_instruction_ar}>{point.audio_instruction_ar || 'لم يُحدّد التوجيه الصوتي'}</p></div></td>
                  <td className="p-4 text-center"><button disabled={saving || showForm} onClick={() => toggleActive(point)} aria-label={`${point.is_active ? 'تعطيل' : 'تفعيل'} ${point.name_ar}`} className={`px-3 py-1 text-xs font-bold rounded-full border disabled:opacity-50 ${point.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-300'}`}>{point.is_active ? 'مُفعّل' : 'مُعطّل'}</button></td>
                  <td className="p-4"><div className="flex justify-center gap-2">
                    <button disabled={saving} onClick={() => openForm(point)} aria-label={`تعديل ${point.name_ar}`} title="تعديل النقطة" className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"><Edit2 className="w-4 h-4" /></button>
                    <button disabled={saving || showForm} onClick={() => handleDelete(point)} aria-label={`حذف ${point.name_ar}`} title="حذف النقطة" className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
                  </div></td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
