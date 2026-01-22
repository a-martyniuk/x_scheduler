/**
 * Timezone Utilities
 * Handles conversion between local time and UTC for the X Scheduler
 */

/**
 * Get the user's current timezone
 * @returns IANA timezone string (e.g., "America/Argentina/Buenos_Aires")
 */
export function getUserTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Get the UTC offset for a timezone
 * @param timezone IANA timezone string
 * @returns Offset string (e.g., "UTC-3")
 */
export function getTimezoneOffset(timezone: string): string {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'shortOffset'
    });

    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find(part => part.type === 'timeZoneName');

    return offsetPart?.value || 'UTC';
}

/**
 * Convert local datetime string to UTC ISO string
 * SIMPLIFIED VERSION - Uses browser's native timezone handling
 * @param localDateTimeString Format: "2026-01-22T09:00" (from datetime-local input)
 * @param timezone IANA timezone string (not used, relies on browser timezone)
 * @returns UTC ISO string: "2026-01-22T12:00:00.000Z"
 */
export function localToUTC(localDateTimeString: string, timezone: string): string {
    if (!localDateTimeString) return '';

    // The datetime-local input gives us "2026-01-22T09:00"
    // This represents LOCAL time in the user's browser timezone
    // When we create a Date object from it, JavaScript interprets it as local time
    const localDate = new Date(localDateTimeString);

    // toISOString() automatically converts to UTC
    return localDate.toISOString();
}

/**
 * Convert UTC ISO string to local datetime string for datetime-local input
 * SIMPLIFIED VERSION - Uses browser's native timezone handling
 * @param utcISOString Format: "2026-01-22T12:00:00" or "2026-01-22T12:00:00.000Z"
 * @param timezone IANA timezone string (not used, relies on browser timezone)
 * @returns Local datetime string: "2026-01-22T09:00"
 */
export function utcToLocal(utcISOString: string, timezone: string): string {
    if (!utcISOString) return '';

    // Ensure the string is parsed as UTC
    const utcString = utcISOString.endsWith('Z') ? utcISOString : utcISOString + 'Z';
    const utcDate = new Date(utcString);

    // Get the local time by adjusting for timezone offset
    const offset = utcDate.getTimezoneOffset() * 60000; // offset in milliseconds
    const localDate = new Date(utcDate.getTime() - offset);

    // Format as datetime-local string (YYYY-MM-DDTHH:MM)
    return localDate.toISOString().slice(0, 16);
}

/**
 * Format a date in the user's local timezone
 * @param date Date object or ISO string
 * @param timezone IANA timezone string
 * @returns Formatted string (e.g., "22/01/2026 09:00")
 */
export function formatLocalTime(date: Date | string, timezone: string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    return new Intl.DateTimeFormat('es-AR', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(dateObj);
}

/**
 * Common timezones for the selector
 */
export const COMMON_TIMEZONES = [
    { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (UTC-3)' },
    { value: 'America/Sao_Paulo', label: 'Brasil (UTC-3)' },
    { value: 'America/Santiago', label: 'Chile (UTC-3)' },
    { value: 'America/Mexico_City', label: 'México (UTC-6)' },
    { value: 'America/New_York', label: 'New York (UTC-5)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8)' },
    { value: 'Europe/Madrid', label: 'España (UTC+1)' },
    { value: 'Europe/London', label: 'Londres (UTC+0)' },
    { value: 'Asia/Tokyo', label: 'Tokio (UTC+9)' },
    { value: 'UTC', label: 'UTC (UTC+0)' }
];
