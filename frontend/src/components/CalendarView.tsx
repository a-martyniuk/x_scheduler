import React, { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { motion } from 'framer-motion';
import { RefreshCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Post } from '../types';

interface CalendarViewProps {
    posts: Post[];
    userTimezone: string;
    isMobile: boolean;
    onDateClick: (arg: any) => void;
    onEventClick: (arg: any) => void;
    onRefresh: () => void;
    isLoading: boolean;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
    posts,
    userTimezone,
    isMobile,
    onDateClick,
    onEventClick,
    onRefresh,
    isLoading
}) => {
    const calendarEvents = useMemo(() => posts.filter(p => p.status !== 'draft').map(p => ({
        id: String(p.id),
        title: p.content,
        // Prioritize original creation date for sent posts to avoid shifting on sync updates
        start: p.scheduled_at || p.created_at || p.updated_at,
        extendedProps: p,
        className: cn(
            'premium-event',
            p.status === 'sent' && 'event-sent',
            p.status === 'failed' && 'event-failed',
            p.status === 'processing' && 'event-processing'
        )
    })), [posts]);

    return (
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
                <button onClick={onRefresh} className="p-3 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all duration-500 text-muted-foreground group">
                    <RefreshCcw size={20} className={isLoading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-700"} />
                </button>
            </div>

            <div className="calendar-container">
                <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    timeZone={userTimezone}
                    themeSystem="standard"
                    headerToolbar={isMobile ? {
                        left: 'prev,next',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek'
                    } : {
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek'
                    }}
                    events={calendarEvents}
                    dateClick={onDateClick}
                    eventClick={onEventClick}
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
    );
};
