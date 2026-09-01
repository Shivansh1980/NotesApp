import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlannerTaskModal } from "./PlannerTaskModal";
import type { PlannerTask } from "../../types/planner.types";
import { combineDateAndTime, timeInputValue } from "../../utils/plannerUtils";

function renderModal(
  onSave = vi.fn(),
  options: { suggestedStart?: string; existingTasks?: PlannerTask[] } = {}
) {
  render(
    <PlannerTaskModal
      open
      task={null}
      date="2026-09-01"
      suggestedStart={options.suggestedStart}
      existingTasks={options.existingTasks}
      onClose={vi.fn()}
      onSave={onSave}
      onDelete={vi.fn()}
    />
  );
  return onSave;
}

function scheduledTask(): PlannerTask {
  return {
    id: "existing-task",
    workspace_id: "workspace-1",
    user_id: "user-1",
    series_id: null,
    title: "Team sync",
    description: "",
    plan_date: "2026-09-01",
    start_time: combineDateAndTime("2026-09-01", "14:00"),
    end_time: combineDateAndTime("2026-09-01", "14:30"),
    status: "todo",
    category: "work",
    priority: "medium",
    reminders_enabled: false,
    reminder_minutes_before: null,
    end_warning_minutes: 5,
    notify_at_end: false,
    recurrence: "none",
    recurrence_days: [],
    position: 0,
    is_active: false,
    is_paused: false,
    paused_at: null,
    total_paused_seconds: 0,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z"
  };
}

describe("PlannerTaskModal", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("creates an unscheduled task without inventing schedule values", () => {
    const onSave = renderModal();
    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "Review pull request" } });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: "Review pull request",
      plan_date: "2026-09-01",
      start_time: null,
      end_time: null,
      reminders_enabled: false,
      status: "todo"
    }));
  });

  it("calculates the end from the default fifteen-minute duration", () => {
    const onSave = renderModal(vi.fn(), { suggestedStart: "13:45" });
    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "Focused work" } });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));

    const value = onSave.mock.calls[0]?.[0];
    expect(timeInputValue(value.start_time)).toBe("13:45");
    expect(timeInputValue(value.end_time)).toBe("14:00");
  });

  it("supports a custom duration and rejects invalid values", () => {
    const onSave = renderModal(vi.fn(), { suggestedStart: "13:45" });
    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "Focused work" } });
    fireEvent.change(screen.getByLabelText("Custom duration in minutes"), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));

    expect(timeInputValue(onSave.mock.calls[0]?.[0].end_time)).toBe("14:30");

    onSave.mockClear();
    fireEvent.change(screen.getByLabelText("Custom duration in minutes"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Duration must be between 1 minute and 12 hours");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("prevents a manually selected schedule from overlapping another task", () => {
    const onSave = renderModal(vi.fn(), {
      suggestedStart: "14:15",
      existingTasks: [scheduledTask()]
    });
    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "Focused work" } });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));

    expect(screen.getByRole("alert")).toHaveTextContent("overlaps");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("requests browser permission only when reminders are explicitly enabled", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    renderModal();

    expect(requestPermission).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("switch", { name: "Schedule task" }));
    expect(requestPermission).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("switch", { name: "Enable task reminders" }));

    await waitFor(() => expect(requestPermission).toHaveBeenCalledTimes(1));
  });
});
