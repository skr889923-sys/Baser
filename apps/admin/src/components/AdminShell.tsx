'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  Download,
  LayoutDashboard,
  LogOut,
  Map,
  MapPinned,
  Menu,
  Mic2,
  Navigation,
  QrCode,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navSections: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'النظام',
    items: [
      { href: '/', label: 'لوحة التحكم', description: 'مؤشرات عامة', icon: LayoutDashboard },
    ],
  },
  {
    title: 'إدارة الخريطة',
    items: [
      { href: '/maps', label: 'الخرائط', description: 'رسم النقاط والمسارات', icon: Map },
      { href: '/buildings', label: 'المباني', description: 'الكليات والمرافق', icon: Building2 },
      { href: '/points', label: 'النقاط', description: 'العقد والتعليمات', icon: MapPinned },
      { href: '/routes', label: 'المسارات', description: 'ربط النقاط', icon: Navigation },
      { href: '/qrs', label: 'رموز QR', description: 'طباعة وتوزيع', icon: QrCode },
    ],
  },
  {
    title: 'الأمن والاستجابة',
    items: [
      { href: '/emergency', label: 'طوارئ SOS', description: 'استجابة حية', icon: ShieldAlert },
      { href: '/reports', label: 'بلاغات العوائق', description: 'متابعة الصيانة', icon: AlertTriangle },
    ],
  },
  {
    title: 'الإدارة',
    items: [
      { href: '/voices', label: 'التعليق الصوتي', description: 'تسجيلات بشرية', icon: Mic2 },
      { href: '/users', label: 'المستخدمون', description: 'صلاحيات الفريق', icon: Users },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const currentPage = useMemo(() => {
    return navSections.flatMap(section => section.items).find(item => isActivePath(pathname, item.href));
  }, [pathname]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

    if ('serviceWorker' in navigator && isLocalhost) {
      navigator.serviceWorker.getRegistrations()
        .then(registrations => {
          registrations.forEach(registration => registration.unregister());
        })
        .catch(error => {
          console.warn('[Baseera Admin] Service worker cleanup failed:', error);
        });
    }

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(error => {
        console.warn('[Baseera Admin] Service worker registration failed:', error);
      });
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const sidebar = (
    <div className="h-full bg-slate-950 text-white flex flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-3 min-w-0">
            <span className="w-11 h-11 rounded-2xl bg-sky-500 text-slate-950 flex items-center justify-center font-black text-lg shrink-0">
              ب
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-black tracking-tight truncate">بصيره | Baseera</span>
              <span className="block text-xs text-sky-300 font-bold truncate">نظام الملاحة الداخلي</span>
            </span>
          </a>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="lg:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-[0.98]"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navSections.map(section => (
          <div key={section.title}>
            <div className="px-3 pb-2 text-[11px] font-black text-slate-500 tracking-wide uppercase">
              {section.title}
            </div>
            <div className="space-y-1">
              {section.items.map(item => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors active:scale-[0.99] ${
                      active
                        ? 'bg-white text-slate-950'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-sky-600' : 'text-slate-500 group-hover:text-sky-300'}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold truncate">{item.label}</span>
                      <span className={`block text-[11px] truncate ${active ? 'text-slate-500' : 'text-slate-500 group-hover:text-slate-400'}`}>
                        {item.description}
                      </span>
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-sky-500 text-slate-950 flex items-center justify-center font-black shrink-0">
            {user?.email?.charAt(0).toUpperCase() || 'أ'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">{user?.email || 'مسؤول النظام'}</p>
            <p className="text-xs text-slate-500 truncate">مدير النظام</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] lg:flex">
      <aside className="hidden lg:flex lg:w-80 lg:shrink-0 lg:sticky lg:top-0 lg:h-[100dvh]">
        {sidebar}
      </aside>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="إغلاق القائمة الجانبية"
          />
          <aside className="absolute inset-y-0 right-0 w-[min(88vw,22rem)] shadow-2xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
          <div className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="lg:hidden p-2 rounded-xl border border-slate-200 bg-white text-slate-700 active:scale-[0.98]"
                aria-label="فتح القائمة"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-black text-slate-900 truncate">
                  {currentPage?.label || 'لوحة التحكم'}
                </h1>
                <p className="hidden sm:block text-xs text-slate-500 font-semibold truncate">
                  جامعة قناة السويس | فكرة وتطوير: أ. رغد
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden md:flex bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold items-center gap-2 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 block animate-pulse" />
                Supabase متصل
              </div>
              {installPrompt && (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-3 py-2 text-xs font-bold hover:bg-slate-800 active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  تثبيت
                </button>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98]"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">خروج</span>
              </button>
            </div>
          </div>
          <div className="sm:hidden border-t border-slate-100 bg-sky-50/80 px-4 py-1.5 text-center text-[11px] font-black text-slate-700">
            فكرة وتطوير: أ. رغد
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
