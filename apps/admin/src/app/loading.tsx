export default function Loading() {
  return (
    <div className="space-y-6" aria-label="جاري تحميل الصفحة" aria-busy="true">
      <div className="h-56 animate-pulse rounded-[1.8rem] bg-slate-200/80" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map(item => (
          <div key={item} className="h-44 animate-pulse rounded-[1.45rem] border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="h-80 animate-pulse rounded-[1.6rem] border border-slate-200 bg-white" />
        <div className="h-80 animate-pulse rounded-[1.6rem] border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
