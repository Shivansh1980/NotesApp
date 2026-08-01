import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ExternalLink, Link2Off, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

import { calendarApi } from "../../api/calendar.api";
import {
  CALENDAR_MANAGE_EVENT_LIMIT,
  CALENDAR_SIDEBAR_EVENT_LIMIT,
  googleCalendarQueryKeys,
  useGoogleCalendarEvents,
  useGoogleCalendarStatus
} from "../../hooks/useGoogleCalendar";
import type { CalendarEvent } from "../../types/calendar.types";
import { normalizeUpcomingEvents } from "../../utils/calendarUtils";

type CalendarConnectionProps = {
  compact?: boolean;
};

function formatEventTime(event: CalendarEvent): string {
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return event.all_day ? "All day" : "Upcoming";
  const includeYear = start.getFullYear() !== new Date().getFullYear();
  if (event.all_day) {
    return start.toLocaleDateString([], { month: "short", day: "numeric", year: includeYear ? "numeric" : undefined });
  }
  return start.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit"
  });
}

export function CalendarConnection({ compact = false }: CalendarConnectionProps) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const eventLimit = compact ? CALENDAR_SIDEBAR_EVENT_LIMIT : CALENDAR_MANAGE_EVENT_LIMIT;
  const statusQuery = useGoogleCalendarStatus();
  const eventsQuery = useGoogleCalendarEvents(eventLimit, Boolean(statusQuery.data?.connected));
  const connect = useMutation({
    mutationFn: calendarApi.authorize,
    onSuccess(response) {
      window.location.assign(response.authorization_url);
    },
    onError(error) {
      setMessage(error instanceof Error ? error.message : "Unable to start Google authorization");
    }
  });
  const disconnect = useMutation({
    mutationFn: calendarApi.disconnect,
    onSuccess() {
      setMessage(null);
      queryClient.setQueryData(googleCalendarQueryKeys.status, {
        configured: statusQuery.data?.configured ?? false,
        connected: false,
        provider: "google"
      });
      queryClient.removeQueries({ queryKey: googleCalendarQueryKeys.eventsRoot });
    }
  });

  if (statusQuery.isLoading) {
    return <div className={`calendar-connection ${compact ? "compact" : ""}`}><Loader2 className="spin" size={16} /></div>;
  }

  const status = statusQuery.data;
  if (!status?.connected) {
    return (
      <section className={`calendar-connection ${compact ? "compact" : ""}`}>
        <button
          className="calendar-connect"
          type="button"
          disabled={!status?.configured || connect.isPending}
          onClick={() => connect.mutate()}
        >
          <span className="google-calendar-mark" aria-hidden="true"><CalendarDays size={18} /></span>
          <span>
            <strong>Connect your calendar</strong>
            <small>See upcoming events and open them from your notes.</small>
          </span>
        </button>
        {!status?.configured ? <p className="calendar-message">Google Calendar needs administrator configuration.</p> : null}
        {message ? <p className="calendar-message error">{message}</p> : null}
      </section>
    );
  }

  const events = normalizeUpcomingEvents(eventsQuery.data?.events ?? [], eventLimit);
  return (
    <section
      className={`calendar-connection connected ${compact ? "compact" : ""}`}
      aria-label={compact ? "Sidebar calendar" : "Calendar management"}
    >
      <header>
        <span><CalendarDays size={15} />Upcoming</span>
        <div>
          <button
            type="button"
            aria-label="Refresh calendar"
            title="Refresh calendar"
            disabled={eventsQuery.isFetching}
            onClick={() => eventsQuery.refetch()}
          >
            <RefreshCw className={eventsQuery.isFetching ? "spin" : undefined} size={14} />
          </button>
          {!compact ? (
            <button type="button" aria-label="Disconnect calendar" title="Disconnect calendar" onClick={() => disconnect.mutate()}>
              <Link2Off size={14} />
            </button>
          ) : null}
        </div>
      </header>
      <div className="calendar-event-list" data-testid={compact ? "calendar-sidebar-events" : "calendar-manage-events"}>
        {eventsQuery.isLoading ? <div className="calendar-message">Loading events...</div> : null}
        {eventsQuery.isError ? <div className="calendar-message error">Unable to load events. Reconnect from Settings.</div> : null}
        {!eventsQuery.isLoading && !eventsQuery.isError && !events.length ? <div className="calendar-message">No upcoming events</div> : null}
        {events.map((event) => (
          <button
            className="calendar-event"
            key={event.id}
            type="button"
            disabled={!event.html_link}
            onClick={() => event.html_link && window.open(event.html_link, "_blank", "noopener,noreferrer")}
          >
            <span className="calendar-event-date">{formatEventTime(event)}</span>
            <span className="calendar-event-title">{event.title}</span>
            {event.html_link ? <ExternalLink size={13} /> : null}
          </button>
        ))}
      </div>
      {compact ? (
        <button className="calendar-manage" type="button" onClick={() => document.dispatchEvent(new CustomEvent("notes:open-calendar-settings"))}>
          Manage calendar
        </button>
      ) : (
        <button className="calendar-disconnect" type="button" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
          Disconnect Google Calendar
        </button>
      )}
    </section>
  );
}
