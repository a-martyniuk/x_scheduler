import React from 'react';
import { Eye, Heart, TrendingUp, ArrowUpRight, Clock, Zap, Info, BarChart2, Layers, RefreshCcw } from 'lucide-react';
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
    onSync?: () => Promise<{ imported: number; log: string }>;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ posts, globalStats, onSync }) => {
    const { growthData, bestTimes, performanceData, latestPost, isLoadingLatestPost } = useAnalytics();
    const [isSyncing, setIsSyncing] = React.useState(false);

    const handleSync = async () => {
        if (!onSync) return;
        setIsSyncing(true);
        try {
            const result = await onSync();
            alert(`Sincronización completada.\nPosts importados: ${result.imported}\nDetalles:\n${result.log}`);
        } catch (error: any) {
            alert(`Error al sincronizar: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    };
    const sentPosts = posts.filter(p => p.status === 'sent' && p.tweet_id);

    const totalViews = globalStats?.views || sentPosts.reduce((acc, p) => acc + (p.views_count || 0), 0);
    const totalLikes = globalStats?.likes || sentPosts.reduce((acc, p) => acc + (p.likes_count || 0), 0);
    const totalReposts = globalStats?.reposts || sentPosts.reduce((acc, p) => acc + (p.reposts_count || 0), 0);

    const totalSent = globalStats?.sent || sentPosts.length;
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

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-12"
        >
            {/* Latest Post Widget (Hero Section) */}
            <motion.div variants={item}>
                <LatestPostWidget post={latestPost} isLoading={isLoadingLatestPost} />
            </motion.div>

            {/* Header Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Alcance Total', val: totalViews, icon: Eye, color: 'text-slate-500' },
                    { label: 'Likes Totales', val: totalLikes, icon: Heart, color: 'text-rose-500' },
                    { label: 'Volumen de Posts', val: totalSent, icon: Layers, color: 'text-emerald-500', suffix: 'posts enviados' },
                    { label: 'Engagement Avg', val: averageEngagement, icon: TrendingUp, color: 'text-primary', suffix: 'per post' },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        variants={item}
                        className="p-8 rounded-[2.5rem] bg-white/60 dark:bg-white/5 border border-border/50 hover-lift group relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <stat.icon size={48} className={stat.color} />
                        </div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">{stat.label}</p>
                        <div className="flex items-end gap-3">
                            <span className={cn("text-4xl font-black tracking-tighter tabular-nums", stat.color)}>
                                {typeof stat.val === 'number' ? stat.val.toLocaleString() : stat.val}
                            </span>
                            {stat.suffix && <span className="text-[10px] font-bold opacity-60 mb-1 leading-tight ml-1">{stat.suffix}</span>}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Main Charts area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Growth & Volume Chart */}
                <motion.div
                    variants={item}
                    className="lg:col-span-2 bg-white/60 dark:bg-gray-900/80 p-8 rounded-[3rem] border border-white/80 dark:border-white/10 shadow-xl"
                >
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-1.5 h-6 bg-primary rounded-full" />
                            <h3 className="text-xl font-black tracking-tight">Tendencia y Actividad</h3>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-primary" />
                                <span className="text-[10px] font-bold opacity-60">Engagement</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500/30" />
                                <span className="text-[10px] font-bold opacity-60">Volumen</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={growthData}>
                                <defs>
                                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 700 }}
                                    dy={10}
                                    tickFormatter={(str) => {
                                        const date = new Date(str);
                                        return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
                                    }}
                                />
                                <YAxis hide yAxisId="left" />
                                <YAxis hide yAxisId="right" orientation="right" />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '20px',
                                        border: 'none',
                                        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                                        backgroundColor: 'rgba(255,255,255,0.95)',
                                        color: '#000'
                                    }}
                                    itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                                />
                                <Area
                                    yAxisId="right"
                                    type="stepAfter"
                                    dataKey="posts"
                                    stroke="transparent"
                                    fill="#10b981"
                                    fillOpacity={0.1}
                                    name="Posts x Día"
                                />
                                <Area
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="engagement"
                                    stroke="#6366F1"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorViews)"
                                    name="Engagement"
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
                        {onSync && (
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className={cn(
                                    "px-4 py-2 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest border border-primary/20 hover:bg-primary hover:text-white transition-all flex items-center gap-2",
                                    isSyncing && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <RefreshCcw size={12} className={isSyncing ? "animate-spin" : ""} />
                                {isSyncing ? 'Sincronizando...' : 'Sincronizar Historial'}
                            </button>
                        )}
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
                                        <tr key={post.id} className="group hover:bg-primary/5 transition-colors">
                                            <td className="py-5 px-4">
                                                <p className="text-sm font-bold line-clamp-1 max-w-sm mb-1">{post.content}</p>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[8px] font-black text-muted-foreground/50 uppercase">{new Date(post.updated_at!).toLocaleDateString()}</span>
                                                    {post.media_paths && <span className="text-[8px] font-black text-primary uppercase bg-primary/10 px-1.5 rounded-sm">Media</span>}
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
        </motion.div>
    );
};
