import { useState, useMemo, useEffect } from 'react';
import {
  Moon,
  Sun,
  Zap,
  Plus,
  Menu,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import type { Post } from './types';
import { PostModal } from './components/PostModal';
import { LoginModal } from './components/LoginModal';
import { ImportTweetModal } from './components/ImportTweetModal';
import { AnalyticsView } from './components/AnalyticsView';
import { ScrapedDataView } from './components/ScrapedDataView';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { CalendarView } from './components/CalendarView';
import { getUserTimezone } from './utils/timezone';
import { usePosts } from './hooks/usePosts';
import { useAuth } from './hooks/useAuth';
import { useStats } from './hooks/useStats';
import { useAnalytics } from './hooks/useAnalytics';
import { cn } from './lib/utils';
import { api, BASE_URL } from './api';

function App() {
  const { posts, isLoading: isLoadingPosts, createPost, updatePost, error: postsError, refetch: refetchPosts } = usePosts();
  const { accounts, refetch: refetchAuth } = useAuth();
  const { data: globalStats, refetch: refetchStats } = useStats();
  const { refetch: refetchAnalytics } = useAnalytics();

  const handleGlobalRefresh = async () => {
    await Promise.all([
      refetchPosts(),
      refetchStats(),
      refetchAnalytics(),
      refetchAuth()
    ]);
  };

  const [currentView, setCurrentView] = useState<'calendar' | 'analytics' | 'scraped-data'>('calendar');
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const hasDarkClass = document.documentElement.classList.contains('dark');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return hasDarkClass || prefersDark;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Track window resizing for responsive calendar
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('change', handleResize);
  }, []);

  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('admin_token'));

  const handleLogin = (token: string) => {
    localStorage.setItem('admin_token', token);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
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
    // Create local date from dateStr to avoid UTC shift
    // arg.dateStr comes as "YYYY-MM-DD"
    const [year, month, day] = arg.dateStr.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);

    setSelectedDate(localDate);
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
      // Immediate refetch to show changes in Metrics and Latest Post
      await refetchPosts();
      await refetchStats();
      await refetchAnalytics();

      setIsPostModalOpen(false);
    } catch (error) {
      console.error('Error saving post:', error);
    }
  };

  const handleSync = async () => {
    const username = accounts[0]?.username;
    if (username) {
      const res = await api.syncHistory(username);
      await handleGlobalRefresh();
      return res;
    }
    return { imported: 0, log: "No hay cuenta activa" };
  };

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
          <div className="mb-6 p-3 bg-black/10 dark:bg-white/5 rounded-xl border border-white/5 text-[9px] font-mono text-rose-400 overflow-x-auto">
            {String(postsError)}
          </div>

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
            <div className="text-[9px] text-muted-foreground/50 font-mono mb-4 break-all px-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl border border-white/5">
              Target: {BASE_URL}
            </div>
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
              href={`${BASE_URL} /api/health`}
              target="_blank"
              rel="noreferrer"
              className="block w-full py-2 text-muted-foreground hover:text-primary transition-colors font-bold uppercase tracking-widest text-[8px]"
            >
              Verificar Estado del Backend ↗
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
        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          globalStats={globalStats}
          posts={posts}
          accounts={accounts}
          onOpenPostModal={(post) => { setSelectedPost(post); setIsPostModalOpen(true); }}
          onOpenLoginModal={() => setIsLoginModalOpen(true)}
          onLogout={handleLogout}
          onRefresh={handleGlobalRefresh}
          onSync={handleSync}
          onOpenImportModal={() => setIsImportModalOpen(true)}
        />
      </aside>

      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 h-20 z-40 md:hidden flex items-center justify-between px-6 glass bg-white/60 dark:bg-slate-950/60 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-xl shadow-lg shadow-primary/20">
            <Zap size={18} className="text-white fill-current" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-tighter uppercase italic text-gradient">Command Mobile</span>
            <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest leading-none">V2 - Fixed Layout</span>
          </div>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-3 bg-primary/10 text-primary rounded-xl active:scale-95 transition-all"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* Mobile Sidebar / Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md md:hidden"
          />
        )}
        {isMobileMenuOpen && (
          <motion.aside
            key="drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 w-[85%] max-w-[320px] z-[60] flex flex-col glass bg-white dark:bg-slate-950 md:hidden overflow-hidden"
          >
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-6 right-6 p-2 bg-slate-500/10 dark:bg-white/5 rounded-xl text-muted-foreground z-10"
            >
              <X size={20} />
            </button>
            <Sidebar
              currentView={currentView}
              setCurrentView={setCurrentView}
              setIsMobileMenuOpen={setIsMobileMenuOpen}
              globalStats={globalStats}
              posts={posts}
              accounts={accounts}
              onOpenPostModal={(post) => { setSelectedPost(post); setIsPostModalOpen(true); }}
              onOpenLoginModal={() => setIsLoginModalOpen(true)}
              onLogout={handleLogout}
              onRefresh={handleGlobalRefresh}
              onSync={handleSync}
              onOpenImportModal={() => setIsImportModalOpen(true)}
            />
          </motion.aside>
        )}
      </AnimatePresence>

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
              className="hidden md:flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black transition-all hover:scale-[1.05] active:scale-[0.95] shadow-2xl shadow-primary/40 bg-gradient-to-r from-primary via-indigo-600 to-blue-600 border-t border-white/20 uppercase text-xs tracking-[0.15em]"
            >
              <Plus size={20} className="stroke-[3px]" />
              <span>Nueva Publicación</span>
            </button>
          </motion.div>
        </header>

        {/* Floating Action Button - Mobile */}
        <button
          onClick={() => { setSelectedPost(null); setIsPostModalOpen(true); }}
          className="fixed bottom-8 right-8 w-16 h-16 bg-primary text-white rounded-full shadow-2xl shadow-primary/40 z-40 flex items-center justify-center active:scale-95 transition-all md:hidden bg-gradient-to-br from-primary to-blue-600 border-t border-white/20"
        >
          <Plus size={24} className="stroke-[3px]" />
        </button>

        {/* Dynamic View */}
        <AnimatePresence mode="wait">
          {currentView === 'calendar' ? (
            <CalendarView
              posts={posts}
              userTimezone={userTimezone}
              isMobile={isMobile}
              onDateClick={handleDateClick}
              onEventClick={handleEventClick}
            />
          ) : currentView === 'analytics' ? (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AnalyticsView
                posts={posts}
                globalStats={globalStats}
                accounts={accounts}
              />
            </motion.div>
          ) : (
            <ScrapedDataView posts={posts} />
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

      <ImportTweetModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        accounts={accounts}
        onImportSuccess={async () => {
          await handleGlobalRefresh();
          // Maybe show a toast
        }}
      />

      {/* CSS Overrides are now in index.css */}
    </div>
  );
}

export default App;
