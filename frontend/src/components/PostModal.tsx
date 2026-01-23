import React, { useState, useEffect, useMemo } from 'react';
import type { Post } from '../types';
import { X, Upload, Calendar as CalendarIcon, Trash2, Zap } from 'lucide-react';
import { api, BASE_URL } from '../api';
import { utcToLocal, localToUTC } from '../utils/timezone';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface PostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (post: Post) => void;
    post?: Post | null;
    initialDate?: Date;
    posts: Post[];
    accounts: { username: string; connected: boolean }[];
}

export const PostModal: React.FC<PostModalProps> = ({ isOpen, onClose, onSave, post, initialDate, posts, accounts }) => {
    const [content, setContent] = useState('');
    const [mediaPaths, setMediaPaths] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [parentId, setParentId] = useState<number | undefined>(undefined);
    const [username, setUsername] = useState<string>('');
    const [uploading, setUploading] = useState(false);

    // Get thread sequence
    const threadSequence = useMemo(() => {
        if (!parentId && !post?.id) return [];
        const sequence: Post[] = [];
        let currentId = parentId || post?.parent_id;
        while (currentId) {
            const p = posts.find(item => item.id === currentId);
            if (p && !sequence.find(item => item.id === p.id)) {
                sequence.unshift(p);
                currentId = p.parent_id;
            } else break;
        }
        return sequence;
    }, [parentId, post?.parent_id, posts]);

    useEffect(() => {
        if (post) {
            setContent(post.content);
            setMediaPaths(post.media_paths || '');
            setParentId(post.parent_id || undefined);
            setUsername(post.username || (accounts[0]?.username || ''));

            if (post.scheduled_at) {
                setScheduledAt(utcToLocal(post.scheduled_at));
            } else {
                setScheduledAt('');
            }
        } else {
            setContent('');
            setMediaPaths('');
            setParentId(undefined);
            setUsername(accounts[0]?.username || '');

            const date = initialDate || new Date();
            if (!initialDate) date.setMinutes(date.getMinutes() + 60);
            setScheduledAt(utcToLocal(date.toISOString()).slice(0, 16));
        }
    }, [post, initialDate, accounts, isOpen]);

    if (!isOpen) return null;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setUploading(true);
            try {
                const result = await api.uploadImage(file);
                const currentPaths = mediaPaths ? mediaPaths.split(',') : [];

                if (currentPaths.length >= 4 && (file.type.startsWith('image/'))) {
                    alert("Maximum 4 images allowed.");
                    return;
                }
                if (file.type.startsWith('video/') && currentPaths.length > 0) {
                    alert("Videos must be posted alone.");
                    return;
                }

                setMediaPaths([...currentPaths, result.filepath].join(','));
            } catch (error) {
                console.error("Upload failed", error);
            } finally {
                setUploading(false);
            }
        }
    };

    const handleSubmit = (e?: React.FormEvent, isImmediate = false) => {
        if (e) e.preventDefault();
        onSave({
            ...post,
            content,
            media_paths: mediaPaths || undefined,
            scheduled_at: scheduledAt ? localToUTC(scheduledAt) : undefined,
            status: isImmediate ? 'immediate' : (scheduledAt ? 'scheduled' : 'draft'),
            parent_id: parentId || undefined,
            username: username || undefined
        } as Post);
    };

    const handleDelete = async () => {
        if (post?.id && confirm('¿Estás seguro de que quieres eliminar esta publicación?')) {
            try {
                await api.deletePost(post.id);
                onSave({ ...post, status: 'deleted' } as Post);
                onClose();
            } catch (error) {
                console.error('Failed to delete post', error);
            }
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className={cn(
                            "relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border border-white/60 dark:border-white/10 flex flex-col max-h-[90vh]",
                            uploading && "opacity-80 pointer-events-none"
                        )}
                    >
                        {/* Header */}
                        <div className="p-8 border-b border-border/40 bg-slate-50/50 dark:bg-white/5 flex justify-between items-center">
                            <div>
                                <h2 className="text-3xl font-black text-foreground tracking-tight">
                                    {post ? 'Editar' : 'Nueva'} Publicación
                                </h2>
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mt-1">X Command Center</p>
                            </div>
                            <button onClick={onClose} className="p-3 hover:bg-slate-200 dark:hover:bg-white/10 rounded-2xl transition-all text-muted-foreground">
                                <X size={20} className="stroke-[3px]" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
                            {/* Thread sequence */}
                            {threadSequence.length > 0 && (
                                <div className="bg-primary/5 dark:bg-primary/10 rounded-[2rem] p-6 border border-primary/20 shadow-inner">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-5">Secuencia del Hilo</p>
                                    <div className="space-y-4 relative">
                                        <div className="absolute left-[13px] top-2 bottom-2 w-[2px] bg-primary/20" />
                                        {threadSequence.map((p, idx) => (
                                            <div key={p.id} className="relative pl-10">
                                                <div className="absolute left-0 top-0 w-7 h-7 rounded-lg bg-background border-2 border-primary z-10 flex items-center justify-center shadow-lg shadow-primary/20">
                                                    <span className="text-[10px] font-black text-primary">{idx + 1}</span>
                                                </div>
                                                <p className="text-xs text-foreground/70 font-bold line-clamp-1">{p.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Cuenta</label>
                                    <select
                                        className="w-full px-5 py-4 border border-border/60 rounded-2xl bg-background text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none cursor-pointer"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                    >
                                        <option value="" disabled>Seleccionar</option>
                                        {accounts.map(acc => (
                                            <option key={acc.username} value={acc.username}>@{acc.username}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Padre (Hilo)</label>
                                    <select
                                        className="w-full px-5 py-4 border border-border/60 rounded-2xl bg-background text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none cursor-pointer"
                                        value={parentId || ''}
                                        onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : undefined)}
                                    >
                                        <option value="">Independiente</option>
                                        {posts.filter(p => p.id !== post?.id).slice(0, 10).map(p => (
                                            <option key={p.id} value={p.id}>{p.content.substring(0, 30)}...</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Contenido</label>
                                <div className="relative group">
                                    <textarea
                                        className="w-full p-6 border border-border/60 rounded-[2rem] bg-background focus:border-primary outline-none resize-none h-48 transition-all font-bold text-base leading-relaxed"
                                        placeholder="¿Qué está pasando?"
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        maxLength={280}
                                        required
                                    />
                                    <div className={cn(
                                        "absolute bottom-5 right-6 text-[10px] font-black px-3 py-1.5 rounded-xl border-2 transition-all",
                                        content.length > 250 ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-primary/10 text-primary border-primary/20"
                                    )}>
                                        {content.length} / 280
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Multimedia</label>
                                <div className="flex flex-wrap gap-4">
                                    <label className="w-24 h-24 flex flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-border/60 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group">
                                        <Upload size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                        <span className="text-[8px] font-black uppercase mt-1 text-muted-foreground group-hover:text-primary transition-colors">Subir</span>
                                        <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
                                    </label>

                                    {mediaPaths.split(',').filter(Boolean).map((path, idx) => {
                                        const filename = path.split(/[\\/]/).pop();
                                        return (
                                            <div key={idx} className="relative group w-24 h-24">
                                                <img src={`${BASE_URL}/uploads/${filename}`} className="w-full h-full object-cover rounded-[1.5rem] border-2 border-border/50" alt="" />
                                                <button
                                                    type="button"
                                                    onClick={() => setMediaPaths(mediaPaths.split(',').filter((_, i) => i !== idx).join(','))}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <CalendarIcon size={14} className="text-primary" /> Programación
                                </label>
                                <input
                                    type="datetime-local"
                                    className="w-full px-5 py-4 bg-slate-100 dark:bg-white/5 border-none rounded-2xl outline-none font-black text-sm"
                                    value={scheduledAt}
                                    onChange={(e) => setScheduledAt(e.target.value)}
                                />
                            </div>
                        </form>

                        {/* Footer */}
                        <div className="p-8 bg-slate-50/50 dark:bg-black/20 border-t border-border/40 flex justify-between items-center">
                            {post && (
                                <button type="button" onClick={handleDelete} className="flex items-center gap-2 text-red-500 font-black text-[10px] uppercase tracking-widest hover:bg-red-500/10 px-4 py-3 rounded-xl transition-all">
                                    <Trash2 size={16} /> Eliminar
                                </button>
                            )}
                            <div className="flex gap-4 ml-auto">
                                <button type="button" onClick={onClose} className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all">
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSubmit(undefined, true)}
                                    className="px-8 py-4 bg-emerald-500/10 text-emerald-600 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-2"
                                >
                                    <Zap size={14} className="fill-current" />
                                    Publicar ahora
                                </button>
                                <button type="submit" onClick={(e) => handleSubmit(e, false)} className="px-10 py-4 bg-primary text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.05] active:scale-[0.95] transition-all bg-gradient-to-r from-primary to-indigo-600">
                                    {post ? 'Actualizar' : (scheduledAt ? 'Programar' : 'Guardar Borrador')}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
