// apps/frontend/src/components/ui/DetailPageSkeleton.tsx
import { SkeletonBlock, SkeletonText } from './Skeleton';

export function DetailPageSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="space-y-6">
      {/* Back-arrow + breadcrumb row */}
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-8 w-8" />
        <SkeletonBlock className="h-4 w-36" />
      </div>
      {/* 4 stat chips */}
      <div className="flex gap-4 flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-20 w-36" />
        ))}
      </div>
      {/* Content sections */}
      {Array.from({ length: sections }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 p-6 space-y-4">
          <SkeletonBlock className="h-5 w-44" />
          <SkeletonText lines={3} />
          {i === 0 && (
            <div className="pt-2">
              <SkeletonText lines={4} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
