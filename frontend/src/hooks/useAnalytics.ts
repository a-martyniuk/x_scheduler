import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export const useAnalytics = () => {
    const isAuth = !!localStorage.getItem('admin_token');

    const growthQuery = useQuery({
        queryKey: ['analytics', 'growth'],
        queryFn: api.getGrowthData,
        refetchInterval: 300000,
        enabled: isAuth,
    });

    const bestTimesQuery = useQuery({
        queryKey: ['analytics', 'best-times'],
        queryFn: api.getBestTimes,
        refetchInterval: 3600000,
        enabled: isAuth,
    });

    return {
        growthData: growthQuery.data || [],
        isLoadingGrowth: growthQuery.isLoading,
        bestTimes: bestTimesQuery.data || { best_hours: [9, 12, 18, 21] },
        isLoadingBestTimes: bestTimesQuery.isLoading,
        refetch: () => {
            growthQuery.refetch();
            bestTimesQuery.refetch();
        }
    };
};
