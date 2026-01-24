export interface Account {
    username: string;
    profile_image_url?: string;
    is_active: boolean;
    last_synced?: string;
    last_metrics_refresh?: string;
}

export interface Post {
    id?: number;
    content: string;
    media_paths?: string;
    scheduled_at?: string; // ISO string
    status: 'draft' | 'scheduled' | 'sent' | 'failed' | 'processing' | 'deleted' | 'deleted_on_x';
    created_at?: string;
    updated_at?: string;
    logs?: string;
    screenshot_path?: string;
    parent_id?: number;
    tweet_id?: string;
    views_count?: number;
    likes_count?: number;
    reposts_count?: number;
    bookmarks_count?: number;
    replies_count?: number;
    username?: string;
    media_url?: string;
    is_repost?: boolean;
}

export interface GrowthData {
    date: string;
    views: number;
    likes: number;
    reposts: number;
    bookmarks: number;
    replies: number;
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
