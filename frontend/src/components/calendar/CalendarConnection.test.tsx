import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { calendarApi } from "../../api/calendar.api";
import { CalendarConnection } from "./CalendarConnection";

vi.mock("../../api/calendar.api", () => ({
  calendarApi: {
    status: vi.fn(),
    authorize: vi.fn(),
    events: vi.fn(),
    disconnect: vi.fn()
  }
}));

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
});
