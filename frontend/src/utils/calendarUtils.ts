import type { CalendarEvent } from "../types/calendar.types";

function eventIdentity(event: CalendarEvent): string {
  if (event.id) return event.id;
  return [event.start, event.end ?? "", event.title, event.html_link ?? ""].join("|");
}

function eventStartTime(event: CalendarEvent): number {
  const value = new Date(event.start).getTime();
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

export function normalizeUpcomingEvents(events: CalendarEvent[], limit: number): CalendarEvent[] {
  const uniqueEvents = new Map<string, CalendarEvent>();

  for (const event of events) {
    const identity = eventIdentity(event);
    if (!uniqueEvents.has(identity)) uniqueEvents.set(identity, event);
  }

  return [...uniqueEvents.values()]
    .sort((left, right) => {
      const timeDifference = eventStartTime(left) - eventStartTime(right);
      if (timeDifference !== 0) return timeDifference;
      return left.title.localeCompare(right.title);
    })
    .slice(0, Math.max(0, limit));
}
