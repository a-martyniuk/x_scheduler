import React from 'react';
import { Eye, Heart, TrendingUp, ArrowUpRight, Clock, Zap, Info, BarChart2, Layers, RefreshCcw, Share2, Bookmark, MessageCircle } from 'lucide-react';
import type { Post } from '../types';
import { motion } from 'framer-motion';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { useAnalytics } from '../hooks/useAnalytics';
import { cn } from '../lib/utils';
import { LatestPostWidget } from './LatestPostWidget';

interface AnalyticsViewProps {
    posts: Post[];
    globalStats?: {
        sent: number;
        failed: number;
        scheduled: number;
        drafts: number;
        views: number;
        likes: number;
        reposts: number;
    };
    accounts?: { username: string; last_synced?: string }[];
    onSync?: () => Promise<{ imported: number; log: string; debug_screenshot?: string }>;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ posts, globalStats, accounts, onSync }) => {
    const { growthData, bestTimes, performanceData, latestPost, isLoadingLatestPost, accountGrowth } = useAnalytics();
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [selectedMetric, setSelectedMetric] = React.useState<'views' | 'likes' | 'followers' | 'posts' | 'bookmarks' | 'replies'>('views');

    // Mapeo de colores para la métrica activa
    const metricColors = {
        views: '#6366F1',
        likes: '#F43F5E',
        followers: '#10B981',
        posts: '#3B82F6',
        bookmarks: '#F59E0B',
        replies: '#8B5CF6'
    };
    const ACTIVE_METRIC_COLOR = metricColors[selectedMetric];

    // Merge growthData (posts metrics) and accountGrowth (followers history)
    const mergedChartData = React.useMemo(() => {
        const dataMap = new Map<string, any>();

        // 1. Process Growth Data (Post Metrics)
        growthData.forEach(d => {
            // d.date is "YYYY-MM-DD" or similar string from backend
            // Ensure it matches format of accountGrowth if different.
            // Both seem to return YYYY-MM-DD keys or ISO strings.
            // Standardize to YYYY-MM-DD for the map key.
            const dateObj = new Date(d.date);
            const key = dateObj.toISOString().split('T')[0];

            if (!dataMap.has(key)) dataMap.set(key, { dateStr: key });
            const entry = dataMap.get(key);
            entry.views = d.views;
            entry.likes = d.likes;
            entry.posts = d.posts;
            entry.bookmarks = d.bookmarks;
            entry.replies = d.replies;
        });

        // 2. Process Account Growth (Followers)
        if (accountGrowth) {
            accountGrowth.forEach(d => {
                const dateObj = new Date(d.date); // d.date is ISO
                const key = dateObj.toISOString().split('T')[0];

                if (!dataMap.has(key)) dataMap.set(key, { dateStr: key });
                const entry = dataMap.get(key);
                entry.followers = d.followers;
            });
        }

        // 3. Convert to array and sort
        const result = Array.from(dataMap.values()).sort((a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        );

        // Fill gaps if needed (optional, for now let's just use what we have)
        // Ensure all metrics exist to avoid graph breaking
        return result.map(r => ({
            ...r,
            views: r.views || 0,
            likes: r.likes || 0,
            posts: r.posts || 0,
            bookmarks: r.bookmarks || 0,
            replies: r.replies || 0,
            // For followers, we might want to carry over previous value if missing (step line), 
            // but for now let's leave as undefined so the line breaks or is interpolated by Recharts
            followers: r.followers
        }));
    }, [growthData, accountGrowth]);

    const handleSync = async () => {
        if (!onSync) return;
        setIsSyncing(true);
        try {
            const result = await onSync();
            alert(`Sincronización completada.\nPosts importados: ${result.imported}`);
        } catch (error: any) {
            alert(`Error al sincronizar: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    };
    // Filter out retweets from the main table if requested, or keep them separate.
    // User request: remove reposts from top performance because stats are confusing
    const sentPosts = posts.filter(p => (p.status === 'sent' || p.status === 'deleted_on_x') && p.tweet_id && !p.is_repost);

    // Filter out retweets for aggregate stats
    const originalPosts = sentPosts.filter(p => !p.is_repost);

    const totalViews = globalStats?.views || originalPosts.reduce((acc, p) => acc + (p.views_count || 0), 0);
    const totalLikes = globalStats?.likes || originalPosts.reduce((acc, p) => acc + (p.likes_count || 0), 0);
    const totalReposts = globalStats?.reposts || originalPosts.reduce((acc, p) => acc + (p.reposts_count || 0), 0);

    const totalSent = globalStats?.sent || originalPosts.length;
    const averageEngagement = totalSent > 0
        ? ((totalLikes + totalReposts) / totalSent).toFixed(1)
        : '0.0';

    // Calculate engagement rate for individual posts
    const getEngagementRate = (post: Post) => {
        if (!post.views_count || post.views_count === 0) return 0;
        return (((post.likes_count || 0) + (post.reposts_count || 0)) / post.views_count * 100);
    };

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    const lastSyncedTime = accounts?.[0]?.last_synced ? new Date(accounts[0].last_synced).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : null;

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-8"
        >
            {/* Latest Post Widget (Hero Section) */}
            <motion.div variants={item}>
                <LatestPostWidget post={latestPost} isLoading={isLoadingLatestPost} />
            </motion.div>

            {/* Header Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Alcance Total', val: totalViews, icon: Eye, color: 'text-slate-500' },
                    { label: 'Likes Totales', val: totalLikes, icon: Heart, color: 'text-rose-500' },
                    { label: 'Volumen', val: totalSent, icon: Layers, color: 'text-emerald-500', suffix: 'posts' },
                    { label: 'Engagement', val: averageEngagement, icon: TrendingUp, color: 'text-primary', suffix: '%' },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        variants={item}
                        className="p-6 rounded-[2rem] bg-white/60 dark:bg-white/5 border border-border/50 hover-lift group relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <stat.icon size={32} className={stat.color} />
                        </div>
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                        <div className="flex items-end gap-2">
                            <span className={cn("text-2xl font-black tracking-tighter tabular-nums", stat.color)}>
                                {typeof stat.val === 'number' ? stat.val.toLocaleString() : stat.val}
                            </span>
                            {stat.suffix && <span className="text-[9px] font-bold opacity-60 mb-1 leading-tight">{stat.suffix}</span>}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Main Charts area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Unified Performance Chart */}
                <motion.div
                    variants={item}
                    className="lg:col-span-3 bg-white/60 dark:bg-gray-900/80 p-6 rounded-[2.5rem] border border-white/80 dark:border-white/10 shadow-xl flex flex-col relative overflow-hidden group min-h-[450px]"
                >
                    {/* Background Pattern */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 z-10 w-full gap-4">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3">
                                <TrendingUp className="text-primary" size={20} />
                                <h3 className="text-lg font-black tracking-tight whitespace-nowrap">Evolución de Rendimiento</h3>
                            </div>
                            {lastSyncedTime && (
                                <div className="flex items-center gap-2 px-2 py-0.5 bg-green-500/5 rounded-md border border-green-500/10 w-fit ml-8">
                                    <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[8px] font-bold text-green-600/80 dark:text-green-400/80 uppercase tracking-wide">
                                        {lastSyncedTime}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-2xl overflow-x-auto max-w-full">
                            {[
                                { id: 'views', label: 'Alcance', icon: Eye, color: '#6366F1' },
                                { id: 'likes', label: 'Likes', icon: Heart, color: '#F43F5E' },
                                { id: 'bookmarks', label: 'Guardados', icon: Bookmark, color: '#F59E0B' },
                                { id: 'replies', label: 'Respuestas', icon: MessageCircle, color: '#8B5CF6' },
                                { id: 'followers', label: 'Seguidores', icon: TrendingUp, color: '#10B981' },
                                { id: 'posts', label: 'Posts', icon: Layers, color: '#3B82F6' },
                            ].map((m) => {
                                const isActive = (selectedMetric || 'views') === m.id;
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => setSelectedMetric(m.id as any)}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                            isActive
                                                ? "bg-white dark:bg-white/10 text-primary shadow-sm"
                                                : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
                                        )}
                                        style={{ color: isActive ? m.color : undefined }}
                                    >
                                        <m.icon size={12} />
                                        {m.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Sync Button */}
                        {onSync && (
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className={cn(
                                    "p-3 bg-primary/10 text-primary rounded-2xl hover:bg-primary hover:text-white transition-all active:scale-95 flex items-center gap-2 self-end md:self-auto",
                                    isSyncing && "animate-spin opacity-50 cursor-not-allowed"
                                )}
                                title="Sincronizar Historial"
                            >
                                <RefreshCcw size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest md:hidden">Sincronizar</span>
                            </button>
                        )}
                    </div>



                    <div className="flex-1 w-full min-h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={mergedChartData}>
                                <defs>
                                    <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={ACTIVE_METRIC_COLOR} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={ACTIVE_METRIC_COLOR} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    dataKey="dateStr"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 700 }}
                                    dy={10}
                                    tickFormatter={(str) => {
                                        if (!str) return '';
                                        const date = new Date(str);
                                        return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
                                    }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 700 }}
                                    domain={['auto', 'auto']}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '20px',
                                        border: 'none',
                                        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                                        backgroundColor: 'rgba(255,255,255,0.95)',
                                        color: '#000'
                                    }}
                                    itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: ACTIVE_METRIC_COLOR }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey={selectedMetric || 'views'}
                                    stroke={ACTIVE_METRIC_COLOR}
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorMetric)"
                                    name={selectedMetric?.toUpperCase() || 'METRICA'}
                                    animationDuration={1000}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Performance Breakdown */}
                <motion.div
                    variants={item}
                    className="bg-white/60 dark:bg-gray-900/80 p-8 rounded-[3rem] border border-white/80 dark:border-white/10 shadow-xl flex flex-col"
                >
                    <div className="flex items-center gap-4 mb-8">
                        <BarChart2 className="text-primary" size={24} />
                        <h3 className="text-xl font-black tracking-tight">Efectividad</h3>
                    </div>

                    <div className="space-y-6 flex-1">
                        {performanceData ? (
                            <div className="space-y-6">
                                {[
                                    { label: 'Multimedia', data: performanceData.media, color: 'bg-primary' },
                                    { label: 'Solo Texto', data: performanceData.text, color: 'bg-slate-400' }
                                ].map((type) => (
                                    <div key={type.label} className="space-y-2">
                                        <div className="flex justify-between items-center px-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest">{type.label}</span>
                                            <span className="text-[10px] font-bold text-primary">{type.data.engagement_rate.toFixed(1)}% ER</span>
                                        </div>
                                        <div className="h-3 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(type.data.engagement_rate * 10, 100)}%` }}
                                                className={cn("h-full rounded-full", type.color)}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[8px] font-bold opacity-50 uppercase tracking-tighter">
                                            <span>{type.data.count} posts</span>
                                            <span>~{(type.data.avg_engagement).toFixed(1)} eng/post</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center opacity-30 text-[10px] font-black uppercase tracking-widest italic">
                                Cargando datos de rendimiento...
                            </div>
                        )}

                        <div className="mt-auto p-5 rounded-2xl bg-primary/5 border border-primary/10">
                            <div className="flex gap-3">
                                <Zap className="text-primary shrink-0" size={16} />
                                <p className="text-[10px] font-bold leading-relaxed">
                                    {performanceData && performanceData.media.engagement_rate > performanceData.text.engagement_rate
                                        ? "Tus posts con multimedia tienen un % mayor de engagement. ¡Sigue así!"
                                        : "Tus posts de texto están rindiendo excepcionalmente bien."}
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Insights & Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Best Times Insights */}
                <motion.div
                    variants={item}
                    className="bg-primary/5 dark:bg-primary/10 p-8 rounded-[3rem] border border-primary/20 shadow-xl flex flex-col"
                >
                    <div className="flex items-center gap-4 mb-8">
                        <Clock className="text-primary" size={24} />
                        <h3 className="text-xl font-black tracking-tight">Mejores Horarios</h3>
                    </div>

                    <div className="space-y-6 flex-1">
                        <div className="grid grid-cols-2 gap-3">
                            {bestTimes.best_hours.map((hour: number) => (
                                <div key={hour} className="bg-white/80 dark:bg-white/5 p-4 rounded-2xl border border-white/20 text-center group hover:bg-primary/10 transition-colors">
                                    <span className="text-lg font-black tracking-tighter">{hour}:00</span>
                                    <p className="text-[8px] font-bold opacity-60 uppercase">Alta Probabilidad</p>
                                </div>
                            ))}
                        </div>

                        <div className="p-5 rounded-2xl bg-primary/10 border border-primary/10">
                            <div className="flex gap-3">
                                <Info className="text-primary shrink-0" size={16} />
                                <p className="text-[10px] font-bold leading-relaxed">
                                    Basado en el análisis de {bestTimes.total_posts_analyzed || 0} publicaciones previas.
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Table: Top Posts */}
                <motion.div
                    variants={item}
                    className="lg:col-span-2 bg-white/60 dark:bg-gray-900/80 p-10 rounded-[3.5rem] border border-white/80 dark:border-white/10 shadow-2xl overflow-hidden"
                >
                    <div className="flex items-center justify-between mb-8 px-2">
                        <div className="flex items-center gap-4">
                            <div className="w-2 h-8 bg-primary rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                            <h3 className="text-2xl font-black tracking-tight">Top Performance</h3>
                        </div>
                    </div>

                    <div className="overflow-x-auto h-[400px] custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border/40 sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-10">
                                    <th className="pb-6 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4">Contenido</th>
                                    <th className="pb-6 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4 text-center">Vistas</th>
                                    <th className="pb-6 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4 text-center">ER%</th>
                                    <th className="pb-6 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4 text-center">X</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/10">
                                {sentPosts.sort((a, b) => (b.views_count || 0) - (a.views_count || 0)).slice(0, 15).map(post => {
                                    const er = getEngagementRate(post);
                                    return (
                                        <tr key={post.id} className={cn(
                                            "group hover:bg-primary/5 transition-colors",
                                            post.status === 'deleted_on_x' && "opacity-60 bg-red-500/5 hover:bg-red-500/10"
                                        )}>
                                            <td className="py-5 px-4">
                                                <div className="flex items-start gap-3">
                                                    {post.media_url ? (
                                                        <img
                                                            src={post.media_url}
                                                            alt="Thumbnail"
                                                            className={cn("w-10 h-10 rounded-lg object-cover bg-slate-100 dark:bg-white/5 border border-border/20 shrink-0", post.status === 'deleted_on_x' && "grayscale")}
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                                                            <div className="w-2 h-2 rounded-full bg-primary/20" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className={cn("text-sm font-bold line-clamp-2 max-w-[200px] mb-1", post.status === 'deleted_on_x' && "line-through decoration-red-500/50")}>{post.content}</p>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[8px] font-black text-muted-foreground/50 uppercase">{new Date(post.updated_at!).toLocaleDateString()}</span>
                                                            {(post.media_paths || post.media_url) && !post.media_url && <span className="text-[8px] font-black text-primary uppercase bg-primary/10 px-1.5 rounded-sm">Media</span>}
                                                            {post.status === 'deleted_on_x' && <span className="text-[8px] font-black text-white bg-red-500 px-1.5 rounded-sm uppercase tracking-wider">Deleted on X</span>}
                                                            {post.is_repost && <span className="text-[8px] font-black text-indigo-500 bg-indigo-500/10 px-1.5 rounded-sm uppercase tracking-wider flex items-center gap-1"><Share2 size={8} /> Repost</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-5 px-4 text-center">
                                                <span className="text-sm font-black tabular-nums">{post.views_count?.toLocaleString() || 0}</span>
                                            </td>
                                            <td className="py-5 px-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className={cn(
                                                        "text-sm font-black tabular-nums",
                                                        er > 5 ? "text-emerald-500" : er > 2 ? "text-primary" : "text-slate-500"
                                                    )}>{er.toFixed(1)}%</span>
                                                </div>
                                            </td>
                                            <td className="py-5 px-4 text-center">
                                                <a
                                                    href={`https://x.com/i/status/${post.tweet_id}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center justify-center w-8 h-8 bg-primary/5 text-primary rounded-xl hover:bg-primary hover:text-white transition-all transform group-hover:scale-110"
                                                >
                                                    <ArrowUpRight size={14} />
                                                </a>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {sentPosts.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-20 text-center opacity-30 text-[10px] font-black uppercase tracking-widest italic">
                                            Esperando datos de publicaciones enviadas...
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </div>
            {/* Debug Screenshot Modal */}

        </motion.div>
    );
};
