import React from 'react';
import './globals.css';

export const metadata = {
  title: 'بصير | لوحة الإدارة الجامعية',
  description: 'لوحة التحكم الإدارية لإدارة المباني، النقاط الملاحية، والمسارات لمساعدة ذوي الإعاقة البصرية.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex">
        {/* Navigation Sidebar (Right-hand side in RTL) */}
        <aside className="w-80 bg-slate-900 text-white flex flex-col border-l border-slate-800 shrink-0">
          {/* Header Branding */}
          <div className="p-6 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🧭</span>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">بصير | Baser</h1>
                <p className="text-xs text-sky-400 font-semibold">نظام الملاحة الذكي للحرم</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4 space-y-1">
            <a href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-200 hover:text-white font-medium">
              <span>📊</span> لوحة التحكم العامة
            </a>
            
            <div className="pt-4 pb-2 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">إدارة الخريطة</div>
            <a href="/maps" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-200 hover:text-white font-medium">
              <span>🖼️</span> الخرائط التفاعلية
            </a>
            <a href="/buildings" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-200 hover:text-white font-medium">
              <span>🏢</span> الكليات والمباني
            </a>
            <a href="/points" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-200 hover:text-white font-medium">
              <span>📍</span> النقاط الملاحية (Nodes)
            </a>
            <a href="/routes" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-200 hover:text-white font-medium">
              <span>🗺️</span> المسارات الملاحية
            </a>
            <a href="/qrs" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-200 hover:text-white font-medium">
              <span>📷</span> رموز الاستجابة QR Codes
            </a>

            <div className="pt-4 pb-2 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">الأمن والاستجابة</div>
            <a href="/emergency" className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-200 hover:text-white font-medium">
              <div className="flex items-center gap-3">
                <span>🚨</span> طوارئ SOS النشطة
              </div>
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">1</span>
            </a>
            <a href="/reports" className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-200 hover:text-white font-medium">
              <div className="flex items-center gap-3">
                <span>⚠️</span> بلاغات العوائق
              </div>
              <span className="bg-amber-500 text-slate-950 text-xs px-2 py-0.5 rounded-full font-bold">2</span>
            </a>

            <div className="pt-4 pb-2 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">الإدارة</div>
            <a href="/users" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-200 hover:text-white font-medium">
              <span>👥</span> الصلاحيات والمستخدمين
            </a>
          </nav>

          {/* User profile footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center font-bold text-lg">
              مه
            </div>
            <div>
              <p className="text-sm font-bold text-white">م. هشام أحمد</p>
              <p className="text-xs text-slate-400">مدير النظام الرئيسي</p>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800">
              جامعة الملك سعود - إدارة الوصول والتهيئة الملاحية
            </h2>
            <div className="flex items-center gap-4">
              <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 border border-green-200">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 block animate-pulse"></span>
                قاعدة بيانات Supabase متصلة
              </div>
              <a href="/login" className="text-sm text-slate-600 hover:text-slate-900 font-bold transition-colors">
                تسجيل الخروج 👤
              </a>
            </div>
          </header>

          {/* Page Viewport */}
          <main className="flex-1 p-8 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
