import type {
  PlannerReminder,
  PlannerTask,
  PlannerTaskStatus,
  PlannerTaskUpdate
} from "../types/planner.types";

export const PLANNER_DAY_START_HOUR = 6;
export const PLANNER_DAY_END_HOUR = 23;
export const PLANNER_SLOT_MINUTES = 30;

export function dateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(value: string, amount: number): string {
  const next = dateFromKey(value);
  next.setDate(next.getDate() + amount);
  return dateKey(next);
}

export function combineDateAndTime(day: string, time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const value = dateFromKey(day);
  value.setHours(hours, minutes, 0, 0);
  return value.toISOString();
}

export function timeInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function minutesBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const duration = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(duration / 60_000));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function formatTaskTime(task: Pick<PlannerTask, "start_time" | "end_time">): string {
  if (!task.start_time || !task.end_time) return "Unscheduled";
  const options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${new Date(task.start_time).toLocaleTimeString([], options)} - ${new Date(task.end_time).toLocaleTimeString([], options)}`;
}

export function plannerProgress(task: PlannerTask, now = Date.now()): number {
  if (!task.start_time || !task.end_time) return 0;
  if (task.status === "completed") return 100;
  const start = new Date(task.start_time).getTime();
  const end = new Date(task.end_time).getTime();
  if (end <= start) return 0;
  if (task.is_paused && task.paused_at) now = new Date(task.paused_at).getTime();
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

export function remainingTimeLabel(task: PlannerTask, now = Date.now()): string {
  if (task.is_paused) return "Paused";
  if (!task.end_time) return "No end time";
  const remaining = Math.ceil((new Date(task.end_time).getTime() - now) / 60_000);
  if (remaining < 0) return `${Math.abs(remaining)} min overdue`;
  if (remaining === 0) return "Ending now";
  return `${formatDuration(remaining)} remaining`;
}

export function statusTransitionPatch(
  task: PlannerTask,
  status: PlannerTaskStatus,
  hasActiveTask: boolean
): PlannerTaskUpdate {
  if (status === "completed") return { status, is_active: false, is_paused: false };
  if (status === "in_progress") {
    return { status, is_active: !hasActiveTask || task.is_active, is_paused: false };
  }
  return { status, is_active: false, is_paused: false };
}

export function calculateTaskReminders(task: PlannerTask): PlannerReminder[] {
  if (!task.reminders_enabled || task.status === "completed" || !task.start_time || !task.end_time) return [];

  const start = new Date(task.start_time).getTime();
  const end = new Date(task.end_time).getTime();
  const version = new Date(task.updated_at).getTime();
  const reminders: PlannerReminder[] = [];
  const create = (kind: PlannerReminder["kind"], notifyAt: number, title: string, body: string) => ({
    id: `${task.id}:${version}:${kind}:${notifyAt}`,
    taskId: task.id,
    kind,
    notifyAt,
    title,
    body
  });

  if (task.reminder_minutes_before !== null) {
    reminders.push(
      create(
        "start",
        start - task.reminder_minutes_before * 60_000,
        `${task.title} starts soon`,
        `Starts in ${task.reminder_minutes_before} minutes.`
      )
    );
  }
  reminders.push(
    create(
      "ending",
      end - task.end_warning_minutes * 60_000,
      `${task.end_warning_minutes} minutes remaining`,
      `${task.title} is almost finished.`
    )
  );
  if (task.notify_at_end) {
    reminders.push(create("ended", end, `${task.title} has ended`, "Mark it complete or extend the task."));
  }
  return reminders;
}

const REMINDER_LEDGER_KEY = "notes.planner.reminders.v1";

export function readReminderLedger(storage: Pick<Storage, "getItem"> = localStorage): Set<string> {
  try {
    const value = JSON.parse(storage.getItem(REMINDER_LEDGER_KEY) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

export function rememberReminder(id: string, storage: Pick<Storage, "getItem" | "setItem"> = localStorage): void {
  const ledger = [...new Set([...readReminderLedger(storage), id])].slice(-500);
  storage.setItem(REMINDER_LEDGER_KEY, JSON.stringify(ledger));
}
