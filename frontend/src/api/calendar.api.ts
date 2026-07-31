import { request } from "./client";
import type { CalendarEvent, CalendarStatus } from "../types/calendar.types";

export const calendarApi = {
  status() {
    return request<CalendarStatus>("/api/integrations/google-calendar/status");
  },
  authorize() {
    return request<{ authorization_url: string }>("/api/integrations/google-calendar/authorize", {
      method: "POST"
    });
  },
  events(maxResults = 8) {
    return request<{ events: CalendarEvent[] }>(
      `/api/integrations/google-calendar/events?max_results=${encodeURIComponent(maxResults)}`
    );
  },
  disconnect() {
    return request<void>("/api/integrations/google-calendar", { method: "DELETE" });
  }
};
