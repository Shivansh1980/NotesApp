import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "../types/calendar.types";
import { normalizeUpcomingEvents } from "./calendarUtils";

function event(id: string, title: string, start: string): CalendarEvent {
  return {
    id,
    title,
    start,
    end: null,
    all_day: false,
    html_link: null,
    location: null
  };
}

describe("normalizeUpcomingEvents", () => {
  it("deduplicates, sorts by start time, and applies the display limit", () => {
    const normalized = normalizeUpcomingEvents(
      [
        event("later", "Later", "2027-01-03T10:00:00.000Z"),
        event("first", "First", "2027-01-01T10:00:00.000Z"),
        event("first", "Duplicate first", "2027-01-01T10:00:00.000Z"),
        event("middle", "Middle", "2027-01-02T10:00:00.000Z")
      ],
      2
    );

    expect(normalized.map((item) => item.id)).toEqual(["first", "middle"]);
    expect(normalized[0]?.title).toBe("First");
  });
});
