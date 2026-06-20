"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { NavigationPoint, Building } from '@dallni/types';
import { MapPin, Plus, RefreshCw, Trash2, Edit2, Volume2 } from 'lucide-react';

export default function PointsPage() {
  const [points, setPoints] = useState<NavigationPoint[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    building_id: '',
    name_ar: '',
    name_en: '',
    type: 'corridor' as any,
    latitude: 30.622971,
    longitude: 32.269073,
    description_ar: '',
    description_en: '',
    audio_instruction_ar: '',
    audio_instruction_en: '',
    is_accessible: true,
    is_hazard: false,
    is_active: true
  });

  const fetchData = async () => {
    setLoading(true);
    // Fetch Buildings for dropdown
    const { data: bData } = await supabase.from('buildings').select('*').order('name_ar', { ascending: true });
    if (bData) setBuildings(bData);

    // Fetch Points
    let query = supabase.from('navigation_points').select('*, building:buildings(name_ar)').order('created_at', { ascending: false });
    if (selectedBuilding !== 'all') {
      query = query.eq('building_id', selectedBuilding);
    }
    
    const { data: pData } = await query;
    if (pData) setPoints(pData);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedBuilding]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.building_id) {
      alert('يرجى اختيار المبنى');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from('navigation_points').insert([formData]).select('*, building:buildings(name_ar)').single();
    if (!error && data) {
      setPoints([data, ...points]);
      setShowForm(false);
      setFormData({
        ...formData,
        name_ar: '', name_en: '', audio_instruction_ar: '', audio_instruction_en: '', description_ar: '', description_en: ''
      });
    } else {
      alert('حدث خطأ أثناء الحفظ');
      console.error(error);
    }
    setSaving(false);
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('navigation_points').update({ is_active: !currentStatus }).eq('id', id);
    if (!error) {
      setPoints(points.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <MapPin className="w-8 h-8 text-indigo-600" />
            النقاط الملاحية والوصف الصوتي
          </h1>
          <p className="text-slate-500 mt-2">إدارة العقد (Nodes) التي يتكون منها مسار التوجيه داخل المباني.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700">
            <Plus className="w-5 h-5" />
            إضافة نقطة جديدة
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
          <h2 className="text-xl font-bold mb-6">إضافة نقطة ملاحية</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">المبنى *</label>
              <select required value={formData.building_id} onChange={e => setFormData({...formData, building_id: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">اختر المبنى...</option>
                {buildings.map(b => <option key={b.id} value={b.id}>{b.name_ar}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">نوع النقطة *</label>
              <select required value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as NavigationPoint['type']})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="entrance">مدخل / مخرج (Entrance)</option>
                <option value="elevator">مصعد (Elevator)</option>
                <option value="stairs">درج (Stairs)</option>
                <option value="corridor">ممر (Corridor)</option>
                <option value="restroom">دورة مياه (Restroom)</option>
                <option value="office">مكتب (Office)</option>
                <option value="hall">قاعة (Hall)</option>
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">اسم النقطة (عربي) *</label>
              <input required value={formData.name_ar} onChange={e => setFormData({...formData, name_ar: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">الاسم (إنجليزي) *</label>
              <input required value={formData.name_en} onChange={e => setFormData({...formData, name_en: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">الوصف الصوتي (عربي) سيُنطق للمستخدم *</label>
              <textarea required value={formData.audio_instruction_ar} onChange={e => setFormData({...formData, audio_instruction_ar: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500" rows={2} placeholder="مثال: أنت الآن أمام الباب الرئيسي، المعمل على يمينك..." />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">الوصف الصوتي (إنجليزي) *</label>
              <textarea required value={formData.audio_instruction_en} onChange={e => setFormData({...formData, audio_instruction_en: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500" rows={2} />
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">خط العرض (Lat) *</label>
              <input type="number" step="any" required value={formData.latitude} onChange={e => setFormData({...formData, latitude: parseFloat(e.target.value)})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">خط الطول (Lng) *</label>
              <input type="number" step="any" required value={formData.longitude} onChange={e => setFormData({...formData, longitude: parseFloat(e.target.value)})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            
            <div className="md:col-span-2 flex justify-end gap-3 mt-4 border-t pt-6">
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">إلغاء</button>
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50">
                {saving ? 'جاري الحفظ...' : 'حفظ النقطة الملاحية'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-4">
          <span className="font-bold text-slate-700">تصفية حسب المبنى:</span>
          <select 
            value={selectedBuilding} 
            onChange={e => setSelectedBuilding(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 outline-none min-w-48 bg-white"
          >
            <option value="all">جميع المباني</option>
            {buildings.map(b => <option key={b.id} value={b.id}>{b.name_ar}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-white border-b border-slate-200 text-slate-500 font-medium text-sm">
              <tr>
                <th className="p-4">الاسم والنوع</th>
                <th className="p-4">المبنى</th>
                <th className="p-4 w-1/3">الوصف الصوتي (عربي)</th>
                <th className="p-4 text-center">الحالة</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">جاري التحميل...</td></tr>
              ) : points.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">لا توجد نقاط مسجلة.</td></tr>
              ) : (
                points.map((point: any) => (
                  <tr key={point.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{point.name_ar}</div>
                      <div className="text-xs text-indigo-600 font-bold uppercase mt-1 px-2 py-0.5 bg-indigo-50 inline-block rounded-md">{point.type}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-slate-800">{point.building?.name_ar || 'غير محدد'}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-start gap-2">
                        <Volume2 className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                        <p className="text-sm text-slate-600 line-clamp-2" title={point.audio_instruction_ar}>
                          {point.audio_instruction_ar}
                        </p>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => toggleActive(point.id, point.is_active)}
                        className={`px-3 py-1 text-xs font-bold rounded-full border ${point.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-300'}`}
                      >
                        {point.is_active ? 'مُفعل' : 'مُعطل'}
                      </button>
                    </td>
                    <td className="p-4 text-center flex justify-center gap-2">
                      <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
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
