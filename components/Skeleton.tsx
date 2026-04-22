export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-shimmer rounded-md ${className ?? ""}`} />;
}

export function IdeaListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
        >
          <Skeleton className="h-5 w-20 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-2/3 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function IdeaExpandedRowSkeleton({ noBorder }: { noBorder?: boolean } = {}) {
  return (
    <div className={`${noBorder ? "" : "rounded-lg border"} px-5 py-5 space-y-2.5`}>
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-2/5 rounded" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-3/4 rounded" />
      <div className="flex items-center gap-4 pt-0.5">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-24 rounded-full" />
      </div>
    </div>
  );
}

export function IdeaMasonryItemSkeleton() {
  return (
    <div className="break-inside-avoid mb-4 pl-4 py-3 border-l-[3px] border-l-muted space-y-2">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-3/5 rounded" />
        <Skeleton className="h-4 w-14 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full rounded" />
      <Skeleton className="h-3 w-4/5 rounded" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-10 rounded" />
      </div>
    </div>
  );
}

export function NotificationSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function IdeaDetailSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <Skeleton className="h-8 w-3/4 rounded" />
      <Skeleton className="h-5 w-full rounded" />
      <Skeleton className="h-5 w-2/3 rounded" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-16 w-full rounded" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-16 w-full rounded" />
        </div>
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-32 rounded" />
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-24 rounded" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-16 rounded-md" />
          ))}
        </div>
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-4">
        <Skeleton className="h-6 w-28 rounded" />
        <Skeleton className="h-20 w-full rounded" />
      </div>
    </div>
  );
}
