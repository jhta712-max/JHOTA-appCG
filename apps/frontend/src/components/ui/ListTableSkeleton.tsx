// apps/frontend/src/components/ui/ListTableSkeleton.tsx
import { SkeletonBlock } from './Skeleton';

interface Props {
  cols: number;
  rows?: number;
  colWidths?: string[];
}

export function ListTableSkeleton({ cols, rows = 8, colWidths }: Props) {
  return (
    <div className="bg-white border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead style={{ background: '#1C1C1C' }}>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3" style={{ width: colWidths?.[i] }}>
                <SkeletonBlock className="h-3 w-16 bg-gray-600" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-4 py-3">
                  <SkeletonBlock
                    className={`h-4 ${c === 0 ? 'w-20' : c === cols - 1 ? 'w-16 ml-auto' : 'w-full'}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
