import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Search, ArrowUpRight, Calendar, Eye, Heart, Repeat, Bookmark, MessageCircle, Trash2 } from 'lucide-react';
import type { Post } from '../types';

interface ScrapedDataViewProps {
    posts: Post[];
    isQuarantine?: boolean;
    onRestore?: (id: number) => void;
    onDelete?: (id: number) => void;
}

export const ScrapedDataView: React.FC<ScrapedDataViewProps> = ({ posts, isQuarantine, onRestore, onDelete }) => {
    // ... (existing state) ...
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Post, direction: 'asc' | 'desc' } | null>({ key: 'created_at', direction: 'desc' });

    // Filter only posts that have a tweet_id (meaning they are from X)
    const scrapedPosts = useMemo(() => {
        return posts.filter(p => p.tweet_id);
    }, [posts]);

    const filteredAndSortedPosts = useMemo(() => {
        let result = [...scrapedPosts];

        // Search filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(p =>
                p.content.toLowerCase().includes(lowerTerm) ||
                p.tweet_id?.toLowerCase().includes(lowerTerm) ||
                p.username?.toLowerCase().includes(lowerTerm)
            );
        }

        // Sorting
        if (sortConfig) {
            result.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue === bValue) return 0;
                if (aValue === undefined || aValue === null) return 1;
                if (bValue === undefined || bValue === null) return -1;

                if (sortConfig.direction === 'asc') {
                    return aValue < bValue ? -1 : 1;
                } else {
                    return aValue > bValue ? -1 : 1;
                }
            });
        }

        return result;
    }, [scrapedPosts, searchTerm, sortConfig]);

    // ... (sorting handlers) ...
    const handleSort = (key: keyof Post) => {
        setSortConfig(current => {
            if (current?.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className={`text-3xl font-black tracking-tight flex items-center gap-3 ${isQuarantine ? "text-amber-500" : ""}`}>
                        {isQuarantine ? <Database className="text-amber-500" size={28} /> : <Database className="text-primary" size={28} />}
                        {isQuarantine ? "Zona de Cuarentena" : "Datos Scrapeados"}
                    </h2>
                    <p className="text-muted-foreground text-sm font-medium mt-1">
                        {isQuarantine
                            ? "Posts marcados como sospechosos (contenido vacío, fechas erróneas). Revisa y decide."
                            : "Consulta directa a la base de datos de posts sincronizados desde X."}
                    </p>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por contenido o ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-white/60 dark:bg-white/5 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 w-full md:w-64 transition-all"
                    />
                </div>
            </div>

            <div className={`bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl rounded-[2.5rem] border ${isQuarantine ? 'border-amber-500/30' : 'border-white/60 dark:border-white/10'} shadow-xl overflow-hidden`}>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border/10 bg-white/40 dark:bg-white/5">
                                <th
                                    className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('created_at')}
                                >
                                    <div className="flex items-center gap-2">
                                        Fecha
                                        <Calendar size={12} />
                                    </div>
                                </th>
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Tweet ID</th>
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-1/3">Contenido / Razón</th>
                                {!isQuarantine && (
                                    <>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center" onClick={() => handleSort('views_count')}>
                                            <div className="flex items-center justify-center gap-2">
                                                Vistas
                                                <Eye size={12} />
                                            </div>
                                        </th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center" onClick={() => handleSort('likes_count')}>
                                            <div className="flex items-center justify-center gap-2">
                                                Likes
                                                <Heart size={12} />
                                            </div>
                                        </th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Interacciones</th>
                                    </>
                                )}
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">
                                    {isQuarantine ? "Acciones" : "Link"}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/10">
                            {filteredAndSortedPosts.length > 0 ? (
                                filteredAndSortedPosts.map((post) => (
                                    <tr key={post.id || post.tweet_id} className="group hover:bg-primary/5 transition-colors">
                                        <td className="p-6">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold font-mono">
                                                    {post.created_at ? new Date(post.created_at).toLocaleDateString() : '-'}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {post.created_at ? new Date(post.created_at).toLocaleTimeString() : '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <span className="text-[10px] font-mono text-muted-foreground bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">
                                                {post.tweet_id}
                                            </span>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-col gap-1">
                                                <p className="text-sm font-medium line-clamp-2 text-foreground/90 leading-relaxed">
                                                    {post.content || "(Sin contenido)"}
                                                </p>
                                                {isQuarantine && post.logs && (
                                                    <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded w-fit">
                                                        {post.logs.split('[Sync] Quarantined:').pop()?.trim() || "Sospechoso"}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {!isQuarantine && (
                                            <>
                                                <td className="p-6 text-center">
                                                    <span className="text-sm font-black tabular-nums text-foreground/80">{post.views_count?.toLocaleString() || 0}</span>
                                                </td>
                                                <td className="p-6 text-center">
                                                    <span className="text-sm font-black tabular-nums text-rose-500">{post.likes_count?.toLocaleString() || 0}</span>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex justify-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <div className="flex items-center gap-1" title="Reposts">
                                                            <Repeat size={12} />
                                                            <span className="text-xs font-bold tabular-nums">{post.reposts_count || 0}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1" title="Respuestas">
                                                            <MessageCircle size={12} />
                                                            <span className="text-xs font-bold tabular-nums">{post.replies_count || 0}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1" title="Guardados">
                                                            <Bookmark size={12} />
                                                            <span className="text-xs font-bold tabular-nums">{post.bookmarks_count || 0}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                        <td className="p-6 text-right">
                                            {isQuarantine ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => onRestore && post.id && onRestore(post.id)}
                                                        className="px-3 py-1.5 bg-green-500/10 text-green-600 hover:bg-green-500 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
                                                    >
                                                        Restaurar
                                                    </button>
                                                    <button
                                                        onClick={() => onDelete && post.id && onDelete(post.id)}
                                                        className="px-3 py-1.5 bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-2">
                                                    {onDelete && (
                                                        <button
                                                            onClick={() => post.id && onDelete(post.id)}
                                                            className="p-3 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 rounded-xl transition-all"
                                                            title="Eliminar post"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                    <a
                                                        href={`https://x.com/i/status/${post.tweet_id}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-white/5 border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/50 transition-all active:scale-95 shadow-sm"
                                                    >
                                                        <ArrowUpRight size={16} />
                                                    </a>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-50">
                                            <Database size={48} strokeWidth={1} />
                                            <p className="text-sm font-bold uppercase tracking-widest">No se encontraron datos</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t border-border/10 bg-white/20 dark:bg-white/5 flex justify-end">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Total Registros: {filteredAndSortedPosts.length}
                    </span>
                </div>
            </div>
        </motion.div>
    );
};
