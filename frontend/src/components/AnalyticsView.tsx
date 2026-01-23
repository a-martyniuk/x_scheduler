import React from 'react';
import { Eye, Heart, Repeat, TrendingUp, ArrowUpRight, Clock, Zap, Info } from 'lucide-react';
import type { Post } from '../types';
import { motion } from 'framer-motion';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { useAnalytics } from '../hooks/useAnalytics';
import { cn } from '../lib/utils';

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
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ posts, globalStats }) => {
    const { growthData, bestTimes } = useAnalytics();
    const sentPosts = posts.filter(p => p.status === 'sent' && p.tweet_id);

    const totalViews = globalStats?.views || sentPosts.reduce((acc, p) => acc + (p.views_count || 0), 0);
    const totalLikes = globalStats?.likes || sentPosts.reduce((acc, p) => acc + (p.likes_count || 0), 0);
    const totalReposts = globalStats?.reposts || sentPosts.reduce((acc, p) => acc + (p.reposts_count || 0), 0);

    const totalSent = globalStats?.sent || sentPosts.length;
    const averageEngagement = totalSent > 0
        ? ((totalLikes + totalReposts) / totalSent).toFixed(1)
        : '0.0';

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
            className="space-y-10"
        >
            {/* Header Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Alcance Total', val: totalViews, icon: Eye, color: 'text-slate-500' },
                    { label: 'Likes Totales', val: totalLikes, icon: Heart, color: 'text-rose-500' },
                    { label: 'Reposts', val: totalReposts, icon: Repeat, color: 'text-emerald-500' },
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
                            {stat.suffix && <span className="text-[10px] font-bold opacity-60 mb-1">{stat.suffix}</span>}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Charts & Insights Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Growth Chart */}
                <motion.div
                    variants={item}
                    className="lg:col-span-2 bg-white/60 dark:bg-gray-900/80 p-8 rounded-[3rem] border border-white/80 dark:border-white/10 shadow-xl"
                >
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-1.5 h-6 bg-primary rounded-full" />
                        <h3 className="text-xl font-black tracking-tight">Tendencia de Crecimiento</h3>
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
                                />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '20px',
                                        border: 'none',
                                        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                                        backgroundColor: 'rgba(255,255,255,0.9)',
                                        color: '#000'
                                    }}
                                    itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="engagement"
                                    stroke="#6366F1"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorViews)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Best Times Insights */}
                <motion.div
                    variants={item}
                    className="bg-primary/5 dark:bg-primary/10 p-8 rounded-[3rem] border border-primary/20 shadow-xl flex flex-col"
                >
                    <div className="flex items-center gap-4 mb-8">
                        <Zap className="text-primary fill-primary/20" size={24} />
                        <h3 className="text-xl font-black tracking-tight">Insights Pro</h3>
                    </div>

                    <div className="space-y-6 flex-1">
                        <div>
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <Clock size={12} /> Mejores Horarios
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {bestTimes.best_hours.map((hour: number) => (
                                    <div key={hour} className="bg-white/80 dark:bg-white/5 p-4 rounded-2xl border border-white/20 text-center">
                                        <span className="text-lg font-black tracking-tighter">{hour}:00</span>
                                        <p className="text-[8px] font-bold opacity-60 uppercase">Alta Probabilidad</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl bg-primary/10 border border-primary/10">
                            <div className="flex gap-3 mb-2">
                                <Info className="text-primary shrink-0" size={16} />
                                <p className="text-[10px] font-bold leading-relaxed">
                                    Basado en el análisis de {bestTimes.total_posts_analyzed || 0} publicaciones previas.
                                </p>
                            </div>
                        </div>
                    </div>

                    <p className="text-[9px] font-bold text-muted-foreground mt-8 italic text-center">
                        Sugerencias optimizadas para tu audiencia actual en X.
                    </p>
                </motion.div>
            </div>

            {/* Top Posts List */}
            <motion.div
                variants={item}
                className="bg-white/60 dark:bg-gray-900/80 p-10 rounded-[3.5rem] border border-white/80 dark:border-white/10 backdrop-blur-3xl shadow-2xl"
            >
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <div className="w-2 h-8 bg-primary rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                        <h3 className="text-2xl font-black tracking-tight">Impacto de Contenido</h3>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border/40">
                                <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4">Contenido</th>
                                <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4 text-center">Vistas</th>
                                <th className="pb-6 text-[10px) font-black uppercase tracking-[0.2em] text-muted-foreground px-4 text-center">Likes</th>
                                <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4 text-center">Reposts</th>
                                <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4 text-center">X</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {sentPosts.sort((a, b) => (b.views_count || 0) - (a.views_count || 0)).slice(0, 10).map(post => (
                                <tr key={post.id} className="group hover:bg-white/5 transition-colors">
                                    <td className="py-6 px-4">
                                        <p className="text-sm font-bold line-clamp-1 max-w-md">{post.content}</p>
                                        <span className="text-[9px] font-black text-muted-foreground/60 uppercase">{new Date(post.updated_at!).toLocaleDateString()}</span>
                                    </td>
                                    <td className="py-6 px-4 text-center">
                                        <span className="text-sm font-black tabular-nums">{post.views_count?.toLocaleString() || 0}</span>
                                    </td>
                                    <td className="py-6 px-4 text-center">
                                        <span className="text-sm font-black text-rose-500 tabular-nums">{post.likes_count?.toLocaleString() || 0}</span>
                                    </td>
                                    <td className="py-6 px-4 text-center">
                                        <span className="text-sm font-black text-emerald-500 tabular-nums">{post.reposts_count?.toLocaleString() || 0}</span>
                                    </td>
                                    <td className="py-6 px-4 text-center">
                                        <a
                                            href={`https://x.com/i/status/${post.tweet_id}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center justify-center p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all"
                                        >
                                            <ArrowUpRight size={16} />
                                        </a>
                                    </td>
                                </tr>
                            ))}
                            {sentPosts.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center opacity-30 text-xs font-black uppercase tracking-widest italic">
                                        Esperando datos de publicaciones enviadas...
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </motion.div>
    );
};
