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
