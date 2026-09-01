import { beforeEach, describe, expect, it } from "vitest";

import type { PlannerTask } from "../types/planner.types";
import {
  calculateTaskReminders,
  readReminderLedger,
  rememberReminder,
  statusTransitionPatch
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
