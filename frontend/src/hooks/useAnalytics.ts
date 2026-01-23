import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export const useAnalytics = () => {
    const growthQuery = useQuery({
        queryKey: ['analytics', 'growth'],
        queryFn: async () => {
            const response = await api.get('/analytics/growth');
            return response.data;
        },
        refetchInterval: 300000, // 5 minutes
    });

    const bestTimesQuery = useQuery({
        queryKey: ['analytics', 'best-times'],
        queryFn: async () => {
            const response = await api.get('/analytics/best-times');
            return response.data;
        },
        refetchInterval: 3600000, // 1 hour
    });

    return {
        growthData: growthQuery.data || [],
        isLoadingGrowth: growthQuery.isLoading,
        bestTimes: bestTimesQuery.data || { best_hours: [9, 12, 18, 21] },
        isLoadingBestTimes: bestTimesQuery.isLoading,
    };
};
