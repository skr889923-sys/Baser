'use client';

import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

// Seed data representations for dashboard views
const SCAN_HISTORY_DATA = [
  { day: 'الأحد', scans: 120 },
  { day: 'الإثنين', scans: 245 },
  { day: 'الثلاثاء', scans: 310 },
  { day: 'الأربعاء', scans: 280 },
  { day: 'الخميس', scans: 190 },
];

const POPULAR_DESTINATIONS = [
  { name: 'كلية الحاسب', users: 185 },
  { name: 'المكتبة المركزية', users: 142 },
  { name: 'عمادة الطلاب', users: 95 },
  { name: 'كلية العلوم', users: 78 },
  { name: 'السنة التحضيرية', users: 110 },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* 1. Header Overview */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-800">نظرة عامة على النظام</h3>
          <p className="text-sm text-slate-500 mt-1">تحديث حي للحركة الملاحية وطلبات الطوارئ داخل الحرم الجامعي.</p>
        </div>
        <div className="text-slate-500 text-sm font-semibold">تاريخ اليوم: {new Date().toLocaleDateString('ar-SA')}</div>
      </div>

      {/* 2. Key Metrics Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Buildings Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
          <div className="w-14 h-14 bg-sky-50 rounded-xl flex items-center justify-center text-3xl">🏢</div>
          <div>
            <span className="text-slate-400 text-sm font-semibold block">إجمالي المباني</span>
            <span className="text-3xl font-extrabold text-slate-800">6</span>
          </div>
        </div>

        {/* Navigation Nodes Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
          <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center text-3xl">📍</div>
          <div>
            <span className="text-slate-400 text-sm font-semibold block">النقاط الملاحية</span>
            <span className="text-3xl font-extrabold text-slate-800">11</span>
          </div>
        </div>

        {/* Live SOS Alerts */}
        <div className="bg-red-50 p-6 rounded-2xl shadow-sm border border-red-200 flex items-center gap-5">
          <div className="w-14 h-14 bg-red-500 rounded-xl flex items-center justify-center text-3xl animate-pulse">🚨</div>
          <div>
            <span className="text-red-800 text-sm font-bold block">طوارئ SOS نشطة</span>
            <span className="text-3xl font-extrabold text-red-700">1</span>
          </div>
        </div>

        {/* Obstacle Reports Card */}
        <div className="bg-amber-50 p-6 rounded-2xl shadow-sm border border-amber-200 flex items-center gap-5">
          <div className="w-14 h-14 bg-amber-400 rounded-xl flex items-center justify-center text-3xl">⚠️</div>
          <div>
            <span className="text-amber-800 text-sm font-bold block">بلاغات عوائق مفتوحة</span>
            <span className="text-3xl font-extrabold text-amber-700">2</span>
          </div>
        </div>
      </div>

      {/* 3. Graphs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Scans Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h4 className="text-base font-bold text-slate-800 mb-6">عدد مسوحات رموز QR اليومية</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={SCAN_HISTORY_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="scans" stroke="#0284c7" strokeWidth={3} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Destinations Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h4 className="text-base font-bold text-slate-800 mb-6">الوجهات الملاحية الأكثر طلبًا</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={POPULAR_DESTINATIONS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="users" fill="#10b981" radius={[8, 8, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Live Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Live SOS Alerts */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-base font-bold text-red-600 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 block animate-pulse"></span>
              إشارة استغاثة نشطة (SOS)
            </h4>
            <span className="text-xs text-red-500 font-bold bg-red-50 px-2.5 py-1 rounded-full">استجابة فورية</span>
          </div>

          <div className="border border-red-100 rounded-xl overflow-hidden bg-red-50/20">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-red-50 text-red-800 font-semibold text-sm">
                  <th className="p-4">الطالب</th>
                  <th className="p-4">أقرب نقطة مرئية</th>
                  <th className="p-4">المنطقة الجغرافية</th>
                  <th className="p-4">التحكم</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-t border-red-100">
                  <td className="p-4 font-bold text-slate-800">مجهول (زائر كفيف)</td>
                  <td className="p-4 text-slate-600">بوابة الحرم الرئيسية (بوابة 1)</td>
                  <td className="p-4 text-slate-500">24.7082 , 46.6705</td>
                  <td className="p-4">
                    <a href="/emergency" className="bg-red-600 text-white font-semibold text-xs px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors inline-block">
                      تفاصيل / توجيه دورية 🚨
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Obstacle Reports */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>⚠️</span> بلاغات العوائق والممرات المغلقة
            </h4>
            <a href="/reports" className="text-xs text-slate-500 hover:text-slate-800 font-bold">عرض جميع البلاغات ➔</a>
          </div>

          <div className="border border-slate-100 rounded-xl overflow-hidden">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-semibold text-sm">
                  <th className="p-4">نوع المشكلة</th>
                  <th className="p-4">الموقع</th>
                  <th className="p-4">الوصف</th>
                  <th className="p-4">الحالة</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-t border-slate-100">
                  <td className="p-4 font-bold text-slate-800">🚧 عائق في الممر</td>
                  <td className="p-4 text-slate-600">بهو كلية الحاسب الرئيسي</td>
                  <td className="p-4 text-slate-500">معدات ومقاعد صيانة ملقاة في ممر المكفوفين</td>
                  <td className="p-4">
                    <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold">قيد المراجعة</span>
                  </td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="p-4 font-bold text-slate-800">🛗 مصعد متعطل</td>
                  <td className="p-4 text-slate-600">كلية الحاسب - الدور الأرضي</td>
                  <td className="p-4 text-slate-500">المصعد لا يستجيب للأزرار الخارجية البارزة</td>
                  <td className="p-4">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-bold">قيد الصيانة</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
