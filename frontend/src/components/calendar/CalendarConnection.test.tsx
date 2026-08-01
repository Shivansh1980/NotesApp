import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { calendarApi } from "../../api/calendar.api";
import type { CalendarEvent } from "../../types/calendar.types";
import { CalendarConnection } from "./CalendarConnection";

vi.mock("../../api/calendar.api", () => ({
  calendarApi: {
    status: vi.fn(),
    authorize: vi.fn(),
    events: vi.fn(),
    disconnect: vi.fn()
  }
}));

function makeEvents(count: number): CalendarEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `event-${index}`,
    title: `Calendar event ${index + 1}`,
    start: new Date(Date.UTC(2027, 0, index + 1, 10)).toISOString(),
    end: new Date(Date.UTC(2027, 0, index + 1, 11)).toISOString(),
    all_day: false,
    html_link: `https://calendar.google.com/event?event=${index}`,
    location: null
  }));
}

function CalendarHarness() {
  const [managerOpen, setManagerOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setManagerOpen((open) => !open)}>
        {managerOpen ? "Close manager" : "Open manager"}
      </button>
      <CalendarConnection compact />
      {managerOpen ? <CalendarConnection /> : null}
    </>
  );
}

describe("CalendarConnection", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps OAuth disabled until the server has Google credentials", async () => {
    vi.mocked(calendarApi.status).mockResolvedValue({ configured: false, connected: false, provider: "google" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <CalendarConnection />
      </QueryClientProvider>
    );

    const connect = await screen.findByRole("button", { name: /Connect your calendar/ });
    expect(connect).toBeDisabled();
    expect(screen.getByText("Google Calendar needs administrator configuration.")).toBeInTheDocument();
  });

  it("keeps sidebar and manager event caches bounded and independent", async () => {
    vi.mocked(calendarApi.status).mockResolvedValue({ configured: true, connected: true, provider: "google" });
    vi.mocked(calendarApi.events).mockImplementation(async (maxResults) => ({ events: makeEvents(maxResults ?? 25) }));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <CalendarHarness />
      </QueryClientProvider>
    );

    const sidebarEvents = await screen.findByTestId("calendar-sidebar-events");
    expect(await within(sidebarEvents).findAllByRole("button")).toHaveLength(5);
    await waitFor(() => expect(calendarApi.events).toHaveBeenCalledTimes(1));
    expect(calendarApi.events).toHaveBeenLastCalledWith(5);

    fireEvent.click(screen.getByRole("button", { name: "Open manager" }));
    const managedEvents = await screen.findByTestId("calendar-manage-events");
    expect(await within(managedEvents).findAllByRole("button")).toHaveLength(25);
    await waitFor(() => expect(calendarApi.events).toHaveBeenCalledTimes(2));
    expect(calendarApi.events).toHaveBeenLastCalledWith(25);
    expect(within(sidebarEvents).getAllByRole("button")).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "Close manager" }));
    expect(screen.queryByTestId("calendar-manage-events")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open manager" }));

    await screen.findByTestId("calendar-manage-events");
    await waitFor(() => expect(calendarApi.events).toHaveBeenCalledTimes(2));
    expect(within(screen.getByTestId("calendar-sidebar-events")).getAllByRole("button")).toHaveLength(5);
  });
});
