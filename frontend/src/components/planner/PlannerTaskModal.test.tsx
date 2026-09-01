import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlannerTaskModal } from "./PlannerTaskModal";

function renderModal(onSave = vi.fn()) {
  render(
    <PlannerTaskModal
      open
      task={null}
      date="2026-09-01"
      onClose={vi.fn()}
      onSave={onSave}
      onDelete={vi.fn()}
    />
  );
  return onSave;
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

  it("rejects an end time before the start time", () => {
    const onSave = renderModal();
    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "Focused work" } });
    fireEvent.click(screen.getByRole("switch", { name: "Schedule task" }));
    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "11:00" } });
    fireEvent.change(screen.getByLabelText("Ends"), { target: { value: "10:45" } });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));

    expect(screen.getByRole("alert")).toHaveTextContent("End time must be after the start time");
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
