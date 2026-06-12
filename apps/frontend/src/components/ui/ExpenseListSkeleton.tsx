// apps/frontend/src/components/ui/ExpenseListSkeleton.tsx
import { SkeletonBlock } from './Skeleton';

export function ExpenseListSkeleton() {
  return (
    <div className="space-y-4 mt-5">
      {/* Project tabs row */}
      <div className="flex gap-0 border-b border-gray-200">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-9 w-20 mr-1" />
        ))}
      </div>
      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap">
        <SkeletonBlock className="h-10 flex-1 min-w-[180px]" />
        <SkeletonBlock className="h-10 w-40" />
        <SkeletonBlock className="h-10 w-52" />
        <SkeletonBlock className="h-10 w-24" />
      </div>
      {/* Card rows */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-1 self-stretch bg-gray-200 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <SkeletonBlock className="h-4 w-2/3" />
              <SkeletonBlock className="h-3 w-1/2" />
            </div>
            <div className="text-right space-y-2 shrink-0">
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-3 w-16 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
