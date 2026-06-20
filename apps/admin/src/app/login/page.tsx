'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Mock validation for demo
    setTimeout(() => {
      if (email.includes('@ksu.edu.sa') && password.length >= 6) {
        router.push('/');
      } else {
        setError('خطأ في البريد الإلكتروني أو كلمة المرور. يرجى إدخال بريد جامعي صحيح وكلمة مرور من 6 خانات.');
        setLoading(false);
      }
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-30"></div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl space-y-6 relative z-10 text-right">
        {/* Header branding */}
        <div className="text-center space-y-3">
          <span className="text-5xl block animate-bounce">🧭</span>
          <h1 className="text-2xl font-black text-white tracking-tight">دَلّني | Dallni</h1>
          <p className="text-sm text-slate-400">لوحة التحكم في التهيئة والوصول الملاحي للحرم الجامعي</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-400 p-4 rounded-xl text-xs font-bold leading-5">
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">البريد الإلكتروني الجامعي</label>
            <input 
              type="email" 
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500 font-semibold"
              placeholder="example@ksu.edu.sa"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">كلمة المرور</label>
            <input 
              type="password" 
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-sky-600 text-white font-bold py-3.5 rounded-xl hover:bg-sky-700 transition-colors shadow-lg shadow-sky-900/20 text-sm mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                جاري التحقق...
              </>
            ) : (
              'تسجيل الدخول للنظام 🔐'
            )}
          </button>
        </form>

        <div className="text-center pt-4 border-t border-slate-800/80 text-xs text-slate-500 font-semibold">
          نظام الملاحة الذكي والوصول الشامل © ٢٠٢٦
        </div>
      </div>
    </div>
  );
}
