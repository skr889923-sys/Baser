"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Building } from '@dallni/types';
import { Building2, Plus, RefreshCw, Trash2, Edit2 } from 'lucide-react';

export default function BuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    description_ar: '',
    description_en: '',
    location_lat: 30.622971,
    location_lng: 32.269073,
    is_active: true
  });

  const fetchBuildings = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('buildings').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setBuildings(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBuildings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase.from('buildings').insert([formData]).select().single();
    if (!error && data) {
      setBuildings([data, ...buildings]);
      setShowForm(false);
      setFormData({
        name_ar: '',
        name_en: '',
        description_ar: '',
        description_en: '',
        location_lat: 30.622971,
        location_lng: 32.269073,
        is_active: true
      });
    } else {
      alert('حدث خطأ أثناء الحفظ');
      console.error(error);
    }
    setSaving(false);
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('buildings').update({ is_active: !currentStatus }).eq('id', id);
    if (!error) {
      setBuildings(buildings.map(b => b.id === id ? { ...b, is_active: !currentStatus } : b));
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-sky-600" />
            إدارة المباني الكليات
          </h1>
          <p className="text-slate-500 mt-2">إضافة، تعديل، وإدارة مباني الحرم الجامعي.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={fetchBuildings} 
            className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setShowForm(!showForm)} 
            className="bg-sky-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-sky-700"
          >
            <Plus className="w-5 h-5" />
            إضافة مبنى جديد
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
          <h2 className="text-xl font-bold mb-6">إضافة مبنى جديد</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">اسم المبنى (عربي) *</label>
              <input required value={formData.name_ar} onChange={e => setFormData({...formData, name_ar: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-sky-500" placeholder="مثال: كلية الحاسبات والمعلومات" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">اسم المبنى (إنجليزي) *</label>
              <input required value={formData.name_en} onChange={e => setFormData({...formData, name_en: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-sky-500" placeholder="e.g. Faculty of Computers and Information" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">وصف (عربي)</label>
              <textarea value={formData.description_ar} onChange={e => setFormData({...formData, description_ar: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-sky-500" rows={2} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">وصف (إنجليزي)</label>
              <textarea value={formData.description_en} onChange={e => setFormData({...formData, description_en: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-sky-500" rows={2} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">خط العرض (Latitude) *</label>
              <input type="number" step="any" required value={formData.location_lat} onChange={e => setFormData({...formData, location_lat: parseFloat(e.target.value)})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">خط الطول (Longitude) *</label>
              <input type="number" step="any" required value={formData.location_lng} onChange={e => setFormData({...formData, location_lng: parseFloat(e.target.value)})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div className="col-span-2 flex justify-end gap-3 mt-4">
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">إلغاء</button>
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium disabled:opacity-50">
                {saving ? 'جاري الحفظ...' : 'حفظ المبنى'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
              <tr>
                <th className="p-4">اسم المبنى</th>
                <th className="p-4">الاسم (EN)</th>
                <th className="p-4">الإحداثيات</th>
                <th className="p-4 text-center">الحالة</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">جاري التحميل...</td></tr>
              ) : buildings.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">لا توجد مباني مسجلة بعد.</td></tr>
              ) : (
                buildings.map((building) => (
                  <tr key={building.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-800">{building.name_ar}</td>
                    <td className="p-4 text-slate-600">{building.name_en}</td>
                    <td className="p-4 text-slate-500 text-sm font-mono" dir="ltr">
                      {building.location_lat.toFixed(5)}, {building.location_lng.toFixed(5)}
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => toggleActive(building.id, building.is_active)}
                        className={`px-3 py-1 text-xs font-bold rounded-full border ${building.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-300'}`}
                      >
                        {building.is_active ? 'مُفعل' : 'مُعطل'}
                      </button>
                    </td>
                    <td className="p-4 text-center flex justify-center gap-2">
                      <button className="p-2 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
