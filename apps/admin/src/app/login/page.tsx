'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Fingerprint,
  LoaderCircle,
  MapPinned,
  ShieldCheck,
  Waves,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        setError('تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور ثم أعد المحاولة.');
        return;
      }

      if (data.user) {
        router.replace('/');
        router.refresh();
      }
    } catch {
      setError('تعذر الاتصال بخدمة الدخول حاليًا. حاول مرة أخرى بعد قليل.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-[100dvh] bg-[#071013] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden border-l border-white/10 p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="pointer-events-none absolute -right-32 -top-36 h-[34rem] w-[34rem] rounded-full bg-[#75bdb7]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative z-10 flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#75bdb7]/30 bg-[#75bdb7]/10 text-[#8bd2cc]">
            <Waves className="h-7 w-7" />
          </span>
          <div>
            <p className="text-2xl font-black tracking-[-0.04em] text-white">بصيره</p>
            <p className="mt-1 text-xs font-bold tracking-wide text-[#8bd2cc]">منصة تشغيل الملاحة الداخلية</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <p className="mb-5 text-xs font-black tracking-[0.14em] text-[#8bd2cc]">CONTROL THE PLACE. GUIDE WITH CARE.</p>
          <h1 className="text-balance text-5xl font-black leading-[1.12] tracking-[-0.055em] text-white xl:text-6xl">
            اجعل المكان قابلًا للفهم قبل أن يصبح مسارًا.
          </h1>
          <p className="mt-6 max-w-lg text-pretty text-base font-semibold leading-8 text-slate-400">
            إدارة النقاط والمسارات والطوارئ من مساحة تشغيل واحدة مصممة للوضوح وسرعة الاستجابة.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              { icon: MapPinned, label: 'خرائط دقيقة' },
              { icon: ShieldCheck, label: 'استجابة واضحة' },
              { icon: Fingerprint, label: 'وصول مقيّد' },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                  <Icon className="h-5 w-5 text-[#8bd2cc]" />
                  <p className="mt-4 text-xs font-black text-slate-300">{item.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        <p className="relative z-10 text-xs font-semibold text-slate-600">بصيره · نظام الملاحة والوصول الشامل</p>
      </section>

      <section className="relative flex items-center justify-center overflow-hidden bg-[#f3f6f6] px-5 py-10 sm:px-8">
        <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#75bdb7]/15 blur-3xl lg:hidden" />

        <div className="relative z-10 w-full max-w-md">
          <div className="mb-9 lg:hidden">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#10272c] text-[#8bd2cc]">
                <Waves className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xl font-black tracking-tight text-slate-950">بصيره</p>
                <p className="text-xs font-bold text-[#23887f]">منصة التشغيل</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <p className="eyebrow-label">دخول فريق التشغيل</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">مرحبًا بعودتك</h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-500">
              استخدم حساب الجامعة المخصص لإدارة بصيره.
            </p>
          </div>

          {error ? (
            <div
              className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold leading-6 text-rose-800"
              role="alert"
              aria-live="assertive"
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-black text-slate-800">
                البريد الإلكتروني
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                className="min-h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm font-semibold text-slate-950 shadow-sm placeholder:text-slate-400 hover:border-slate-300 focus:border-[#23887f] focus:outline-none"
                placeholder="operator@university.edu"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
                dir="ltr"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-black text-slate-800">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="min-h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 pl-14 text-left text-sm font-semibold text-slate-950 shadow-sm placeholder:text-slate-400 hover:border-slate-300 focus:border-[#23887f] focus:outline-none"
                  placeholder="••••••••"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  required
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  className="absolute left-2 top-2 flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176d66] px-5 text-sm font-black text-white shadow-[0_16px_35px_rgba(23,109,102,0.22)] hover:bg-[#115b55] active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  جاري التحقق
                </>
              ) : (
                <>
                  دخول لوحة الإدارة
                  <ArrowLeft className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-7 rounded-2xl border border-slate-200 bg-white/70 p-4">
            <p className="text-xs font-semibold leading-6 text-slate-500">
              لا تشارك بيانات الدخول. تُسجّل عمليات تعديل الخرائط والمسارات باسم حساب المشغّل.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
