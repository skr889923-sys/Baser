'use client';

import React, { useState } from 'react';

// Seed data reference list
const INITIAL_REPORTS = [
  {
    id: 'rep1',
    type: 'obstacle',
    title: 'عائق في الممر',
    description: 'معدات ومقاعد صيانة ملقاة في ممر المكفوفين بالقرب من البهو الرئيسي.',
    location: 'بهو كلية الحاسب الرئيسي',
    status: 'new',
    created_at: '2026-06-20 08:45'
  },
  {
    id: 'rep2',
    type: 'broken_elevator',
    title: 'مصعد متعطل',
    description: 'المصعد لا يستجيب للأزرار الخارجية البارزة المخصصة للمكفوفين.',
    location: 'كلية الحاسب - الدور الأرضي',
    status: 'investigating',
    created_at: '2026-06-20 07:12'
  },
  {
    id: 'rep3',
    type: 'closed_door',
    title: 'باب مخرج طوارئ مغلق',
    description: 'الممر المؤدي للمخرج الشرقي مغلق بسبب صيانة التكييف بدون لافتة تحذير.',
    location: 'بهو كلية الحاسب - الجناح الشرقي',
    status: 'resolved',
    created_at: '2026-06-19 13:20'
  }
];

export default function ReportsPage() {
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const [activeFilter, setActiveFilter] = useState<'all' | 'new' | 'investigating' | 'resolved'>('all');

  const updateStatus = (id: string, newStatus: string) => {
    setReports(reports.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  const filteredReports = reports.filter(r => activeFilter === 'all' || r.status === activeFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold text-slate-800">بلاغات العوائق والمخاطر</h3>
        <p className="text-sm text-slate-500 mt-1">مراجعة بلاغات الطلاب والزوار الميدانية حول العقبات المؤقتة أو الأعطال في الحرم الجامعي.</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        {[
          { key: 'all', label: 'الكل' },
          { key: 'new', label: 'جديد 🆕' },
          { key: 'investigating', label: 'قيد المعالجة 🛠️' },
          { key: 'resolved', label: 'تم الحل ✓' }
        ].map(filter => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key as any)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeFilter === filter.key ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Reports List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredReports.length > 0 ? (
          filteredReports.map(report => (
            <div key={report.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    report.status === 'new' ? 'bg-red-50 text-red-700 border border-red-200' :
                    report.status === 'investigating' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-green-50 text-green-700 border border-green-200'
                  }`}>
                    {report.status === 'new' ? 'جديد' : report.status === 'investigating' ? 'قيد المعالجة' : 'تم الحل'}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">{report.created_at}</span>
                </div>
                <h4 className="text-lg font-bold text-slate-800">{report.title}</h4>
                <p className="text-sm text-slate-600 leading-6">{report.description}</p>
                <div className="text-xs text-slate-500 font-semibold flex items-center gap-2">
                  <span>📍 موقع البلاغ:</span>
                  <span className="text-slate-700 font-bold">{report.location}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-row md:flex-col gap-2 shrink-0 justify-end">
                {report.status === 'new' && (
                  <button 
                    onClick={() => updateStatus(report.id, 'investigating')}
                    className="bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs hover:bg-amber-600 transition-colors"
                  >
                    ⚙️ إرسال فريق الصيانة
                  </button>
                )}
                {report.status !== 'resolved' && (
                  <button 
                    onClick={() => updateStatus(report.id, 'resolved')}
                    className="bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl text-xs hover:bg-emerald-700 transition-colors"
                  >
                    ✓ تم حل المشكلة
                  </button>
                )}
                <button 
                  className="bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs hover:bg-slate-200 transition-colors"
                >
                  📝 إضافة ملاحظة
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-250 text-slate-400">
            لا توجد بلاغات تطابق التصفية المحدد حاليًا.
          </div>
        )}
      </div>
    </div>
  );
}
