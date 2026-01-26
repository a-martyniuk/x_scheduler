import React, { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import type { Post } from '../types';

interface CalendarViewProps {
    posts: Post[];
    userTimezone: string;
    isMobile: boolean;
    onDateClick: (arg: any) => void;
    onEventClick: (arg: any) => void;
    // isLoading and onRefresh removed
}

export const CalendarView: React.FC<CalendarViewProps> = ({
    posts,
    userTimezone,
    isMobile,
    onDateClick,
    onEventClick
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
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-2 h-8 bg-primary rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                    <h3 className="text-2xl font-black tracking-tight">Calendario Editorial</h3>
                </div>
                {/* Refresh button moved to Sidebar */}
            </div>

            <div className="calendar-container">
                <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    timeZone={userTimezone}
                    themeSystem="standard"
                    defaultTimedEventDuration="00:15:00"
                    forceEventDuration={true}
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
                            <div className="p-3 rounded-xl border border-border/80 bg-card dark:bg-slate-800 shadow-md hover:shadow-lg transition-all hover:scale-[1.02] overflow-hidden group">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="font-black text-[10px] opacity-90 tabular-nums text-foreground/80 group-hover:text-primary transition-colors">{timeStr}</span>
                                    <div className="w-2 h-2 rounded-full ring-2 ring-white/10" style={{ backgroundColor: arg.event.backgroundColor }} />
                                </div>
                                <div className="font-extrabold text-[12px] line-clamp-2 leading-tight text-foreground/90">{arg.event.title}</div>
                            </div>
                        );
                    }}
                />
            </div>
        </motion.div>
    );
};
