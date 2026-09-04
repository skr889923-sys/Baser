'use client';

import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const SCAN_HISTORY_DATA = [
  { day: 'الأحد', scans: 120 },
  { day: 'الإثنين', scans: 245 },
  { day: 'الثلاثاء', scans: 310 },
  { day: 'الأربعاء', scans: 280 },
  { day: 'الخميس', scans: 190 },
];

const POPULAR_DESTINATIONS = [
  { name: 'كلية الحاسب', users: 185 },
  { name: 'المكتبة', users: 142 },
  { name: 'عمادة الطلاب', users: 95 },
  { name: 'كلية العلوم', users: 78 },
  { name: 'السنة التحضيرية', users: 110 },
];

const tooltipStyle = {
  borderRadius: 14,
  border: '1px solid #d8e2e7',
  boxShadow: '0 18px 40px rgba(15, 35, 42, 0.12)',
  direction: 'rtl' as const,
  fontSize: 12,
  fontWeight: 700,
};

export default function DashboardCharts() {
  return (
    <section className="grid grid-cols-1 gap-5 xl:grid-cols-5" aria-label="مؤشرات الحركة الملاحية التجريبية">
      <article className="surface-panel xl:col-span-3">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow-label">نشاط التثبيت الداخلي</p>
            <h2 className="mt-2 text-lg font-black tracking-tight text-slate-950">مسوحات رموز QR خلال الأسبوع</h2>
          </div>
          <span className="data-badge">بيانات عرض</span>
        </div>
        <div className="h-72" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={SCAN_HISTORY_DATA} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 7" stroke="#dce6e9" vertical={false} />
              <XAxis dataKey="day" stroke="#70878f" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis stroke="#70878f" tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: '#75bdb7', strokeDasharray: '4 4' }} />
              <Line
                type="monotone"
                dataKey="scans"
                name="عمليات المسح"
                stroke="#23887f"
                strokeWidth={3}
                dot={{ r: 4, fill: '#f8fbfb', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#23887f' }}
                animationDuration={550}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="surface-panel xl:col-span-2">
        <div className="mb-6">
          <p className="eyebrow-label">طلب الوجهات</p>
          <h2 className="mt-2 text-lg font-black tracking-tight text-slate-950">الوجهات الأكثر استخدامًا</h2>
        </div>
        <div className="h-72" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={POPULAR_DESTINATIONS} layout="vertical" margin={{ top: 0, right: 12, left: 18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 7" stroke="#e2eaed" horizontal={false} />
              <XAxis type="number" stroke="#70878f" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis
                type="category"
                dataKey="name"
                width={88}
                stroke="#526971"
                tickLine={false}
                axisLine={false}
                fontSize={11}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#eef6f5' }} />
              <Bar
                dataKey="users"
                name="المستخدمون"
                fill="#75bdb7"
                radius={[0, 8, 8, 0]}
                barSize={20}
                animationDuration={550}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}
