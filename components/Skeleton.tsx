export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-shimmer rounded-md ${className ?? ""}`} />;
}

export function IdeaListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3"
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

export function IdeaExpandedRowSkeleton() {
  return (
    <div className="py-5 first:pt-0 space-y-2.5">
      <div className="flex items-center gap-3 pl-0">
        <Skeleton className="h-2 w-2 rounded-full" />
        <Skeleton className="h-5 w-2/5 rounded" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-4 w-16 rounded" />
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-8 rounded" />
        </div>
      </div>
      <div className="pl-5 space-y-1.5">
        <Skeleton className="h-3.5 w-full rounded" />
        <Skeleton className="h-3.5 w-3/4 rounded" />
      </div>
      <div className="flex items-center gap-3 pl-5">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-12 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </div>
    </div>
  );
}

export function IdeaMasonryItemSkeleton() {
  return (
    <div className="break-inside-avoid mb-3 pl-4 py-4 border-l-2 border-l-muted space-y-2">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-3/5 rounded" />
        <Skeleton className="h-1.5 w-1.5 rounded-full mt-1.5" />
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
    <div className="space-y-8 animate-fade-in">
      <Skeleton className="h-1 w-full rounded-full" />
      <Skeleton className="h-9 w-3/5 rounded" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-full rounded" />
        <Skeleton className="h-5 w-3/4 rounded" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-4 w-24 rounded" />
        <Skeleton className="h-4 w-12 rounded" />
      </div>
      <div className="grid md:grid-cols-2 gap-x-10 gap-y-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-16 w-full rounded" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-28 rounded" />
          <Skeleton className="h-16 w-full rounded" />
        </div>
      </div>
      <div className="flex gap-3 py-6 border-t">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-14 rounded-full" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-20 rounded" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-20 w-full rounded" />
      </div>
    </div>
  );
}
