import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export function useAuth() {
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['authStatus'],
        queryFn: api.getAuthStatus,
        refetchInterval: 30000,
    });

    const loginMutation = useMutation({
        mutationFn: api.login,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['authStatus'] });
        },
    });

    const accounts = data?.accounts || [];
    const primaryAccount = accounts[0] || null;

    return {
        accounts,
        primaryAccount,
        isLoading,
        login: loginMutation.mutateAsync,
        isLoggingIn: loginMutation.isPending,
    };
}
