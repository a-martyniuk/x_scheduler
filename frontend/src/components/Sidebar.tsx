import React from 'react';
import {
    Calendar as CalendarIcon,
    BarChart3,
    Clock,
    CheckCircle2,
    ImageIcon,
    Plus,
    LogOut,
    Zap,
    RefreshCcw,
    Download,
    Database,
    AlertTriangle
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { Post, Account } from '../types';

interface SidebarProps {
    currentView: 'calendar' | 'analytics' | 'scraped-data' | 'quarantine';
    setCurrentView: (view: 'calendar' | 'analytics' | 'scraped-data' | 'quarantine') => void;
    setIsMobileMenuOpen: (isOpen: boolean) => void;
    globalStats: any;
    posts: Post[];
    accounts: Account[];
    onOpenPostModal: (post: Post | null) => void;
    onOpenLoginModal: () => void;
    onLogout: () => void;
    onRefresh: () => void;
    onSync: () => Promise<any>;
    onOpenImportModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    currentView,
    setCurrentView,
    setIsMobileMenuOpen,
    globalStats,
    posts,
    accounts,
    onOpenPostModal,
    onOpenLoginModal,
    onLogout,
    onRefresh,
    onSync,
    onOpenImportModal
}) => {
    const sentCount = globalStats?.sent || 0;
    const queuedCount = globalStats?.scheduled || 0;
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const handleSyncClick = async () => {
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

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await onRefresh();
        } finally {
            // Artificial delay to ensure user sees the "loading" state if it's too fast
            await new Promise(resolve => setTimeout(resolve, 500));
            setIsRefreshing(false);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
            <div className="p-8 pb-4">
                <div className="flex items-center gap-4 mb-10 group/logo cursor-pointer">
                    <div className="bg-primary text-primary-foreground p-3 rounded-2xl shadow-lg shadow-primary/20 bg-gradient-to-br from-primary to-blue-600 group-hover/logo:scale-110 transition-transform duration-500">
                        <Zap size={24} className="fill-current stroke-[1.5px]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold tracking-tighter text-foreground leading-tight">X Command</h1>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80">Scheduler Pro</span>
                    </div>
                </div>

                <nav className="space-y-2 mb-6">
                    {[
                        { id: 'calendar', label: 'Cronograma', icon: CalendarIcon },
                        { id: 'analytics', label: 'Analíticas', icon: BarChart3 },
                        { id: 'scraped-data', label: 'Datos X', icon: Database },
                        { id: 'quarantine', label: 'Cuarentena', icon: AlertTriangle },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setCurrentView(item.id as any);
                                setIsMobileMenuOpen(false);
                            }}
                            className={cn(
                                "flex items-center gap-3 w-full px-5 py-4 rounded-2xl font-bold transition-all duration-300 group",
                                currentView === item.id ? "sidebar-active" : "sidebar-inactive"
                            )}
                        >
                            <item.icon size={18} className={currentView === item.id ? "group-hover:rotate-12 transition-transform" : ""} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="mb-10 px-2 flex gap-2">
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 bg-secondary/50 text-secondary-foreground hover:bg-secondary hover:text-primary rounded-xl transition-all duration-300 text-[10px] font-black uppercase tracking-widest border border-border/50 group relative",
                            isRefreshing && "opacity-70 cursor-not-allowed"
                        )}
                        title="Recargar datos locales (No sincroniza con X)"
                    >
                        <RefreshCcw size={14} className={cn("transition-transform duration-700", isRefreshing ? "animate-spin" : "group-hover:rotate-180")} />
                        <span className="hidden sm:inline">{isRefreshing ? '...' : 'Datos'}</span>
                    </button>
                    <button
                        onClick={handleSyncClick}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white rounded-xl transition-all duration-300 text-[10px] font-black uppercase tracking-widest border border-indigo-500/20 group relative",
                            isSyncing && "opacity-70 cursor-not-allowed"
                        )}
                        disabled={isSyncing}
                        title="Sincronizar con X (Descarga info real)"
                    >
                        <span className="hidden sm:inline">{isSyncing ? "..." : "Sync X"}</span>
                    </button>
                    <button
                        onClick={onOpenImportModal}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white rounded-xl transition-all duration-300 text-[10px] font-black uppercase tracking-widest border border-orange-500/20 group relative"
                        title="Importar tweet por URL"
                    >
                        <Download size={14} className="group-hover:translate-y-0.5 transition-transform duration-300" />
                        <span className="hidden md:inline">Import</span>
                    </button>
                </div>

                <div className="space-y-10">
                    <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 px-2 flex justify-between">
                            Métricas Live
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                        </p>
                        <div className="grid grid-cols-1 gap-3">
                            {[
                                { label: 'En Cola', val: queuedCount, icon: Clock, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                                { label: 'Enviados', val: sentCount, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
                            ].map((stat, i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-[1.5rem] bg-white/40 dark:bg-white/5 border border-border/50 hover-lift group">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-xl group-hover:scale-110 transition-transform", stat.bg, stat.color)}>
                                            <stat.icon size={16} />
                                        </div>
                                        <span className="text-xs font-bold text-muted-foreground">{stat.label}</span>
                                    </div>
                                    <span className={cn("font-black text-sm tabular-nums", stat.color)}>{stat.val}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 px-2 flex justify-between">
                            Borradores Rápidos
                            <span className="text-primary font-bold">{posts.filter(p => p.status === 'draft').length}</span>
                        </p>
                        <div className="space-y-3">
                            {posts.filter(p => p.status === 'draft').slice(0, 3).map(draft => (
                                <div
                                    key={draft.id}
                                    onClick={() => { onOpenPostModal(draft); setIsMobileMenuOpen(false); }}
                                    className="p-5 bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-border/50 hover:border-primary/40 rounded-2xl cursor-pointer transition-all duration-300 group shadow-sm hover:shadow-xl hover:-translate-y-1"
                                >
                                    <p className="text-xs font-bold line-clamp-2 text-foreground/80 leading-relaxed mb-4">
                                        {draft.content || "(Sin contenido)"}
                                    </p>
                                    <div className="flex justify-between items-center opacity-60 group-hover:opacity-100 transition-opacity">
                                        <span className="text-[9px] font-bold uppercase tracking-tighter">
                                            {draft.updated_at ? new Date(draft.updated_at).toLocaleDateString() : 'Reciente'}
                                        </span>
                                        {draft.media_paths && <ImageIcon size={12} className="text-primary" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pb-8">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 px-2">Cuentas Activas</p>
                        <div className="space-y-3">
                            {accounts.map(acc => (
                                <div key={acc.username} className="flex items-center gap-3 p-3 rounded-2xl bg-white/60 dark:bg-black/40 border border-border/50 shadow-sm">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-xs font-black text-white shadow-lg shadow-primary/20">
                                        {acc.username[0].toUpperCase()}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-black text-foreground truncate">@{acc.username}</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                                            <span className="text-[9px] text-green-500/80 font-black uppercase tracking-widest">En Línea</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => { onOpenLoginModal(); setIsMobileMenuOpen(false); }}
                                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border/50 rounded-2xl text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 font-bold text-xs"
                            >
                                <Plus size={14} />
                                <span>Agregar Cuenta</span>
                            </button>
                            <button
                                onClick={onLogout}
                                className="w-full mt-6 flex items-center justify-center gap-2 py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-2xl transition-all duration-300 font-black text-[10px] uppercase tracking-widest border border-rose-500/20"
                            >
                                <LogOut size={14} />
                                <span>Cerrar Sesión</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
