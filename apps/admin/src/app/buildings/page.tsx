'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Building2, Edit2, Plus, RefreshCw } from 'lucide-react';
import type { Building, BuildingType } from '@baser/types';
import { supabase } from '@/lib/supabase';
import { detectBuildingSchema, emptyBuildingDraft, saveBuilding, setBuildingActive,
  type BuildingDraft, type BuildingSchema } from '@/lib/building-editor';

const fieldClass = 'w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-sky-500';
const buildingTypes: [BuildingType, string][] = [['college', 'كلية'], ['deanship', 'عمادة'], ['service', 'خدمات'],
  ['administration', 'إدارة'], ['library', 'مكتبة'], ['restaurant', 'مطعم'], ['dormitory', 'سكن'], ['parking', 'مواقف']];

export default function BuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [schema, setSchema] = useState<BuildingSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Building | null>(null);
  const [draft, setDraft] = useState(emptyBuildingDraft);
  const busy = useRef(false);

  const fetchBuildings = async () => {
    setLoading(true); setError(null);
    try {
      const [contract, result] = await Promise.all([
        detectBuildingSchema(supabase),
        supabase.from('buildings').select('*').order('created_at', { ascending: false }),
      ]);
      if (result.error) throw new Error('تعذر تحميل المباني. أعد المحاولة.');
      setSchema(contract); setBuildings(result.data || []);
    } catch (cause) {
      setSchema(null);
      setError(cause instanceof Error ? cause.message : 'تعذر الاتصال لتحميل المباني.');
    } finally { setLoading(false); }
  };
  useEffect(() => { void fetchBuildings(); }, []);

  const openForm = (building: Building | null) => {
    setEditing(building); setError(null); setMessage(null);
    setDraft(building ? {
      name_ar: building.name_ar, name_en: building.name_en, code: building.code || '',
      description_ar: building.description_ar || '', description_en: building.description_en || '',
      latitude: building.latitude == null ? '' : String(building.latitude),
      longitude: building.longitude == null ? '' : String(building.longitude),
      type: building.type || '', accessibility: building.is_accessible == null ? '' : building.is_accessible ? 'yes' : 'no',
      is_active: building.is_active,
    } : emptyBuildingDraft());
    setShowForm(true);
  };
  const change = (field: keyof BuildingDraft, value: string | boolean) => setDraft(current => ({ ...current, [field]: value }));
  const remember = (row: Building) => setBuildings(current => current.some(item => item.id === row.id)
    ? current.map(item => item.id === row.id ? row : item) : [row, ...current]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current || !schema) return;
    busy.current = true; setSaving(true); setError(null); setMessage(null);
    try {
      const row = await saveBuilding(supabase, draft, schema, editing);
      remember(row); setShowForm(false); setEditing(null); setDraft(emptyBuildingDraft());
      setMessage('تم تأكيد حفظ المبنى.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تأكيد الحفظ. حدّث القائمة قبل إعادة المحاولة.');
    } finally { busy.current = false; setSaving(false); }
  };
  const toggleActive = async (building: Building) => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError(null); setMessage(null);
    try {
      const row = await setBuildingActive(supabase, building);
      remember(row); setMessage(row.is_active ? 'تم تفعيل ظهور المبنى.' : 'تم تعطيل ظهور المبنى.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تأكيد تغيير الحالة.');
    } finally { busy.current = false; setSaving(false); }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3"><Building2 className="w-8 h-8 text-sky-600" />إدارة المباني</h1>
          <p className="text-slate-500 mt-2">أسماء المباني ومواقعها وحالة ظهورها في التطبيق.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchBuildings} disabled={saving || loading} aria-label="تحديث المباني" className="p-2 border border-slate-300 rounded-lg text-slate-600 disabled:opacity-50"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => openForm(null)} disabled={saving || loading || !schema} className="bg-sky-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"><Plus className="w-5 h-5" />إضافة مبنى جديد</button>
        </div>
      </div>
      {error && <p role="alert" className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-3">{error}</p>}
      {message && <p role="status" className="bg-emerald-50 text-emerald-800 rounded-lg p-3">{message}</p>}

      {showForm && (
        <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold mb-6">{editing ? 'تعديل المبنى' : 'إضافة مبنى جديد'}</h2>
          <fieldset disabled={saving || loading || !schema} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {schema === 'coded' && <label className="block text-sm font-medium text-slate-700">رمز المبنى *
              <input required value={draft.code} onChange={e => change('code', e.target.value)} className={fieldClass} placeholder="مثال: ENG-01" />
            </label>}
            <label className="block text-sm font-medium text-slate-700">اسم المبنى بالعربية *
              <input required value={draft.name_ar} onChange={e => change('name_ar', e.target.value)} className={fieldClass} />
            </label>
            <label className="block text-sm font-medium text-slate-700">اسم المبنى بالإنجليزية *
              <input required dir="ltr" value={draft.name_en} onChange={e => change('name_en', e.target.value)} className={fieldClass} />
            </label>
            <label className="block text-sm font-medium text-slate-700">الوصف بالعربية
              <textarea rows={2} value={draft.description_ar} onChange={e => change('description_ar', e.target.value)} className={fieldClass} />
            </label>
            <label className="block text-sm font-medium text-slate-700">الوصف بالإنجليزية
              <textarea rows={2} dir="ltr" value={draft.description_en} onChange={e => change('description_en', e.target.value)} className={fieldClass} />
            </label>
            <label className="block text-sm font-medium text-slate-700">خط العرض{schema === 'classic' ? ' *' : ''}
              <input type="number" step="any" min="-90" max="90" required={schema === 'classic'} dir="ltr" value={draft.latitude} onChange={e => change('latitude', e.target.value)} className={fieldClass} />
            </label>
            <label className="block text-sm font-medium text-slate-700">خط الطول{schema === 'classic' ? ' *' : ''}
              <input type="number" step="any" min="-180" max="180" required={schema === 'classic'} dir="ltr" value={draft.longitude} onChange={e => change('longitude', e.target.value)} className={fieldClass} />
            </label>
            {schema === 'coded' && <p className="md:col-span-2 text-sm text-slate-500">أدخل الإحداثيات الفعلية معًا، أو اتركهما فارغين إذا لم يُحدّد الموقع بعد.</p>}
            {schema === 'classic' && <>
              <label className="block text-sm font-medium text-slate-700">نوع المبنى *
                <select required value={draft.type} onChange={e => change('type', e.target.value)} className={fieldClass}><option value="">اختر النوع</option>{buildingTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </label>
              <label className="block text-sm font-medium text-slate-700">هل المبنى مهيّأ؟ *
                <select required value={draft.accessibility} onChange={e => change('accessibility', e.target.value)} className={fieldClass}><option value="">اختر بعد التحقق</option><option value="yes">نعم</option><option value="no">لا</option></select>
              </label>
            </>}
            <label className="md:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_active} onChange={e => change('is_active', e.target.checked)} />إظهار المبنى في التطبيق</label>
            <div className="md:col-span-2 flex justify-end gap-3 border-t pt-5">
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 border border-slate-300 rounded-lg">إلغاء</button>
              <button type="submit" className="px-6 py-2.5 bg-sky-600 text-white rounded-lg disabled:opacity-50">{saving ? 'جارٍ الحفظ…' : 'حفظ المبنى'}</button>
            </div>
          </fieldset>
        </form>
      )}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-right">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="p-4">المبنى</th><th className="p-4">الاسم بالإنجليزية</th><th className="p-4">الإحداثيات</th><th className="p-4">الحالة</th><th className="p-4">الإجراءات</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">جارٍ التحميل…</td></tr>
              : buildings.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">{error ? 'تعذر تأكيد بيانات القائمة.' : 'لا توجد مبانٍ مسجلة بعد.'}</td></tr>
              : buildings.map(building => <tr key={building.id}>
                <td className="p-4 font-bold text-slate-800">{building.name_ar}{building.code && <span className="block text-xs font-normal text-slate-500">{building.code}</span>}</td>
                <td className="p-4 text-slate-600">{building.name_en}</td>
                <td className="p-4 text-slate-500 text-sm">{building.latitude == null || building.longitude == null ? 'لم تُحدّد' : <span dir="ltr" className="font-mono inline-block">{building.latitude.toFixed(5)}, {building.longitude.toFixed(5)}</span>}</td>
                <td className="p-4"><button disabled={saving || showForm} onClick={() => toggleActive(building)} aria-label={`${building.is_active ? 'تعطيل' : 'تفعيل'} ظهور ${building.name_ar}`} className={`px-3 py-1 text-xs rounded-full border disabled:opacity-50 ${building.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-300'}`}>{building.is_active ? 'مُفعّل' : 'مُعطّل'}</button></td>
                <td className="p-4"><button disabled={saving} onClick={() => openForm(building)} aria-label={`تعديل ${building.name_ar}`} className="p-2 text-sky-600 hover:bg-sky-50 rounded-lg disabled:opacity-50"><Edit2 className="w-4 h-4" /></button></td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
