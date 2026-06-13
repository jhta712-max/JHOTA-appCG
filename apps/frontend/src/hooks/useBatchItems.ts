import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../api';

export function useBatchItems(projectId?: string) {
  return useQuery({
    queryKey: ['batch-items', projectId],
    queryFn:  () => projectsApi.getBatchItems(projectId!).then((r) => r.data.data),
    enabled:  !!projectId,
    staleTime: 60_000,
  });
}
