import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Post } from '../types';

export function usePosts() {
    const queryClient = useQueryClient();

    const { data: posts = [], isLoading, error, refetch } = useQuery({
        queryKey: ['posts'],
        queryFn: api.getPosts,
        refetchInterval: 30000,
        enabled: !!localStorage.getItem('admin_token'),
    });

    const createMutation = useMutation({
        mutationFn: api.createPost,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['posts'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: (args: { id: number; post: Partial<Post> }) =>
            api.updatePost(args.id, args.post),
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
        createPost: createMutation.mutateAsync,
        updatePost: updateMutation.mutateAsync,
        deletePost: deleteMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
    };
}
