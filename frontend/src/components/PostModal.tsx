import React, { useState, useEffect } from 'react';
import type { Post } from '../types';
import { X, Upload, Calendar as CalendarIcon, Eye, Heart, Repeat } from 'lucide-react';
import { api } from '../api';
import { utcToLocal, localToUTC } from '../utils/timezone';

interface PostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (post: Post) => void;
    post?: Post | null;
    initialDate?: Date;
    posts: Post[];
    userTimezone: string;
    accounts: { username: string; connected: boolean }[];
}

export const PostModal: React.FC<PostModalProps> = ({ isOpen, onClose, onSave, post, initialDate, posts, userTimezone, accounts }) => {
    const [content, setContent] = useState('');
    const [mediaPaths, setMediaPaths] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [parentId, setParentId] = useState<number | undefined>(undefined);
    const [username, setUsername] = useState<string>('');

    const [uploading, setUploading] = useState(false);

    // Get thread sequence
    const getThreadSequence = () => {
        if (!parentId && !post?.id) return [];

        const sequence: Post[] = [];
        let currentId = parentId || post?.parent_id;

        // Traverse up
        while (currentId) {
            const p = posts.find(item => item.id === currentId);
            if (p && !sequence.find(item => item.id === p.id)) {
                sequence.unshift(p);
                currentId = p.parent_id;
            } else break;
        }

        return sequence;
    };

    const threadSequence = getThreadSequence();

    useEffect(() => {
        if (post) {
            setContent(post.content);
            setMediaPaths(post.media_paths || '');
            setParentId(post.parent_id || undefined);
            setUsername(post.username || (accounts[0]?.username || ''));

            // Convert UTC from backend to local time for display
            if (post.scheduled_at) {
                const localTime = utcToLocal(post.scheduled_at);
                setScheduledAt(localTime);
            } else {
                setScheduledAt('');
            }
        } else {
            setContent('');
            setMediaPaths('');
            setParentId(undefined);
            setUsername(accounts[0]?.username || '');

            // For new posts, default to 1 hour from now in local time
            const date = initialDate || new Date();
            date.setMinutes(date.getMinutes() + 60);
            const localTime = utcToLocal(date.toISOString());
            setScheduledAt(localTime);
        }
    }, [post, initialDate, isOpen, userTimezone, accounts]);


    if (!isOpen) return null;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setUploading(true);
            try {
                const result = await api.uploadImage(file);
                // Append if multiple, for now let's just allow appending comma separated
                const currentPaths = mediaPaths ? mediaPaths.split(',') : [];
                if (currentPaths.length >= 4 && (file.type.startsWith('image/'))) {
                    alert("Maximum 4 images allowed.");
                    return;
                }
                if (file.type.startsWith('video/') && currentPaths.length > 0) {
                    alert("Videos must be posted alone.");
                    return;
                }

                const newPaths = [...currentPaths, result.filepath].join(',');
                setMediaPaths(newPaths);
            } catch (error) {
                console.error("Upload failed", error);
                alert("Upload failed");
            } finally {
                setUploading(false);
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Convert Local Time input to UTC ISO string for backend
        let utcDateString = null;
        let newStatus = 'draft';

        if (scheduledAt) {
            // Convert from local time to UTC
            utcDateString = localToUTC(scheduledAt);
            newStatus = 'scheduled';
        }

        onSave({
            ...post,
            content,
            media_paths: mediaPaths || undefined,
            scheduled_at: utcDateString,
            status: newStatus,
            parent_id: parentId || undefined,
            username: username || undefined
        } as Post);
        onClose();
    };
    const handleDelete = async () => {
        if (post && post.id && confirm('Are you sure you want to cancel this post?')) {
            try {
                await api.deletePost(post.id);
                onSave({ ...post, status: 'deleted' } as Post);
                onClose();
            } catch (error) {
                console.error('Failed to delete post', error);
                alert('Failed to delete post');
            }
        }
    };

    return (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 p-4 transition-all duration-500 overflow-visible">
            <div className={`bg-white dark:bg-slate-900 rounded-[3rem] shadow-[0_25px_80px_rgba(0,0,0,0.15)] w-full max-w-xl overflow-hidden border border-white/60 dark:border-white/10 transition-all duration-500 ${uploading ? 'opacity-75 scale-95' : 'scale-100'} animate-slide-up relative z-[60]`}>
                <div className="flex justify-between items-center p-8 border-b border-border/40 bg-slate-50/50 dark:bg-white/5">
                    <div>
                        <h2 className="text-3xl font-black text-foreground tracking-tight">
                            {post ? 'Editar Publicación' : 'Nueva Publicación'}
                        </h2>
                        <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mt-1">X Command Center</h3>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-200 dark:hover:bg-white/10 rounded-2xl transition-all text-muted-foreground hover:text-foreground active:scale-90">
                        <X size={20} className="stroke-[3px]" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {/* Thread Context Timeline */}
                    {threadSequence.length > 0 && (
                        <div className="bg-primary/5 dark:bg-primary/10 rounded-[2rem] p-6 border border-primary/20 mb-2 shadow-inner">
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-5 px-1">Secuencia del Hilo</p>
                            <div className="space-y-0 relative">
                                <div className="absolute left-[13px] top-2 bottom-4 w-[2px] bg-primary/20" />
                                {threadSequence.map((p, idx) => (
                                    <div key={p.id} className="relative pl-10 pb-6 last:pb-0">
                                        <div className="absolute left-0 top-1 w-7 h-7 rounded-lg bg-white dark:bg-slate-900 border-2 border-primary z-10 flex items-center justify-center shadow-lg shadow-primary/20">
                                            <span className="text-[10px] font-black text-primary">{idx + 1}</span>
                                        </div>
                                        <p className="text-xs text-foreground/80 font-bold line-clamp-2 leading-relaxed">
                                            {p.content}
                                        </p>
                                        <div className="flex gap-2 mt-2 items-center">
                                            <span className={`text-[8px] px-2 py-0.5 rounded-lg uppercase font-black tracking-widest ${p.status === 'sent' ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'}`}>
                                                {p.status}
                                            </span>
                                            {p.username && <span className="text-[10px] text-muted-foreground font-black opacity-50">@{p.username}</span>}
                                        </div>
                                    </div>
                                ))}
                                <div className="relative pl-10">
                                    <div className="absolute left-2.5 top-1.5 w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                                    <div className="absolute left-2.5 top-1.5 w-2.5 h-2.5 rounded-full bg-primary" />
                                    <p className="text-[10px] text-primary font-black uppercase tracking-widest px-1">Posición Actual</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Post Stats */}
                    {post && post.status === 'sent' && (
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-border/40 flex flex-col items-center gap-1 group/stat hover:border-primary/40 transition-all">
                                <Eye size={16} className="text-primary opacity-60 group-hover/stat:opacity-100 transition-opacity" />
                                <span className="text-lg font-black tracking-tighter tabular-nums">{(post as any).views_count || 0}</span>
                                <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Vistas</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-border/40 flex flex-col items-center gap-1 group/stat hover:border-rose-400/40 transition-all">
                                <Heart size={16} className="text-rose-500 opacity-60 group-hover/stat:opacity-100 transition-opacity" />
                                <span className="text-lg font-black tracking-tighter tabular-nums">{(post as any).likes_count || 0}</span>
                                <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Likes</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-border/40 flex flex-col items-center gap-1 group/stat hover:border-emerald-400/40 transition-all">
                                <Repeat size={16} className="text-emerald-500 opacity-60 group-hover/stat:opacity-100 transition-opacity" />
                                <span className="text-lg font-black tracking-tighter tabular-nums">{(post as any).reposts_count || 0}</span>
                                <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Reposts</span>
                            </div>
                        </div>
                    )}

                    {/* Meta Controls */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Identidad</label>
                            <div className="relative group">
                                <select
                                    className="w-full px-4 py-3 border border-border/60 rounded-2xl bg-white dark:bg-white/5 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none cursor-pointer"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                >
                                    <option value="" disabled>Seleccionar cuenta</option>
                                    {accounts.map(acc => (
                                        <option key={acc.username} value={acc.username}>@{acc.username}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 text-[10px]">▼</div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Padre (Hilo)</label>
                            <div className="relative">
                                <select
                                    className="w-full px-4 py-3 border border-border/60 rounded-2xl bg-white dark:bg-white/5 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none cursor-pointer"
                                    value={parentId || ''}
                                    onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : undefined)}
                                >
                                    <option value="">Post Independiente</option>
                                    {posts
                                        .filter(p => p.id !== post?.id)
                                        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
                                        .map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.content.substring(0, 30)}...
                                            </option>
                                        ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 text-[10px]">▼</div>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Contenido de la Publicación</label>
                        <div className="relative group p-0.5 bg-gradient-to-br from-transparent to-transparent focus-within:from-primary/20 focus-within:to-indigo-500/20 rounded-[1.75rem] transition-all">
                            <textarea
                                className="w-full p-5 border border-border/60 rounded-[1.5rem] bg-white dark:bg-slate-900 focus:border-primary outline-none resize-none h-48 transition-all font-bold text-base leading-relaxed text-foreground placeholder:text-muted-foreground/30 shadow-inner"
                                placeholder="Escribe algo épico..."
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                maxLength={280}
                                required
                            />
                            <div className={`absolute bottom-5 right-6 text-[10px] font-black px-3 py-1.5 rounded-xl border-2 backdrop-blur-md transition-all ${content.length > 250 ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-primary/10 text-primary border-primary/20 shadow-lg shadow-primary/5'}`}>
                                {content.length} <span className="opacity-40">/ 280</span>
                            </div>
                        </div>
                    </div>

                    {/* Media Upload */}
                    <div className="space-y-4">
                        <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Archivos Multimedia</label>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="flex gap-3 p-3 bg-slate-100 dark:bg-white/5 rounded-[1.75rem] border border-border/50">
                                <label className={`flex items-center gap-3 px-6 py-3 bg-white dark:bg-slate-800 text-primary border border-primary/30 rounded-2xl cursor-pointer hover:shadow-xl hover:shadow-primary/10 transition-all active:scale-95 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <Upload size={18} className="stroke-[2.5px]" />
                                    <span className="text-xs font-black uppercase tracking-widest">{uploading ? 'Subiendo...' : 'Cargar'}</span>
                                    <input type="file" className="hidden" accept="image/*,video/*,.gif" onChange={handleFileChange} disabled={uploading} />
                                </label>
                                <div className="flex-1 flex items-center px-2">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter opacity-70">
                                        {mediaPaths ? `${mediaPaths.split(',').length} ARCHIVOS LISTOS` : 'MAX 4 IMÁGENES O 1 VIDEO'}
                                    </p>
                                </div>
                                {mediaPaths && (
                                    <button
                                        type="button"
                                        onClick={() => setMediaPaths('')}
                                        className="p-3 text-red-500 hover:bg-red-500/10 rounded-2xl transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                )}
                            </div>

                            {mediaPaths && (
                                <div className="flex flex-wrap gap-4 px-2">
                                    {mediaPaths.split(',').map((path, idx) => {
                                        const filename = path.split(/[\\/]/).pop();
                                        return (
                                            <div key={idx} className="relative group hover-lift">
                                                <img
                                                    src={`http://127.0.0.1:8000/uploads/${filename}`}
                                                    className="w-20 h-20 object-cover rounded-[1.25rem] border-2 border-primary/20 shadow-lg"
                                                    alt="Asset"
                                                />
                                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-white text-[10px] font-black rounded-lg flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-lg">{idx + 1}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Scheduler */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2">
                            <CalendarIcon size={14} className="text-primary" /> Fecha y Hora de Publicación
                        </label>
                        <div className="relative p-0.5 rounded-2xl bg-slate-500/5 border border-border/40">
                            <input
                                type="datetime-local"
                                className="w-full px-5 py-4 bg-transparent outline-none font-black text-sm text-foreground cursor-pointer"
                                value={scheduledAt}
                                onChange={(e) => setScheduledAt(e.target.value)}
                            />
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground pl-1 italic">
                            {scheduledAt ? 'La publicación está programada para la hora seleccionada.' : 'Deja vacío para guardar como borrador.'}
                        </p>
                    </div>

                    <div className="flex justify-end gap-4 pt-10 border-t border-border/40 pb-4">
                        {post && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="mr-auto px-8 py-4 text-red-500 hover:bg-red-500/5 rounded-[1.5rem] transition-all font-black text-xs uppercase tracking-[0.2em] active:scale-95"
                            >
                                Eliminar
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-8 py-4 text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-white/5 rounded-[1.5rem] transition-all font-black text-xs uppercase tracking-[0.2em]"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-10 py-4 bg-primary text-white hover:shadow-[0_15px_40px_rgba(99,102,241,0.4)] rounded-[1.5rem] transition-all active:scale-95 font-black text-xs uppercase tracking-[0.2em] bg-gradient-to-r from-primary to-indigo-600 shadow-xl shadow-primary/20"
                        >
                            {post ? 'Actualizar' : (scheduledAt ? 'Programar' : 'Guardar')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
