"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { NavigationPoint } from '@baser/types';
import { QrCode, Plus, RefreshCw, Trash2, Printer } from 'lucide-react';

export default function QRsPage() {
  const [qrs, setQrs] = useState<any[]>([]);
  const [points, setPoints] = useState<NavigationPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    navigation_point_id: '',
    code_content: '',
    location_description_ar: '',
    location_description_en: ''
  });

  const fetchData = async () => {
    setLoading(true);
    // Fetch Points for dropdown
    const { data: pData } = await supabase.from('navigation_points').select('*').eq('is_active', true);
    if (pData) setPoints(pData);

    // Fetch QRs
    const { data: qData } = await supabase.from('qr_codes').select('*, point:navigation_points(name_ar)').order('created_at', { ascending: false });
    if (qData) setQrs(qData);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerateContent = () => {
    // Generate a random UUID-like string for content
    const randomContent = `BASER-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    setFormData({ ...formData, code_content: randomContent });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const payload = {
      navigation_point_id: formData.navigation_point_id,
      code_content: formData.code_content.trim(),
      location_description_ar: formData.location_description_ar.trim(),
      location_description_en: formData.location_description_en.trim(),
    };
    if (Object.values(payload).some(value => !value)) {
      setSaveError('اختر النقطة واكتب محتوى الرمز ووصف الموقع بالعربية والإنجليزية.');
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const { data, error } = await supabase.from('qr_codes').insert([payload]).select('*, point:navigation_points(name_ar)').single();
      if (error || !data) {
        setSaveError(error?.code === '23505'
          ? 'هذا الرمز مستخدم بالفعل. اختر محتوى مختلفًا.'
          : 'تعذر تأكيد حفظ الرمز. احتُفظ بالبيانات؛ أعد المحاولة أو راجع صلاحيات الحساب وتهيئة قاعدة البيانات.');
        return;
      }
      setQrs(current => [data, ...current]);
      setShowForm(false);
      setFormData({ navigation_point_id: '', code_content: '', location_description_ar: '', location_description_en: '' });
    } catch {
      setSaveError('تعذر الاتصال لتأكيد الحفظ. احتُفظ بالبيانات؛ حدّث قائمة الرموز قبل إعادة المحاولة.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if(confirm('هل أنت متأكد من حذف هذا الرمز؟')) {
      const { error } = await supabase.from('qr_codes').delete().eq('id', id);
      if (!error) {
        setQrs(qrs.filter(q => q.id !== id));
      }
    }
  };

  const handlePrint = (content: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html dir="rtl">
          <head><title>طباعة رمز QR</title></head>
          <body style="display:flex; justify-content:center; align-items:center; height:100vh; margin:0; flex-direction:column; font-family: sans-serif;">
            <h1 style="margin-bottom: 20px;">نظام بصيره</h1>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(content)}" alt="QR Code" />
            <p style="margin-top: 20px; font-size: 14px; color: #666;">${content}</p>
            <script>window.onload = function() { window.print(); window.close(); }</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <QrCode className="w-8 h-8 text-emerald-600" />
            رموز الاستجابة (QR Codes)
          </h1>
          <p className="text-slate-500 mt-2">إنشاء وإدارة رموز الـ QR لطباعتها وتوزيعها في أرجاء المباني لتمكين المستخدمين من تحديد موقعهم.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowForm(!showForm)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-emerald-700">
            <Plus className="w-5 h-5" />
            توليد رمز جديد
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
          <h2 className="text-xl font-bold mb-6">ربط النقطة الملاحية برمز QR</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {saveError && <p role="alert" className="md:col-span-2 text-red-700 bg-red-50 p-3 rounded-lg">{saveError}</p>}
            <fieldset disabled={saving} className="contents">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">النقطة الملاحية *</label>
              <select required value={formData.navigation_point_id} onChange={e => setFormData({...formData, navigation_point_id: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">اختر النقطة...</option>
                {points.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex justify-between">
                <span>المحتوى الرقمي للكود (Data) *</span>
                <button type="button" onClick={handleGenerateContent} className="text-emerald-600 text-xs font-bold hover:underline">توليد تلقائي</button>
              </label>
              <input required value={formData.code_content} onChange={e => setFormData({...formData, code_content: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-left" dir="ltr" placeholder="BASER-XXXX" />
            </div>

            <div>
              <label htmlFor="qr-location-ar" className="block text-sm font-medium text-slate-700 mb-1">وصف الموقع بالعربية *</label>
              <textarea id="qr-location-ar" required rows={3} value={formData.location_description_ar} onChange={e => setFormData({...formData, location_description_ar: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="صف مكان الرمز بدقة لتسهيل العثور عليه" />
            </div>
            <div>
              <label htmlFor="qr-location-en" className="block text-sm font-medium text-slate-700 mb-1">وصف الموقع بالإنجليزية *</label>
              <textarea id="qr-location-en" required rows={3} dir="ltr" value={formData.location_description_en} onChange={e => setFormData({...formData, location_description_en: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Describe the QR location precisely" />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 mt-4 border-t pt-6">
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">إلغاء</button>
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50">
                {saving ? 'جاري الحفظ...' : 'توليد وحفظ الكود'}
              </button>
            </div>
            </fieldset>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full p-8 text-center text-slate-500">جاري التحميل...</div>
        ) : qrs.length === 0 ? (
          <div className="col-span-full p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">لا توجد أكواد مسجلة بعد.</div>
        ) : (
          qrs.map((qr) => (
            <div key={qr.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-center items-center h-48">
                {/* Using a free QR generation API for visual display in the admin panel */}
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qr.code_content)}`} alt="QR" className="w-32 h-32" />
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-slate-800 mb-1">{qr.point?.name_ar || 'نقطة محذوفة'}</h3>
                <p className="text-xs text-slate-500 font-mono truncate" dir="ltr">{qr.code_content}</p>
                {qr.location_description_ar && <p className="text-sm text-slate-600 mt-2">{qr.location_description_ar}</p>}
                
                <div className="mt-auto pt-4 flex gap-2">
                  <button onClick={() => handlePrint(qr.code_content)} className="flex-1 bg-slate-100 text-slate-700 hover:bg-slate-200 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                    <Printer className="w-4 h-4" />
                    طباعة
                  </button>
                  <button onClick={() => handleDelete(qr.id)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
