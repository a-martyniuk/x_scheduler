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

    const performanceQuery = useQuery({
        queryKey: ['analytics', 'performance'],
        queryFn: api.getPerformanceData,
        refetchInterval: 300000,
        enabled: isAuth,
    });

    const latestPostQuery = useQuery({
        queryKey: ['posts', 'latest'],
        queryFn: api.getLatestPost,
        refetchInterval: 60000,
        enabled: isAuth,
    });

    return {
        growthData: growthQuery.data || [],
        isLoadingGrowth: growthQuery.isLoading,
        bestTimes: bestTimesQuery.data || { best_hours: [9, 12, 18, 21], total_posts_analyzed: 0 },
        isLoadingBestTimes: bestTimesQuery.isLoading,
        performanceData: performanceQuery.data,
        isLoadingPerformance: performanceQuery.isLoading,
        latestPost: latestPostQuery.data || null,
        isLoadingLatestPost: latestPostQuery.isLoading,
        refetch: () => {
            growthQuery.refetch();
            bestTimesQuery.refetch();
            performanceQuery.refetch();
            latestPostQuery.refetch();
        }
    };
};
