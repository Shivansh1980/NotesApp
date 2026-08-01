import { useQuery } from "@tanstack/react-query";

import { calendarApi } from "../api/calendar.api";

export const CALENDAR_SIDEBAR_EVENT_LIMIT = 5;
export const CALENDAR_MANAGE_EVENT_LIMIT = 25;

const CALENDAR_CACHE_FRESH_MS = 5 * 60 * 1000;
const CALENDAR_CACHE_RETENTION_MS = 30 * 60 * 1000;

export const googleCalendarQueryKeys = {
  status: ["google-calendar-status"] as const,
  eventsRoot: ["google-calendar-events"] as const,
  events: (maxResults: number) => ["google-calendar-events", { maxResults }] as const
};

export function useGoogleCalendarStatus() {
  return useQuery({
    queryKey: googleCalendarQueryKeys.status,
    queryFn: calendarApi.status,
    staleTime: CALENDAR_CACHE_FRESH_MS,
    gcTime: CALENDAR_CACHE_RETENTION_MS
  });
}

export function useGoogleCalendarEvents(maxResults: number, enabled: boolean) {
  return useQuery({
    queryKey: googleCalendarQueryKeys.events(maxResults),
    queryFn: () => calendarApi.events(maxResults),
    enabled,
    retry: false,
    staleTime: CALENDAR_CACHE_FRESH_MS,
    gcTime: CALENDAR_CACHE_RETENTION_MS
  });
}
