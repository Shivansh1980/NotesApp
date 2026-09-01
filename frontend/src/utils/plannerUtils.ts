import type {
  PlannerReminder,
  PlannerTask,
  PlannerTaskStatus,
  PlannerTaskUpdate
} from "../types/planner.types";

export const PLANNER_DAY_START_HOUR = 6;
export const PLANNER_DAY_END_HOUR = 23;
export const PLANNER_SLOT_MINUTES = 30;
export const PLANNER_DEFAULT_DURATION_MINUTES = 15;
export const PLANNER_TIME_INCREMENT_MINUTES = 15;
export const PLANNER_DURATION_PRESETS = [15, 30, 45, 60] as const;

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

export function addMinutesToDateTime(day: string, time: string, durationMinutes: number): string {
  const start = new Date(combineDateAndTime(day, time));
  start.setMinutes(start.getMinutes() + durationMinutes);
  return start.toISOString();
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

function clockMinutes(value: Date): number {
  return value.getHours() * 60 + value.getMinutes();
}

function timeFromMinutes(value: number): string {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, value));
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function roundUpToIncrement(value: number, increment: number): number {
  return Math.ceil(value / increment) * increment;
}

type ScheduledInterval = {
  start: number;
  end: number;
};

function scheduledIntervals(tasks: PlannerTask[], day: string, excludeTaskId?: string): ScheduledInterval[] {
  const dayStart = dateFromKey(day).getTime();
  const dayEnd = addDays(day, 1);
  const dayEndTime = dateFromKey(dayEnd).getTime();

  return tasks
    .filter((task) => task.id !== excludeTaskId && task.start_time && task.end_time)
    .map((task) => ({
      start: (new Date(task.start_time as string).getTime() - dayStart) / 60_000,
      end: (new Date(task.end_time as string).getTime() - dayStart) / 60_000
    }))
    .filter((interval) => interval.end > 0 && interval.start < (dayEndTime - dayStart) / 60_000)
    .map((interval) => ({
      start: Math.max(0, interval.start),
      end: Math.min(24 * 60, interval.end)
    }))
    .sort((left, right) => left.start - right.start);
}

function findOpenSlot(
  intervals: ScheduledInterval[],
  rangeStart: number,
  rangeEnd: number,
  durationMinutes: number
): number | null {
  let candidate = roundUpToIncrement(rangeStart, PLANNER_TIME_INCREMENT_MINUTES);

  for (const interval of intervals) {
    if (interval.end <= candidate) continue;
    if (candidate + durationMinutes <= interval.start) break;
    if (candidate < interval.end && candidate + durationMinutes > interval.start) {
      candidate = roundUpToIncrement(interval.end, PLANNER_TIME_INCREMENT_MINUTES);
    }
  }

  return candidate + durationMinutes <= rangeEnd ? candidate : null;
}

export function suggestedTaskStartTime(
  day: string,
  tasks: PlannerTask[],
  options: {
    now?: Date;
    requestedStart?: string | null;
    durationMinutes?: number;
    excludeTaskId?: string;
  } = {}
): string {
  const now = options.now ?? new Date();
  const durationMinutes = Math.max(1, options.durationMinutes ?? PLANNER_DEFAULT_DURATION_MINUTES);
  const requested = options.requestedStart
    ? clockMinutes(new Date(combineDateAndTime(day, options.requestedStart)))
    : null;
  const preferred = requested ?? (day === dateKey(now)
    ? roundUpToIncrement(clockMinutes(now), PLANNER_TIME_INCREMENT_MINUTES)
    : 9 * 60);
  const latestStart = 24 * 60 - durationMinutes;
  const boundedPreferred = Math.min(preferred, latestStart);
  const intervals = scheduledIntervals(tasks, day, options.excludeTaskId);
  const afterPreferred = findOpenSlot(intervals, boundedPreferred, 24 * 60, durationMinutes);

  if (afterPreferred !== null) return timeFromMinutes(afterPreferred);

  const beforePreferred = findOpenSlot(
    intervals,
    PLANNER_DAY_START_HOUR * 60,
    boundedPreferred,
    durationMinutes
  );
  return timeFromMinutes(beforePreferred ?? boundedPreferred);
}

export function findScheduleConflict(
  tasks: PlannerTask[],
  startTime: string,
  endTime: string,
  excludeTaskId?: string
): PlannerTask | null {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();

  return tasks.find((task) => {
    if (task.id === excludeTaskId || !task.start_time || !task.end_time) return false;
    const taskStart = new Date(task.start_time).getTime();
    const taskEnd = new Date(task.end_time).getTime();
    return start < taskEnd && end > taskStart;
  }) ?? null;
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

export function remainingTimeCountdown(task: PlannerTask, now = Date.now()): string {
  if (!task.end_time) return "No end time";
  const effectiveNow = task.is_paused && task.paused_at ? new Date(task.paused_at).getTime() : now;
  const difference = new Date(task.end_time).getTime() - effectiveNow;
  const totalSeconds = Math.max(0, Math.ceil(Math.abs(difference) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  if (task.is_paused) return `${clock} paused`;
  return difference < 0 ? `${clock} overdue` : `${clock} remaining`;
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
