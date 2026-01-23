import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export function useStats() {
    return useQuery({
        queryKey: ['globalStats'],
        queryFn: api.getGlobalStats,
        refetchInterval: 60000, // Every minute
    });
}
