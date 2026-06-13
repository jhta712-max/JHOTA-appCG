import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api';

export function useProjectItems(projectId?: string) {
  return useQuery({
    queryKey: ['project-items', projectId],
    queryFn:  () => projectsApi.getItems(projectId!).then((r) => r.data.data),
    enabled:  !!projectId,
    staleTime: 30_000,
  });
}

export function useCreateProjectItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => projectsApi.createItem(projectId, { name }).then((r) => r.data.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['project-items', projectId] }),
  });
}

export function useUpdateProjectItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; active?: boolean }) =>
      projectsApi.updateItem(projectId, id, data).then((r) => r.data.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['project-items', projectId] }),
  });
}
