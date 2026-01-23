export interface Post {
    id?: number;
    content: string;
    media_paths?: string;
    scheduled_at?: string; // ISO string
    status: 'draft' | 'scheduled' | 'sent' | 'failed' | 'processing' | 'deleted';
    created_at?: string;
    updated_at?: string;
    logs?: string;
    screenshot_path?: string;
    parent_id?: number;
    tweet_id?: string;
    views_count?: number;
    likes_count?: number;
    reposts_count?: number;
    username?: string;
}

export interface GrowthData {
    date: string;
    views: number;
    likes: number;
    reposts: number;
    engagement: number;
    posts: number;
}

export interface PerformanceStats {
    count: number;
    views: number;
    engagement: number;
    avg_engagement: number;
    engagement_rate: number;
}

export interface PerformanceData {
    text: PerformanceStats;
    media: PerformanceStats;
}

export interface BestTimesData {
    best_hours: number[];
    hourly_data: Record<number, number>;
    total_posts_analyzed: number;
    reason?: string;
}
