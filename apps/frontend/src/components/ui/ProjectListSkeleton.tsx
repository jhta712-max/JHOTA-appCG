// apps/frontend/src/components/ui/ProjectListSkeleton.tsx
import { SkeletonBlock, SkeletonText } from './Skeleton';

export function ProjectListSkeleton() {
  return (
    <div className="space-y-4 mt-5">
      {/* Filter row */}
      <div className="flex gap-3 flex-wrap">
        <SkeletonBlock className="h-10 flex-1 min-w-[200px]" />
        <SkeletonBlock className="h-10 w-44" />
      </div>
      {/* Card rows */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 p-4 flex items-center gap-4">
            <div className="w-10 h-10 shrink-0" style={{ background: '#0D1B48' }} />
            <div className="flex-1 min-w-0">
              <SkeletonText lines={2} />
            </div>
            <div className="hidden sm:block text-right space-y-1.5 shrink-0">
              <SkeletonBlock className="h-5 w-28" />
              <SkeletonBlock className="h-3 w-16 ml-auto" />
            </div>
            <SkeletonBlock className="h-4 w-4 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
