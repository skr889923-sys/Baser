'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Building, NavigationPoint, Report, ReportStatus, ReportType } from '@baser/types';

const reportTypeLabel: Record<ReportType, string> = {
  obstacle: 'عائق في الممر',
  closed_door: 'باب مغلق',
  broken_elevator: 'مصعد متعطل',
  maintenance_work: 'أعمال صيانة',
  crowded: 'ازدحام',
  qr_issue: 'مشكلة QR',
  routing_issue: 'مشكلة مسار',
};

const statusLabel: Record<ReportStatus, string> = {
  new: 'جديد',
  investigating: 'قيد المعالجة',
  resolved: 'تم الحل',
  rejected: 'مرفوض',
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [points, setPoints] = useState<NavigationPoint[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | ReportStatus>('all');
  const [loading, setLoading] = useState(true);

  const pointsById = useMemo(() => Object.fromEntries(points.map(point => [point.id, point])), [points]);
  const buildingsById = useMemo(() => Object.fromEntries(buildings.map(building => [building.id, building])), [buildings]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: reportsData }, { data: pointsData }, { data: buildingsData }] = await Promise.all([
      supabase.from('reports').select('*').order('created_at', { ascending: false }),
      supabase.from('navigation_points').select('*'),
      supabase.from('buildings').select('*'),
    ]);

    setReports((reportsData || []) as Report[]);
    setPoints((pointsData || []) as NavigationPoint[]);
    setBuildings((buildingsData || []) as Building[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateStatus = async (id: string, status: ReportStatus) => {
    const { error } = await supabase.from('reports').update({ status }).eq('id', id);
    if (!error) {
      setReports(reports.map(report => report.id === id ? { ...report, status } : report));
    }
  };

  const filteredReports = reports.filter(report => activeFilter === 'all' || report.status === activeFilter);

  const getReportLocation = (report: Report) => {
    const point = report.navigation_point_id ? pointsById[report.navigation_point_id] : null;
    const building = report.building_id ? buildingsById[report.building_id] : null;

    if (point?.name_ar && building?.name_ar) return `${point.name_ar} - ${building.name_ar}`;
    if (point?.name_ar) return point.name_ar;
    if (building?.name_ar) return building.name_ar;
    if (report.latitude && report.longitude) return `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`;
    return 'غير محدد';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-800">بلاغات العوائق والمخاطر</h3>
          <p className="text-sm text-slate-500 mt-1">مراجعة بلاغات الطلاب والزوار الميدانية وتحديث حالتها لفريق الصيانة والأمن.</p>
        </div>
        <button onClick={fetchData} className="bg-white border border-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm hover:bg-slate-50">
          تحديث البيانات
        </button>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-3">
        {[
          { key: 'all', label: 'الكل' },
          { key: 'new', label: 'جديد' },
          { key: 'investigating', label: 'قيد المعالجة' },
          { key: 'resolved', label: 'تم الحل' },
          { key: 'rejected', label: 'مرفوض' },
        ].map(filter => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key as 'all' | ReportStatus)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeFilter === filter.key ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 text-slate-500">جاري تحميل البلاغات...</div>
        ) : filteredReports.length > 0 ? (
          filteredReports.map(report => (
            <div key={report.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    report.status === 'new' ? 'bg-red-50 text-red-700 border border-red-200' :
                    report.status === 'investigating' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    report.status === 'resolved' ? 'bg-green-50 text-green-700 border border-green-200' :
                    'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {statusLabel[report.status]}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    {new Date(report.created_at).toLocaleString('ar-SA')}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-800">{report.title || reportTypeLabel[report.report_type]}</h4>
                <p className="text-sm text-slate-600 leading-6">{report.description}</p>
                <div className="text-xs text-slate-500 font-semibold flex items-center gap-2">
                  <span>موقع البلاغ:</span>
                  <span className="text-slate-700 font-bold">{getReportLocation(report)}</span>
                </div>
                {report.admin_note && (
                  <div className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-3">
                    ملاحظة الإدارة: {report.admin_note}
                  </div>
                )}
              </div>

              <div className="flex flex-row md:flex-col gap-2 shrink-0 justify-end">
                {report.status === 'new' && (
                  <button
                    onClick={() => updateStatus(report.id, 'investigating')}
                    className="bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs hover:bg-amber-600 transition-colors"
                  >
                    إرسال فريق الصيانة
                  </button>
                )}
                {report.status !== 'resolved' && (
                  <button
                    onClick={() => updateStatus(report.id, 'resolved')}
                    className="bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl text-xs hover:bg-emerald-700 transition-colors"
                  >
                    تم حل المشكلة
                  </button>
                )}
                {report.status !== 'rejected' && (
                  <button
                    onClick={() => updateStatus(report.id, 'rejected')}
                    className="bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs hover:bg-slate-200 transition-colors"
                  >
                    رفض البلاغ
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 text-slate-400">
            لا توجد بلاغات تطابق التصفية المحددة حالياً.
          </div>
        )}
      </div>
    </div>
  );
}
