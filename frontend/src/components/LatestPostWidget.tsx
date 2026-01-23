import React from 'react';
import { motion } from 'framer-motion';
import { Eye, Heart, BarChart3, ArrowUpRight, Share2, Clock, CheckCircle2 } from 'lucide-react';
import type { Post } from '../types';
import { BASE_URL } from '../api';
import { cn } from '../lib/utils';

interface LatestPostWidgetProps {
    post: Post | null;
    isLoading: boolean;
}

export const LatestPostWidget: React.FC<LatestPostWidgetProps> = ({ post, isLoading }) => {
    if (isLoading) {
        return (
            <div className="w-full h-80 rounded-[3rem] bg-slate-100 dark:bg-white/5 animate-pulse flex items-center justify-center">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-20">Sincronizando último post...</p>
            </div>
        );
    }

    if (!post) {
        return (
            <div className="w-full p-12 rounded-[3rem] bg-slate-100 dark:bg-white/5 border-2 border-dashed border-border/50 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-200 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                    <BarChart3 className="opacity-20" size={32} />
                </div>
                <h4 className="text-sm font-black uppercase tracking-widest opacity-40">No hay publicaciones recientes</h4>
                <p className="text-[10px] text-muted-foreground mt-2 font-bold italic">Envía tu primer post para ver estadísticas aquí.</p>
            </div>
        );
    }

    const er = post.views_count && post.views_count > 0
        ? (((post.likes_count || 0) + (post.reposts_count || 0)) / post.views_count * 100).toFixed(1)
        : '0.0';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative w-full overflow-hidden"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-indigo-500/5 dark:from-primary/20 dark:to-indigo-500/10 -z-10" />

            <div className="p-10 md:p-12 rounded-[3.5rem] bg-white/60 dark:bg-slate-900/60 border border-white dark:border-white/10 backdrop-blur-3xl shadow-2xl shadow-primary/5 flex flex-col lg:flex-row gap-12">

                {/* Visual Content Section */}
                <div className="w-full lg:w-2/5 flex flex-col gap-6">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-6 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(34,197,94,0.4)]" />
                            <h3 className="text-xl font-black tracking-tight">Último Post</h3>
                        </div>
                        <div className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-emerald-500/20 flex items-center gap-1.5">
                            <CheckCircle2 size={12} /> Publicado
                        </div>
                    </div>

                    <div className="relative aspect-video lg:aspect-square w-full rounded-[2.5rem] overflow-hidden bg-slate-100 dark:bg-slate-800 border border-border/40 shadow-inner group/media">
                        {post.media_paths ? (
                            <img
                                src={`${BASE_URL}/uploads/${post.media_paths.split(',')[0].split(/[\\/]/).pop()}`}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover/media:scale-110"
                                alt=""
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                                <p className="text-lg font-bold text-foreground/80 leading-relaxed italic text-center line-clamp-6">
                                    "{post.content}"
                                </p>
                            </div>
                        )}

                        <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/media:opacity-100 transition-opacity">
                            <a
                                href={`https://x.com/i/status/${post.tweet_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full py-3 bg-white text-black rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-colors"
                            >
                                <ArrowUpRight size={14} /> Ver en X.com
                            </a>
                        </div>
                    </div>
                </div>

                {/* Info & Metrics Section */}
                <div className="w-full lg:w-3/5 flex flex-col">
                    <div className="flex items-center gap-3 mb-8 opacity-60">
                        <Clock size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            {post.updated_at
                                ? `Publicado el ${new Date(post.updated_at).toLocaleDateString()} a las ${new Date(post.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : 'Fecha de publicación no disponible'}
                        </span>
                    </div>

                    <div className="flex-1 mb-10">
                        <p className="text-xl md:text-2xl font-bold leading-tight text-foreground/90 group-hover:text-foreground transition-colors">
                            {post.content}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-auto">
                        {[
                            { label: 'Vistas', val: post.views_count || 0, icon: Eye, color: 'text-slate-500', bg: 'bg-slate-500/5' },
                            { label: 'Likes', val: post.likes_count || 0, icon: Heart, color: 'text-rose-500', bg: 'bg-rose-500/5' },
                            { label: 'Reposts', val: post.reposts_count || 0, icon: Share2, color: 'text-emerald-500', bg: 'bg-emerald-500/5' },
                            { label: 'Ratio', val: `${er}%`, icon: TrendingUpIcon, color: 'text-primary', bg: 'bg-primary/5' },
                        ].map((metric, i) => (
                            <div key={i} className={cn("p-5 rounded-[1.5rem] border border-border/40 hover-lift flex flex-col gap-2 transition-all group/metric", metric.bg)}>
                                <div className="flex items-center justify-between">
                                    <metric.icon size={14} className={cn("opacity-60 group-hover/metric:scale-110 transition-transform", metric.color)} />
                                </div>
                                <div>
                                    <span className={cn("text-xl font-black tracking-tighter tabular-nums", metric.color)}>
                                        {typeof metric.val === 'number' ? metric.val.toLocaleString() : metric.val}
                                    </span>
                                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mt-1">{metric.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const TrendingUpIcon = ({ size, className }: { size: number, className: string }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
    </svg>
);
