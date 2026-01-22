import { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Plus, RefreshCcw, Calendar as CalendarIcon, Server, Image as ImageIcon, Sun, Moon, BarChart3, Zap, Clock, CheckCircle2, Menu, X } from 'lucide-react';
import { api } from './api';
import type { Post } from './types';
import { PostModal } from './components/PostModal';
import { LoginModal } from './components/LoginModal';
import { AnalyticsView } from './components/AnalyticsView';
import { getUserTimezone } from './utils/timezone';

function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<{ username: string; connected: boolean; last_connected?: string }[]>([]);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [userTimezone] = useState<string>(getUserTimezone());
  const [currentView, setCurrentView] = useState<'calendar' | 'analytics'>('calendar');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Stats
  const queuedCount = posts.filter(p => p.status === 'scheduled').length;
  const sentCount = posts.filter(p => p.status === 'sent').length;
  const failedCount = posts.filter(p => p.status === 'failed').length;

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const data = await api.getPosts();
      setPosts(data);
      setServerStatus('online');
    } catch (err) {
      console.error("Fetch Posts Error:", err);
      setServerStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  const checkAuthStatus = async () => {
    try {
      const { accounts } = await api.getAuthStatus();
      setAccounts(accounts);
    } catch (err) {
      console.error("Auth check failed", err);
    }
  };

  useEffect(() => {
    fetchPosts();
    checkAuthStatus();
    // Poll every 10s to update statuses
    const interval = setInterval(() => {
      fetchPosts();
      checkAuthStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDateClick = (arg: any) => {
    // arg.dateStr is a string like "2026-01-22"
    // Parsing it manually to avoid UTC shifts
    const [year, month, day] = arg.dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const now = new Date();

    // Set to current hour + 1 to provide a useful default
    date.setHours(now.getHours() + 1, 0, 0, 0);

    setSelectedDate(date);
    setSelectedPost(null);
    setIsModalOpen(true);
  };


  const handleEventClick = (arg: any) => {
    const post = posts.find(p => p.id === Number(arg.event.id));
    if (post) {
      setSelectedPost(post);
      setIsModalOpen(true);
    }
  };

  const handleSavePost = async (post: Post) => {
    try {
      if (post.status === 'deleted') {
        fetchPosts();
        return;
      }

      if (post.id) {
        await api.updatePost(post.id, post);
      } else {
        await api.createPost(post);
      }
      fetchPosts();
    } catch (err: any) {
      console.error(err);
      alert(`Error saving post: ${err.message}`);
    }
  };

  const calendarEvents = posts.map(post => {
    // Parse the scheduled_at as UTC
    let eventStart = post.scheduled_at;
    if (eventStart && !eventStart.endsWith('Z')) {
      eventStart = eventStart + 'Z'; // Ensure it's parsed as UTC
    }

    return {
      id: String(post.id),
      title: post.content.substring(0, 30) + (post.content.length > 30 ? '...' : ''),
      start: eventStart, // FullCalendar will convert to local time automatically
      backgroundColor: getStatusColor(post.status),
      borderColor: 'transparent',
      textColor: post.status === 'scheduled' ? '#000' : '#fff',
      extendedProps: { ...post }
    };
  });

  function getStatusColor(status: string) {
    switch (status) {
      case 'draft': return '#e2e8f0'; // slate-200
      case 'scheduled': return '#fef08a'; // yellow-200 (black text)
      case 'processing': return '#93c5fd'; // blue-300
      case 'sent': return '#86efac'; // green-300
      case 'failed': return '#fca5a5'; // red-300
      default: return '#e2e8f0';
    }
  }

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Apply dark mode class to html/body
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Sync with system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 relative overflow-hidden ${darkMode ? 'dark bg-gray-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>

      {/* Mobile Header - Only visible on small screens */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 glass p-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-2 rounded-xl shadow-lg shadow-primary/20 bg-gradient-to-br from-primary to-blue-600">
              <Zap size={18} className="fill-current stroke-[1.5px]" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tighter text-foreground leading-tight">X Command</h1>
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-primary/80">Scheduler Pro</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all text-foreground border border-border/80 dark:border-white/10"
            >
              {darkMode ? <Sun size={16} className="text-yellow-500" /> : <Moon size={16} className="text-[#2563eb]" />}
            </button>
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="p-3 bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              <Menu size={16} />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <nav className="flex gap-2">
          <button
            onClick={() => setCurrentView('calendar')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs transition-all duration-300 ${currentView === 'calendar'
              ? 'bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-primary/30'
              : 'bg-white/40 dark:bg-white/5 text-muted-foreground hover:bg-white/60 dark:hover:bg-white/10'
              }`}
          >
            <CalendarIcon size={14} />
            <span>Cronograma</span>
          </button>
          <button
            onClick={() => setCurrentView('analytics')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs transition-all duration-300 ${currentView === 'analytics'
              ? 'bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-primary/30'
              : 'bg-white/40 dark:bg-white/5 text-muted-foreground hover:bg-white/60 dark:hover:bg-white/10'
              }`}
          >
            <BarChart3 size={14} />
            <span>Analíticas</span>
          </button>
        </nav>
      </header>

      {/* Mobile Drawer */}
      {mobileDrawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] animate-fade-in"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer Content */}
          <aside className="md:hidden fixed left-0 top-0 bottom-0 w-[85vw] max-w-sm z-[70] glass bg-white/95 dark:bg-slate-900/95 border-r border-border/50 overflow-y-auto custom-scrollbar animate-slide-in-left">
            {/* Drawer Header */}
            <div className="p-6 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary text-primary-foreground p-2.5 rounded-xl shadow-lg shadow-primary/20 bg-gradient-to-br from-primary to-blue-600">
                  <Zap size={20} className="fill-current stroke-[1.5px]" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold tracking-tighter text-foreground leading-tight">X Command</h2>
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/80">Scheduler Pro</span>
                </div>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={20} className="text-muted-foreground" />
              </button>
            </div>

            {/* Drawer Content - Same as Desktop Sidebar */}
            <div className="p-6">
              {/* Metrics */}
              <div className="mb-8">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex justify-between">
                  Métricas Live
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                </p>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/60 dark:bg-white/5 border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                        <Clock size={16} />
                      </div>
                      <span className="text-xs font-bold text-muted-foreground">En Cola</span>
                    </div>
                    <span className="font-black text-sm tabular-nums text-orange-500">{queuedCount}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/60 dark:bg-white/5 border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                        <CheckCircle2 size={16} />
                      </div>
                      <span className="text-xs font-bold text-muted-foreground">Enviados</span>
                    </div>
                    <span className="font-black text-sm tabular-nums text-green-500">{sentCount}</span>
                  </div>
                </div>
              </div>

              {/* Quick Drafts */}
              <div className="mb-8">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex justify-between">
                  Borradores Rápidos
                  <span className="text-primary font-bold">{posts.filter(p => !p.scheduled_at || p.status === 'draft').length}</span>
                </p>
                <div className="space-y-3">
                  {posts.filter(p => (!p.scheduled_at || p.status === 'draft') && p.status !== 'deleted').slice(0, 5).map(draft => (
                    <div
                      key={draft.id}
                      onClick={() => { setSelectedPost(draft); setIsModalOpen(true); setMobileDrawerOpen(false); }}
                      className="p-4 bg-white/70 dark:bg-white/5 hover:bg-white/90 dark:hover:bg-white/10 border border-border/50 hover:border-primary/40 rounded-xl cursor-pointer transition-all duration-300 shadow-sm"
                    >
                      <p className="text-xs font-bold line-clamp-2 text-foreground/80 leading-relaxed mb-3">
                        {draft.content || "(Sin contenido)"}
                      </p>
                      <div className="flex justify-between items-center opacity-60">
                        <span className="text-[9px] font-bold uppercase tracking-tighter">
                          {draft.updated_at ? new Date(draft.updated_at).toLocaleDateString() : 'Reciente'}
                        </span>
                        {draft.media_paths && <ImageIcon size={12} className="text-primary" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Accounts */}
              <div className="mb-6">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Cuentas Activas</p>
                <div className="space-y-3">
                  {accounts.map(acc => (
                    <div key={acc.username} className="flex items-center gap-3 p-3 rounded-xl bg-white/70 dark:bg-black/40 border border-border/50 shadow-sm">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-xs font-black text-white shadow-lg shadow-primary/20">
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
                    onClick={() => { setIsLoginModalOpen(true); setMobileDrawerOpen(false); }}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border/50 rounded-xl text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 font-bold text-xs"
                  >
                    <Plus size={14} />
                    <span>Agregar Cuenta</span>
                  </button>
                </div>
              </div>

              {/* Server Status */}
              <div className="flex items-center justify-between px-2 pt-4 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${serverStatus === 'online' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Status: {serverStatus}</span>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Ambient Background Blobs */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none">
        <div className="absolute top-[-10%] right-[10%] h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[10%] left-[5%] h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Sidebar - Enhanced Premium Look */}
      <aside className={`fixed left-6 top-6 bottom-6 w-80 flex flex-col z-50 transition-all duration-500 rounded-[2.5rem] glass ${darkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white/40 border-white/60'} hidden md:flex overflow-hidden group hover:shadow-2xl hover:shadow-primary/5`}>
        <div className="p-8 pb-4">
          <div className="flex items-center gap-4 mb-10 group/logo">
            <div className="bg-primary text-primary-foreground p-3 rounded-2xl shadow-lg shadow-primary/20 bg-gradient-to-br from-primary to-blue-600 group-hover/logo:scale-110 transition-transform duration-500">
              <Zap size={24} className="fill-current stroke-[1.5px]" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tighter text-foreground leading-tight">X Command</h1>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80">Scheduler Pro</span>
            </div>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setCurrentView('calendar')}
              className={`flex items-center gap-3 w-full px-5 py-4 rounded-2xl font-bold transition-all duration-300 group ${currentView === 'calendar' ? 'sidebar-active' : 'sidebar-inactive'}`}
            >
              <CalendarIcon size={18} className={currentView === 'calendar' ? "group-hover:rotate-12 transition-transform" : ""} />
              <span>Cronograma</span>
            </button>
            <button
              onClick={() => setCurrentView('analytics')}
              className={`flex items-center gap-3 w-full px-5 py-4 rounded-2xl font-bold transition-all duration-300 group ${currentView === 'analytics' ? 'sidebar-active' : 'sidebar-inactive'}`}
            >
              <BarChart3 size={18} />
              <span>Analíticas</span>
            </button>
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
          <div className="mb-10">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 px-2 flex justify-between">
              Métricas Live
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
            </p>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between p-4 rounded-[1.5rem] bg-white/40 dark:bg-white/5 border border-border/50 hover-lift group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-transform">
                    <Clock size={16} />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">En Cola</span>
                </div>
                <span className="font-black text-sm tabular-nums text-orange-500">{queuedCount}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-[1.5rem] bg-white/40 dark:bg-white/5 border border-border/50 hover-lift group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-green-500/10 text-green-500 group-hover:scale-110 transition-transform">
                    <CheckCircle2 size={16} />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">Enviados</span>
                </div>
                <span className="font-black text-sm tabular-nums text-green-500">{sentCount}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 px-2 flex justify-between">
              Borradores Rápidos
              <span className="text-primary font-bold">{posts.filter(p => !p.scheduled_at || p.status === 'draft').length}</span>
            </p>
            <div className="space-y-3">
              {posts.filter(p => (!p.scheduled_at || p.status === 'draft') && p.status !== 'deleted').map(draft => (
                <div
                  key={draft.id}
                  onClick={() => { setSelectedPost(draft); setIsModalOpen(true); }}
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
            </div>
          </div>

          <div className="flex items-center justify-between px-2 pt-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${serverStatus === 'online' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Status: {serverStatus}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="pt-[160px] md:pt-0 md:ml-[340px] p-8 md:p-12 min-h-screen relative z-40 max-w-[1600px] mx-auto overflow-visible">
        {/* Desktop Header - Hidden on mobile */}
        <header className="hidden md:flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-16 animate-slide-up">
          <div className="stagger-1">
            <h2 className="text-5xl font-black tracking-tight mb-4 text-gradient">
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
          </div>

          <div className="flex items-center gap-3 bg-white/40 dark:bg-white/5 p-3 rounded-[2rem] border border-white/60 dark:border-white/10 backdrop-blur-3xl shadow-2xl stagger-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-xl hover:scale-105 active:scale-95 transition-all text-foreground border border-border/80 dark:border-white/10"
            >
              {darkMode ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} className="text-[#2563eb]" />}
            </button>
            <button
              onClick={() => { setSelectedPost(null); setIsModalOpen(true); }}
              className="flex items-center gap-3 px-10 py-4 bg-primary text-primary-foreground rounded-2xl font-black transition-all hover:scale-[1.05] active:scale-[0.95] shadow-2xl shadow-primary/40 bg-gradient-to-r from-primary via-indigo-600 to-blue-600 border-t border-white/20 uppercase text-xs tracking-[0.15em]"
            >
              <Plus size={20} className="stroke-[3px]" />
              <span>Nueva Publicación</span>
            </button>
          </div>
        </header>

        {/* Mobile FAB - Nueva Publicación */}
        <button
          onClick={() => { setSelectedPost(null); setIsModalOpen(true); }}
          className="md:hidden fixed bottom-6 right-6 z-50 flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-primary via-indigo-600 to-blue-600 text-white rounded-full font-black shadow-2xl shadow-primary/40 hover:scale-105 active:scale-95 transition-all uppercase text-xs tracking-wider"
        >
          <Plus size={20} className="stroke-[3px]" />
          <span>Nueva</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Main Display Area (Calendar or Analytics) */}
          <div className="lg:col-span-9 animate-slide-up stagger-2">
            {currentView === 'calendar' ? (
              <div className="bg-white/60 dark:bg-gray-900/80 p-10 rounded-[3.5rem] border border-white/80 dark:border-white/10 backdrop-blur-3xl shadow-2xl shadow-indigo-500/5 min-h-[850px]">
                <div className="flex items-center justify-between mb-12">
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-8 bg-primary rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                    <h3 className="text-2xl font-black tracking-tight">Calendario Editorial</h3>
                  </div>
                  <button onClick={fetchPosts} className={`p-3 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all duration-500 ${loading ? 'animate-spin text-primary' : 'text-muted-foreground'}`}>
                    <RefreshCcw size={20} />
                  </button>
                </div>

                <div className="calendar-container animate-fade-in">
                  <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    timeZone={userTimezone}
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
                      const pathsString = arg.event.extendedProps.media_paths;
                      const pathList = pathsString ? pathsString.split(',') : [];
                      const firstPath = pathList[0] || '';
                      const filename = firstPath ? firstPath.split(/[\\/]/).pop() : '';

                      let themeClasses = "bg-slate-100 text-slate-800 border-slate-200";
                      const status = arg.event.extendedProps.status;
                      if (status === 'scheduled') themeClasses = "bg-yellow-50 text-yellow-900 border-yellow-200 shadow-md shadow-yellow-500/5";
                      if (status === 'sent') themeClasses = "bg-emerald-50 text-emerald-900 border-emerald-200 shadow-md shadow-emerald-500/5";
                      if (status === 'failed') themeClasses = "bg-rose-50 text-rose-900 border-rose-200 shadow-md shadow-rose-500/5";
                      if (status === 'processing') themeClasses = "bg-sky-50 text-sky-900 border-sky-200 shadow-md shadow-sky-500/5 animate-pulse";

                      const date = new Date(arg.event.start!);
                      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                      return (
                        <div className={`p-4 rounded-2xl border backdrop-blur-md transition-all hover:scale-[1.05] hover:shadow-xl group/event overflow-hidden ${themeClasses}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-black text-[10px] opacity-60">{timeStr}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                          </div>
                          <div className="font-bold text-xs line-clamp-2 leading-tight mb-2">{arg.event.title}</div>
                          {firstPath && (
                            <div className="relative w-full h-20 rounded-xl overflow-hidden shadow-inner mt-2">
                              <img src={`http://127.0.0.1:8000/uploads/${filename}`} className="w-full h-full object-cover group-hover/event:scale-110 transition-transform duration-700" alt="thumb" />
                              {pathList.length > 1 && (
                                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg border border-white/20">+{pathList.length - 1}</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                </div>
              </div>
            ) : (
              <AnalyticsView posts={posts} />
            )}
          </div>

          {/* Right Section */}
          <div className="lg:col-span-3 space-y-10 animate-slide-up stagger-3">
            {/* Stats Card */}
            <div className="bg-primary/5 dark:bg-primary/10 p-8 rounded-[3rem] border border-primary/20 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-primary/20 rounded-full blur-[80px] group-hover:scale-150 transition-transform duration-1000" />

              <h3 className="text-xs font-black uppercase tracking-widest text-primary mb-8 flex items-center gap-3">
                <BarChart3 size={18} /> Rendimiento
              </h3>

              <div className="space-y-8">
                <div>
                  <div className="flex justify-between items-end mb-3">
                    <span className="text-sm font-bold opacity-60">Tasa de Éxito</span>
                    <span className="text-4xl font-black tracking-tighter">
                      {sentCount + failedCount > 0 ? Math.round((sentCount / (sentCount + failedCount)) * 100) : 100}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                      style={{ width: `${sentCount + failedCount > 0 ? (sentCount / (sentCount + failedCount)) * 100 : 100}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="p-5 rounded-3xl bg-white/40 dark:bg-white/5 border border-border/50 hover-lift text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Errores</p>
                    <span className="text-2xl font-black text-red-500">{failedCount}</span>
                  </div>
                  <div className="p-5 rounded-3xl bg-white/40 dark:bg-white/5 border border-border/50 hover-lift text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Total</p>
                    <span className="text-2xl font-black text-slate-500">{sentCount + failedCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Logs */}
            <div className="bg-white/40 dark:bg-slate-900/40 p-8 rounded-[3rem] border border-border/60 backdrop-blur-xl flex-1">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-8 flex items-center gap-3">
                <Server size={18} className="text-primary" /> Actividad Reciente
              </h3>
              <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                {posts.filter(p => p.logs).slice(0, 10).map((p, idx) => (
                  <div key={p.id} className="p-5 bg-white/40 dark:bg-white/5 rounded-2xl border border-border/40 hover:border-primary/30 transition-all hover-lift group relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20" />
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[9px] font-black text-primary/60 uppercase tracking-tighter">
                        Log #{idx + 1} • {p.updated_at ? new Date(p.updated_at.endsWith('Z') ? p.updated_at : p.updated_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                      {p.status === 'sent' && (
                        <div className="bg-green-500/10 text-green-600 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase">Enviado</div>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed font-bold text-foreground/70 italic line-clamp-4">
                      "{p.logs}"
                    </p>
                  </div>
                ))}
                {posts.filter(p => p.logs).length === 0 && (
                  <div className="text-center py-20 opacity-30">
                    <RefreshCcw size={32} className="mx-auto mb-4 animate-spin-slow" />
                    <p className="text-xs font-bold uppercase tracking-widest italic">Esperando actividad...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals with custom dark overlay */}
      <PostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePost}
        post={selectedPost}
        initialDate={selectedDate}
        posts={posts}
        userTimezone={userTimezone}
        accounts={accounts}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
}

export default App;
