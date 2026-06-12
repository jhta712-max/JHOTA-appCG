// apps/frontend/src/components/ui/Skeleton.tsx

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-200 animate-pulse ${className}`} />;
}

export function SkeletonText({
  lines = 2,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`bg-gray-200 animate-pulse h-3 ${i === lines - 1 ? 'w-3/5' : 'w-full'}`}
        />
      ))}
    </div>
  );
}
