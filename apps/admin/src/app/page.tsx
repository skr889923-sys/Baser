import Link from 'next/link';
import {
  ArrowUpLeft,
  Building2,
  CircleAlert,
  MapPinned,
  Navigation,
  QrCode,
  Route,
  ShieldCheck,
  Siren,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import DashboardCharts from '@/components/DashboardCharts';

const METRICS = [
  {
    label: 'المباني المسجلة',
    value: '6',
    detail: 'مبانٍ قابلة لإضافة النقاط',
    icon: Building2,
    tone: 'teal',
  },
  {
    label: 'النقاط الملاحية',
    value: '11',
    detail: 'مداخل وتقاطعـات ومرافق',
    icon: MapPinned,
    tone: 'blue',
  },
  {
    label: 'طلبات SOS',
    value: '1',
    detail: 'طلب يحتاج تأكيد الاستلام',
    icon: Siren,
    tone: 'red',
  },
  {
    label: 'بلاغات مفتوحة',
    value: '2',
    detail: 'بلاغان ضمن متابعة الصيانة',
    icon: TriangleAlert,
    tone: 'amber',
  },
] as const;

const QUICK_ACTIONS = [
  {
    href: '/maps',
    label: 'افتح محرر الخريطة',
    description: 'ارسم نقاطًا ومسارات على خريطة الحرم.',
    icon: Navigation,
  },
  {
    href: '/routes',
    label: 'راجع المسارات',
    description: 'تحقق من حالة الربط والخطوات الصوتية.',
    icon: Route,
  },
  {
    href: '/qrs',
    label: 'جهّز رموز QR',
    description: 'أنشئ الملصقات وراجع توزيعها الميداني.',
    icon: QrCode,
  },
] as const;

function metricTone(tone: typeof METRICS[number]['tone']) {
  return {
    teal: 'bg-[#e5f3f1] text-[#176d66]',
    blue: 'bg-sky-50 text-sky-700',
    red: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
  }[tone];
}

export default function DashboardPage() {
  const today = new Intl.DateTimeFormat('ar-SA', { dateStyle: 'long' }).format(new Date());

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="console-hero">
        <div className="relative z-10 grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="console-kicker">
                <Sparkles className="h-3.5 w-3.5" />
                مركز تشغيل بصيره
              </span>
              <span className="console-date">{today}</span>
            </div>
            <h2 className="text-balance text-3xl font-black leading-tight tracking-[-0.04em] text-white sm:text-4xl lg:text-[2.8rem]">
              صورة تشغيلية واحدة للمكان، والمسار، والاستجابة.
            </h2>
            <p className="mt-4 max-w-2xl text-pretty text-sm font-semibold leading-7 text-slate-300 sm:text-base">
              راقب جاهزية الحرم، راجع نقاط التوجيه، وانتقل مباشرة إلى العمل الذي يحتاج تدخلك.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:w-72">
            <div className="console-mini-stat">
              <span className="text-2xl font-black tabular-nums text-white">92%</span>
              <span className="text-xs font-bold text-slate-400">جاهزية العرض</span>
            </div>
            <div className="console-mini-stat">
              <span className="text-2xl font-black tabular-nums text-[#8cd3cd]">3</span>
              <span className="text-xs font-bold text-slate-400">مهام عاجلة</span>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="dashboard-metrics">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow-label">المشهد الحالي</p>
            <h2 id="dashboard-metrics" className="mt-1 text-xl font-black tracking-tight text-slate-950">
              ما يحتاج الانتباه الآن
            </h2>
          </div>
          <span className="data-badge">بيانات تجريبية</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {METRICS.map(metric => {
            const Icon = metric.icon;
            return (
              <article key={metric.label} className="metric-panel">
                <div className={`metric-icon ${metricTone(metric.tone)}`}>
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-4xl font-black tracking-[-0.05em] text-slate-950 tabular-nums">{metric.value}</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{metric.detail}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <DashboardCharts />

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <article className="surface-panel overflow-hidden p-0">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
            <div>
              <p className="eyebrow-label text-rose-700">الاستجابة</p>
              <h2 className="mt-2 text-lg font-black tracking-tight text-slate-950">طلبات تحتاج قرارًا</h2>
            </div>
            <span className="status-chip status-chip-danger">
              <span className="h-2 w-2 rounded-full bg-current" />
              طلب نشط
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            <div className="group grid gap-4 px-5 py-5 transition-colors hover:bg-rose-50/40 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                <Siren className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black text-slate-950">طلب مساعدة من البوابة الرئيسية</h3>
                  <span className="text-xs font-bold text-rose-700">منذ دقيقتين</span>
                </div>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                  زائر غير مسجل · أقرب نقطة: بوابة الحرم الرئيسية
                </p>
              </div>
              <Link href="/emergency" className="primary-action">
                فتح غرفة الاستجابة
                <ArrowUpLeft className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-4 px-5 py-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <CircleAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-black text-slate-950">مصعد الدور الأرضي متعطل</h3>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                  كلية الحاسب · البلاغ قيد الصيانة
                </p>
              </div>
              <Link href="/reports" className="secondary-action">
                راجع البلاغ
                <ArrowUpLeft className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </article>

        <aside className="surface-panel">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow-label">اختصارات العمل</p>
              <h2 className="mt-2 text-lg font-black tracking-tight text-slate-950">انتقل مباشرة للمهمة</h2>
            </div>
            <ShieldCheck className="h-6 w-6 text-[#23887f]" />
          </div>

          <div className="space-y-2">
            {QUICK_ACTIONS.map(action => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href} className="quick-action group">
                  <span className="quick-action-icon">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-slate-950">{action.label}</span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{action.description}</span>
                  </span>
                  <ArrowUpLeft className="h-4 w-4 text-slate-400 transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              );
            })}
          </div>
        </aside>
      </section>
    </div>
  );
}
