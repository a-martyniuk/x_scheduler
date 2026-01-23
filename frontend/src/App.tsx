import { useState, useMemo, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  Calendar as CalendarIcon,
  Plus,
  Moon,
  Sun,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Zap,
  BarChart3,
  RefreshCcw,
  LogOut,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import type { Post } from './types';
import { PostModal } from './components/PostModal';
import { LoginModal } from './components/LoginModal';
import { AnalyticsView } from './components/AnalyticsView';
import { LoginScreen } from './components/LoginScreen';
import { getUserTimezone } from './utils/timezone';
import { usePosts } from './hooks/usePosts';
import { useAuth } from './hooks/useAuth';
import { useStats } from './hooks/useStats';
import { cn } from './lib/utils';
import { BASE_URL } from './api';

function App() {
  const { posts, isLoading: isLoadingPosts, createPost, updatePost, error: postsError } = usePosts();
  const { accounts } = useAuth();
  const { data: globalStats, isLoading: isLoadingStats, refetch: refetchStats } = useStats();

  const [currentView, setCurrentView] = useState<'calendar' | 'analytics'>('calendar');
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const hasDarkClass = document.documentElement.classList.contains('dark');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return hasDarkClass || prefersDark;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('admin_token'));

  const handleLogin = (token: string) => {
    localStorage.setItem('admin_token', token);
    setIsAuthenticated(true);
  };

  // Sync with system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    mediaQuery.addEventListener('change', handleChange);

    // Initial apply
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const userTimezone = useMemo(() => getUserTimezone(), []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleDateClick = (arg: any) => {
    setSelectedPost(null);
    setSelectedDate(arg.date);
    setIsPostModalOpen(true);
  };

  const handleEventClick = (arg: any) => {
    setSelectedPost(arg.event.extendedProps as Post);
    setSelectedDate(arg.event.start!);
    setIsPostModalOpen(true);
  };

  const handleSavePost = async (post: Post) => {
    try {
      if (post.id) {
        await updatePost({ id: post.id, post });
      } else {
        await createPost(post);
      }
      setIsPostModalOpen(false);
    } catch (error) {
      console.error('Error saving post:', error);
    }
  };

  const calendarEvents = useMemo(() => posts.filter(p => p.status !== 'draft').map(p => ({
    id: String(p.id),
    title: p.content,
    start: p.scheduled_at || p.updated_at,
    extendedProps: p,
    className: cn(
      'premium-event',
      p.status === 'sent' && 'event-sent',
      p.status === 'failed' && 'event-failed',
      p.status === 'processing' && 'event-processing'
    )
  })), [posts]);

  const sentCount = globalStats?.sent || 0;
  const queuedCount = globalStats?.scheduled || 0;

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (postsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8FAFC] dark:bg-black p-4 text-center">
        <div className="p-10 rounded-[3rem] bg-rose-500/5 border border-rose-500/20 max-w-md backdrop-blur-xl">
          <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Zap className="text-rose-500 rotate-12" size={32} />
          </div>
          <h2 className="text-2xl font-black tracking-tighter text-rose-500 mb-3">Error de Conexión</h2>
          <p className="text-muted-foreground text-sm mb-2 leading-relaxed"> No pudimos conectar con el backend de X Scheduler.</p>
          <p className="text-[10px] font-bold text-rose-500/60 uppercase tracking-widest mb-8">
            Verifica que <code className="bg-rose-500/10 px-1 rounded">VITE_API_URL</code> esté configurado en Vercel.
          </p>

          {BASE_URL.includes('vercel.app') && (
            <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-left">
              <p className="text-[11px] font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center">
                <Zap size={12} className="mr-1" /> ¡Atención: Configuración faltante!
              </p>
              <p className="text-[10px] text-amber-500/80 leading-relaxed italic">
                La app está intentando conectar con Vercel en lugar de Railway.
                Debes añadir <code className="font-bold">VITE_API_URL</code> en los ajustes de Vercel y
                <span className="font-black underline mx-1">hacer un nuevo despliegue</span>.
              </p>
            </div>
          )}
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all"
            >
              Reintentar Conexión
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('admin_token');
                window.location.reload();
              }}
              className="w-full py-4 bg-white dark:bg-white/5 text-foreground rounded-2xl font-black uppercase tracking-widest text-[10px] border border-border/50"
            >
              Borrar Token / Re-iniciar Sesión
            </button>
            <a
              href="https://xscheduler-production.up.railway.app"
              target="_blank"
              rel="noreferrer"
              className="block w-full py-2 text-muted-foreground hover:text-primary transition-colors font-bold uppercase tracking-widest text-[8px]"
            >
              Probar Backend Directamente ↗
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingPosts && posts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium">Cargando tu centro de mando...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen font-sans transition-colors duration-500 relative overflow-x-hidden",
      isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
    )}>
      {/* Ambient Background Blobs */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none">
        <div className="absolute top-[-10%] right-[10%] h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[10%] left-[5%] h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Sidebar - Desktop */}
      <aside className={cn(
        "fixed left-6 top-6 bottom-6 w-80 flex flex-col z-50 transition-all duration-500 rounded-[2.5rem] glass hidden md:flex overflow-hidden group",
        isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-white/40 border-white/60"
      )}>
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

          <nav className="space-y-2">
            {[
              { id: 'calendar', label: 'Cronograma', icon: CalendarIcon },
              { id: 'analytics', label: 'Analíticas', icon: BarChart3 },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id as any)}
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
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
          <div className="mb-10">
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
              <span className="text-primary font-bold">{posts.filter(p => !p.scheduled_at).length}</span>
            </p>
            <div className="space-y-3">
              {posts.filter(p => !p.scheduled_at && p.status !== 'deleted').slice(0, 3).map(draft => (
                <div
                  key={draft.id}
                  onClick={() => { setSelectedPost(draft); setIsPostModalOpen(true); }}
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
        </div>

        <div className="p-8 border-t border-border/50 bg-slate-500/5 mt-auto">
          <div className="mb-6">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Cuentas Activas</p>
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
                onClick={() => setIsLoginModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border/50 rounded-2xl text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 font-bold text-xs"
              >
                <Plus size={14} />
                <span>Agregar Cuenta</span>
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('admin_token');
                  setIsAuthenticated(false);
                }}
                className="w-full mt-6 flex items-center justify-center gap-2 py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-2xl transition-all duration-300 font-black text-[10px] uppercase tracking-widest border border-rose-500/20"
              >
                <LogOut size={14} />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="pt-[160px] md:pt-12 md:ml-[360px] p-8 md:p-12 min-h-screen relative z-10 max-w-[1600px] mx-auto overflow-visible">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-gradient">
              Centro de Mando
            </h2>
            <div className="flex items-center gap-4">
              <p className="text-sm text-muted-foreground font-semibold flex items-center gap-2">
                Programación de contenido de alto impacto para X.
              </p>
              <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
                PRO VERSION
              </div>
            </div>
          </motion.div>

          <motion.div
            className="flex items-center gap-3 bg-white/40 dark:bg-white/5 p-3 rounded-[2rem] border border-white/60 dark:border-white/10 backdrop-blur-3xl shadow-2xl"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <button
              onClick={toggleTheme}
              className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-md hover:shadow-xl hover:scale-105 active:scale-95 transition-all text-foreground border border-border/80 dark:border-white/10"
            >
              {isDarkMode ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} className="text-[#2563eb]" />}
            </button>
            <button
              onClick={() => { setSelectedPost(null); setIsPostModalOpen(true); }}
              className="flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black transition-all hover:scale-[1.05] active:scale-[0.95] shadow-2xl shadow-primary/40 bg-gradient-to-r from-primary via-indigo-600 to-blue-600 border-t border-white/20 uppercase text-xs tracking-[0.15em]"
            >
              <Plus size={20} className="stroke-[3px]" />
              <span>Nueva Publicación</span>
            </button>
          </motion.div>
        </header>

        {/* Dynamic View */}
        <AnimatePresence mode="wait">
          {currentView === 'calendar' ? (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white/60 dark:bg-gray-900/80 p-6 md:p-10 rounded-[3.5rem] border border-white/80 dark:border-white/10 backdrop-blur-3xl shadow-2xl shadow-indigo-500/5 min-h-[700px]"
            >
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-8 bg-primary rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                  <h3 className="text-2xl font-black tracking-tight">Calendario Editorial</h3>
                </div>
                <button onClick={() => refetchStats()} className="p-3 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all duration-500 text-muted-foreground">
                  <RefreshCcw size={20} className={isLoadingStats ? "animate-spin" : ""} />
                </button>
              </div>

              <div className="calendar-container">
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  timeZone={userTimezone}
                  themeSystem="standard"
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek'
                  }}
                  events={calendarEvents}
                  dateClick={handleDateClick}
                  eventClick={handleEventClick}
                  editable={true}
                  selectable={true}
                  height="auto"
                  eventContent={(arg) => {
                    const date = new Date(arg.event.start!);
                    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div className="p-3 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] overflow-hidden">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-[9px] opacity-60 tabular-nums">{timeStr}</span>
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: arg.event.backgroundColor }} />
                        </div>
                        <div className="font-bold text-[11px] line-clamp-1 leading-tight">{arg.event.title}</div>
                      </div>
                    );
                  }}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AnalyticsView posts={posts} globalStats={globalStats} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <PostModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onSave={handleSavePost}
        post={selectedPost}
        initialDate={selectedDate}
        posts={posts}
        accounts={accounts}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      {/* CSS Overrides for Premium Feel */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .fc-theme-standard td, .fc-theme-standard th { border-color: var(--border) !important; opacity: 0.5; }
        .fc-theme-standard .fc-scrollgrid { border: none !important; }
        .fc-header-toolbar { margin-bottom: 2rem !important; }
        .fc-button { background: hsl(var(--primary)) !important; border: none !important; border-radius: 1rem !important; font-weight: 800 !important; text-transform: uppercase !important; font-size: 10px !important; letter-spacing: 0.1em !important; padding: 0.8rem 1.2rem !important; }
        .fc-button-primary:not(:disabled).fc-button-active, .fc-button-primary:not(:disabled):active { background: hsl(var(--primary)) !important; opacity: 0.8; }
        .fc-toolbar-title { font-weight: 900 !important; letter-spacing: -0.05em !important; }
        .sidebar-active { background: linear-gradient(135deg, hsl(var(--primary)) 0%, #3b82f6 100%); color: white !important; box-shadow: 0 10px 25px -5px hsla(var(--primary), 0.4); }
        .sidebar-inactive { color: hsl(var(--muted-foreground)) !important; }
        .sidebar-inactive:hover { background: hsla(var(--primary), 0.05); color: hsl(var(--foreground)) !important; }
      `}} />
    </div>
  );
}

export default App;
