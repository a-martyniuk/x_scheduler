import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Post } from '../types';

export function useQuarantinePosts() {
    const queryClient = useQueryClient();

    const { data: posts = [], isLoading, error, refetch } = useQuery<Post[]>({
        queryKey: ['posts', 'quarantine'],
        queryFn: () => api.getPosts('quarantine'),
        refetchInterval: 30000,
        enabled: !!localStorage.getItem('admin_token'),
    });

    const restoreMutation = useMutation({
        mutationFn: async (id: number) => {
            // Restore means setting status to 'sent' (or whatever logic)
            // We reuse updatePost for this
            return api.updatePost(id, { status: 'sent', logs: '\n[User] Restored from Quarantine' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['posts'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: api.deletePost,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['posts'] });
        },
    });

    return {
        posts,
        isLoading,
        error,
        refetch,
        restorePost: restoreMutation.mutateAsync,
        deletePost: deleteMutation.mutateAsync
    };
}
