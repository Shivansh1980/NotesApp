import { beforeEach, describe, expect, it } from "vitest";

import type { PlannerTask } from "../types/planner.types";
import {
  addMinutesToDateTime,
  calculateTaskReminders,
  combineDateAndTime,
  findScheduleConflict,
  readReminderLedger,
  rememberReminder,
  remainingTimeCountdown,
  statusTransitionPatch,
  suggestedTaskStartTime,
  timeInputValue
} from "./plannerUtils";

function task(overrides: Partial<PlannerTask> = {}): PlannerTask {
  return {
    id: "task-1",
    workspace_id: "workspace-1",
    user_id: "user-1",
    series_id: null,
    title: "Deep work",
    description: "",
    plan_date: "2026-09-01",
    start_time: "2026-09-01T10:00:00.000Z",
    end_time: "2026-09-01T11:00:00.000Z",
    status: "todo",
    category: "work",
    priority: "medium",
    reminders_enabled: true,
    reminder_minutes_before: 10,
    end_warning_minutes: 5,
    notify_at_end: true,
    recurrence: "none",
    recurrence_days: [],
    position: 0,
    is_active: false,
    is_paused: false,
    paused_at: null,
    total_paused_seconds: 0,
    created_at: "2026-08-31T10:00:00.000Z",
    updated_at: "2026-08-31T10:00:00.000Z",
    ...overrides
  };
}

describe("planner reminders", () => {
  beforeEach(() => localStorage.clear());

  it("calculates start, five-minute, and end reminders", () => {
    const reminders = calculateTaskReminders(task());
    expect(reminders.map((item) => item.kind)).toEqual(["start", "ending", "ended"]);
    expect(reminders[1]?.notifyAt).toBe(new Date("2026-09-01T10:55:00.000Z").getTime());
  });

  it("recalculates identifiers after rescheduling and cancels reminders on completion", () => {
    const original = calculateTaskReminders(task());
    const rescheduled = calculateTaskReminders(
      task({ end_time: "2026-09-01T12:00:00.000Z", updated_at: "2026-08-31T11:00:00.000Z" })
    );
    expect(rescheduled[1]?.notifyAt).toBe(new Date("2026-09-01T11:55:00.000Z").getTime());
    expect(rescheduled[1]?.id).not.toBe(original[1]?.id);
    expect(calculateTaskReminders(task({ status: "completed" }))).toEqual([]);
  });

  it("persists fired reminders so restoring the app cannot duplicate them", () => {
    rememberReminder("task-1:ending");
    expect(readReminderLedger()).toEqual(new Set(["task-1:ending"]));
  });
});

describe("planner status transitions", () => {
  it("activates the first in-progress task and always clears active state on completion", () => {
    expect(statusTransitionPatch(task(), "in_progress", false)).toEqual({
      status: "in_progress",
      is_active: true,
      is_paused: false
    });
    expect(statusTransitionPatch(task({ is_active: true }), "completed", true)).toEqual({
      status: "completed",
      is_active: false,
      is_paused: false
    });
  });
});

describe("planner focus countdown", () => {
  it("shows a live second-level countdown and overdue state", () => {
    const end = new Date("2026-09-01T10:01:05.000Z");
    const countdownTask = task({ end_time: end.toISOString() });

    expect(remainingTimeCountdown(countdownTask, new Date("2026-09-01T10:00:00.000Z").getTime())).toBe("01:05 remaining");
    expect(remainingTimeCountdown(countdownTask, new Date("2026-09-01T10:01:10.000Z").getTime())).toBe("00:05 overdue");
  });

  it("freezes at the paused timestamp", () => {
    const countdownTask = task({
      end_time: "2026-09-01T11:00:00.000Z",
      is_paused: true,
      paused_at: "2026-09-01T10:42:30.000Z"
    });

    expect(remainingTimeCountdown(countdownTask, new Date("2026-09-01T10:59:00.000Z").getTime())).toBe("17:30 paused");
  });
});

describe("planner scheduling", () => {
  it("rounds a new task up to the next quarter hour", () => {
    const start = suggestedTaskStartTime("2026-09-01", [], {
      now: new Date(2026, 8, 1, 13, 46, 12)
    });

    expect(start).toBe("14:00");
    expect(timeInputValue(addMinutesToDateTime("2026-09-01", start, 15))).toBe("14:15");
  });

  it("starts after the end of an overlapping task", () => {
    const existing = task({
      start_time: combineDateAndTime("2026-09-01", "14:00"),
      end_time: combineDateAndTime("2026-09-01", "14:30")
    });

    expect(suggestedTaskStartTime("2026-09-01", [existing], {
      now: new Date(2026, 8, 1, 13, 46)
    })).toBe("14:30");
  });

  it("walks through chained overlaps to find the first available slot", () => {
    const tasks = [
      task({
        id: "task-a",
        start_time: combineDateAndTime("2026-09-01", "14:00"),
        end_time: combineDateAndTime("2026-09-01", "14:20")
      }),
      task({
        id: "task-b",
        start_time: combineDateAndTime("2026-09-01", "14:15"),
        end_time: combineDateAndTime("2026-09-01", "14:50")
      })
    ];

    expect(suggestedTaskStartTime("2026-09-01", tasks, {
      requestedStart: "14:00",
      durationMinutes: 15
    })).toBe("15:00");
  });

  it("detects overlaps while allowing adjacent tasks", () => {
    const existing = task({
      start_time: combineDateAndTime("2026-09-01", "10:00"),
      end_time: combineDateAndTime("2026-09-01", "10:30")
    });

    expect(findScheduleConflict(
      [existing],
      combineDateAndTime("2026-09-01", "10:15"),
      combineDateAndTime("2026-09-01", "10:45")
    )?.id).toBe(existing.id);
    expect(findScheduleConflict(
      [existing],
      combineDateAndTime("2026-09-01", "10:30"),
      combineDateAndTime("2026-09-01", "10:45")
    )).toBeNull();
  });
});
