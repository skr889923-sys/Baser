import Link from 'next/link';
import { ArrowRight, MapPinned } from 'lucide-react';

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[65dvh] max-w-2xl flex-col items-center justify-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-[1.7rem] border border-[#b8dcd8] bg-[#e5f3f1] text-[#176d66]">
        <MapPinned className="h-9 w-9" />
      </div>
      <p className="eyebrow-label mt-8">404 / خارج المسار</p>
      <h2 className="mt-3 text-balance text-4xl font-black tracking-[-0.05em] text-slate-950">
        لم نعثر على هذه الصفحة
      </h2>
      <p className="mt-4 max-w-lg text-pretty text-sm font-semibold leading-7 text-slate-500">
        قد يكون الرابط قديمًا أو أن الصفحة نُقلت. ارجع إلى المشهد التشغيلي واختر وجهتك من القائمة.
      </p>
      <Link href="/" className="primary-action mt-7">
        <ArrowRight className="h-4 w-4" />
        العودة إلى لوحة التحكم
      </Link>
    </section>
  );
}
