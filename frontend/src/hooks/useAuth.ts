import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export function useAuth() {
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['authStatus'],
        queryFn: api.getAuthStatus,
        refetchInterval: 30000,
        enabled: !!localStorage.getItem('admin_token'),
    });

    const loginMutation = useMutation({
        mutationFn: api.login,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['authStatus'] });
        },
    });

    const accounts = (data?.accounts || []).map((acc: any) => ({
        ...acc,
        is_active: acc.connected,
        profile_image_url: acc.profile_image_url || null
    }));
    const primaryAccount = accounts[0] || null;

    return {
        accounts,
        primaryAccount,
        isLoading,
        login: loginMutation.mutateAsync,
        isLoggingIn: loginMutation.isPending,
    };
}
