'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Building2,
  CircleDashed,
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
  icon: LucideIcon;
};

const navSections: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'المشهد التشغيلي',
    items: [
      { href: '/', label: 'لوحة التحكم', description: 'المؤشرات والمهام الحالية', icon: LayoutDashboard },
    ],
  },
  {
    title: 'بناء شبكة الملاحة',
    items: [
      { href: '/networks', label: 'شبكات الحرم', description: 'المسح والمعاينة والنشر', icon: MapPinned },
      { href: '/maps', label: 'محرر الخريطة', description: 'رسم النقاط والمسارات', icon: Map },
      { href: '/buildings', label: 'المباني', description: 'الكليات والمرافق', icon: Building2 },
      { href: '/points', label: 'نقاط التوجيه', description: 'العقد والتعليمات', icon: MapPinned },
      { href: '/routes', label: 'المسارات', description: 'الربط والخطوات', icon: Navigation },
      { href: '/qrs', label: 'رموز QR', description: 'الطباعة والتوزيع', icon: QrCode },
    ],
  },
  {
    title: 'الأمن والاستجابة',
    items: [
      { href: '/emergency', label: 'طوارئ SOS', description: 'طلبات المساعدة المباشرة', icon: ShieldAlert },
      { href: '/reports', label: 'بلاغات العوائق', description: 'متابعة الصيانة', icon: AlertTriangle },
    ],
  },
  {
    title: 'إدارة النظام',
    items: [
      { href: '/voices', label: 'التعليق الصوتي', description: 'الأصوات والعبارات', icon: Mic2 },
      { href: '/users', label: 'فريق التشغيل', description: 'المستخدمون والصلاحيات', icon: Users },
    ],
  },
];

const navItems = navSections.flatMap(section => section.items);

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const currentPage = useMemo(
    () => navItems.find(item => isActivePath(pathname, item.href)),
    [pathname],
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
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

  if (pathname === '/login') {
    return <>{children}</>;
  }

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
    <div className="relative flex h-full flex-col overflow-hidden bg-[#081317] text-white">
      <div
        className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#75bdb7]/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative border-b border-white/10 px-5 pb-5 pt-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="group flex min-w-0 items-center gap-3 rounded-xl">
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#75bdb7]/35 bg-[#75bdb7]/10">
              <span className="flex items-center gap-[3px]" aria-hidden="true">
                <span className="h-2 w-[3px] rounded-full bg-[#8bd2cc]" />
                <span className="h-5 w-[3px] rounded-full bg-[#8bd2cc]" />
                <span className="h-3 w-[3px] rounded-full bg-[#8bd2cc]" />
                <span className="h-6 w-[3px] rounded-full bg-[#8bd2cc]" />
              </span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-black tracking-[-0.03em]">بصيره</span>
              <span className="mt-1 block truncate text-[11px] font-bold tracking-wide text-[#8bd2cc]">
                منصة تشغيل الملاحة
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white active:scale-[0.98] lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav className="relative flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="التنقل الرئيسي">
        {navSections.map(section => (
          <section key={section.title} aria-labelledby={`nav-${section.title}`}>
            <h2
              id={`nav-${section.title}`}
              className="px-3 pb-2 text-[10px] font-black tracking-[0.13em] text-slate-600"
            >
              {section.title}
            </h2>
            <div className="space-y-1">
              {section.items.map(item => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex items-center gap-3 rounded-2xl px-3 py-3.5 active:scale-[0.99] ${
                      active
                        ? 'bg-[#dff1ef] text-[#102c2f] shadow-[0_14px_35px_rgba(0,0,0,0.18)]'
                        : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        active ? 'bg-white text-[#23887f]' : 'bg-white/[0.045] text-slate-500 group-hover:text-[#8bd2cc]'
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">{item.label}</span>
                      <span className={`mt-0.5 block truncate text-[11px] font-semibold ${active ? 'text-slate-600' : 'text-slate-600 group-hover:text-slate-400'}`}>
                        {item.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="relative border-t border-white/10 p-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#75bdb7] font-black text-[#092024]">
              {user?.email?.charAt(0).toUpperCase() || 'أ'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-white">{user?.email || 'مسؤول النظام'}</p>
              <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">حساب تشغيل تجريبي</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] lg:flex">
      <a
        href="#main-content"
        className="fixed right-4 top-3 z-50 -translate-y-20 rounded-xl bg-[#176d66] px-4 py-3 text-sm font-black text-white focus:translate-y-0"
      >
        الانتقال إلى المحتوى
      </a>

      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:w-72 lg:shrink-0">
        {sidebar}
      </aside>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="قائمة التنقل">
          <button
            type="button"
            className="absolute inset-0 bg-[#071013]/75 backdrop-blur-sm"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="إغلاق القائمة الجانبية"
          />
          <aside className="absolute inset-y-0 right-0 w-[min(88vw,20rem)] shadow-2xl">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f8faf9]/90 backdrop-blur-xl">
          <div className="flex min-h-[4.5rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] lg:hidden"
                aria-label="فتح القائمة"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="hidden text-[11px] font-black tracking-wide text-[#23887f] sm:inline">بصيره /</span>
                  <h1 className="truncate text-base font-black tracking-tight text-slate-950 sm:text-lg">
                    {currentPage?.label || 'لوحة التحكم'}
                  </h1>
                </div>
                <p className="mt-0.5 hidden truncate text-xs font-semibold text-slate-500 sm:block">
                  جامعة قناة السويس · نظام الملاحة الداخلية
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-black text-amber-800 md:flex">
                <CircleDashed className="h-4 w-4" />
                وضع تجريبي
              </div>
              {installPrompt ? (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="hidden min-h-10 items-center gap-2 rounded-xl bg-[#176d66] px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-[#115b55] active:scale-[0.98] sm:inline-flex"
                >
                  <Download className="h-4 w-4" />
                  تثبيت
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">خروج</span>
              </button>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          className="animate-soft-rise mx-auto w-full max-w-[1500px] flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
