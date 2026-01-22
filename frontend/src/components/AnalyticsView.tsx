import React from 'react';
import { Eye, Heart, Repeat, TrendingUp, ArrowUpRight } from 'lucide-react';
import type { Post } from '../types';

interface AnalyticsViewProps {
    posts: Post[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ posts }) => {
    const sentPosts = posts.filter(p => p.status === 'sent' && p.tweet_id);

    const totalViews = sentPosts.reduce((acc, p) => acc + (p.views_count || 0), 0);
    const totalLikes = sentPosts.reduce((acc, p) => acc + (p.likes_count || 0), 0);
    const totalReposts = sentPosts.reduce((acc, p) => acc + (p.reposts_count || 0), 0);

    const averageEngagement = sentPosts.length > 0
        ? ((totalLikes + totalReposts) / sentPosts.length).toFixed(1)
        : '0.0';

    return (
        <div className="space-y-10 animate-fade-in">
            {/* Header Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-8 rounded-[2.5rem] bg-white/60 dark:bg-white/5 border border-border/50 hover-lift group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Eye size={48} />
                    </div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Alcance Total</p>
                    <div className="flex items-end gap-3">
                        <span className="text-4xl font-black tracking-tighter tabular-nums">{totalViews.toLocaleString()}</span>
                    </div>
                </div>

                <div className="p-8 rounded-[2.5rem] bg-white/60 dark:bg-white/5 border border-border/50 hover-lift group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Heart size={48} />
                    </div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Likes Totales</p>
                    <div className="flex items-end gap-3">
                        <span className="text-4xl font-black tracking-tighter tabular-nums">{totalLikes.toLocaleString()}</span>
                    </div>
                </div>

                <div className="p-8 rounded-[2.5rem] bg-white/60 dark:bg-white/5 border border-border/50 hover-lift group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Repeat size={48} />
                    </div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Reposts</p>
                    <div className="flex items-end gap-3">
                        <span className="text-4xl font-black tracking-tighter tabular-nums">{totalReposts.toLocaleString()}</span>
                    </div>
                </div>

                <div className="p-8 rounded-[2.5rem] bg-primary/10 dark:bg-primary/20 border border-primary/20 hover-lift group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp size={48} className="text-primary" />
                    </div>
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Engagement Avg</p>
                    <div className="flex items-end gap-3">
                        <span className="text-4xl font-black tracking-tighter tabular-nums text-primary">{averageEngagement}</span>
                        <span className="text-[10px] font-bold text-primary/60 mb-1">per post</span>
                    </div>
                </div>
            </div>

            {/* Top Posts List */}
            <div className="bg-white/60 dark:bg-gray-900/80 p-10 rounded-[3.5rem] border border-white/80 dark:border-white/10 backdrop-blur-3xl shadow-2xl">
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <div className="w-2 h-8 bg-primary rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                        <h3 className="text-2xl font-black tracking-tight">Publicaciones con Mayor Impacto</h3>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border/40">
                                <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4 text-center">Contenido</th>
                                <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4 text-center">Vistas</th>
                                <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4 text-center">Likes</th>
                                <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4 text-center">Reposts</th>
                                <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {sentPosts.sort((a, b) => (b.views_count || 0) - (a.views_count || 0)).slice(0, 5).map(post => (
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
                                            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:text-indigo-400 transition-colors"
                                        >
                                            Ver en X <ArrowUpRight size={14} />
                                        </a>
                                    </td>
                                </tr>
                            ))}
                            {sentPosts.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center opacity-30 text-xs font-black uppercase tracking-widest">
                                        No hay datos suficientes para mostrar analíticas aún.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
