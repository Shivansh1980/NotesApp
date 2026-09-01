export type PlannerTaskStatus = "todo" | "in_progress" | "completed";
export type PlannerPriority = "low" | "medium" | "high";
export type PlannerRecurrence = "none" | "daily" | "weekdays" | "weekly" | "custom";
export type PlannerCategory = "work" | "study" | "gym" | "sleep" | "travel" | "food" | "personal" | "break";

export type PlannerTask = {
  id: string;
  workspace_id: string;
  user_id: string;
  series_id: string | null;
  title: string;
  description: string;
  plan_date: string;
  start_time: string | null;
  end_time: string | null;
  status: PlannerTaskStatus;
  category: string;
  priority: PlannerPriority;
  reminders_enabled: boolean;
  reminder_minutes_before: number | null;
  end_warning_minutes: number;
  notify_at_end: boolean;
  recurrence: PlannerRecurrence;
  recurrence_days: number[];
  position: number;
  is_active: boolean;
  is_paused: boolean;
  paused_at: string | null;
  total_paused_seconds: number;
  created_at: string;
  updated_at: string;
};

export type PlannerTaskCreate = Omit<
  PlannerTask,
  "id" | "user_id" | "series_id" | "paused_at" | "total_paused_seconds" | "created_at" | "updated_at"
>;

export type PlannerTaskUpdate = Partial<
  Omit<PlannerTaskCreate, "workspace_id"> & Pick<PlannerTask, "plan_date">
>;

export type PlannerReminderKind = "start" | "ending" | "ended";

export type PlannerReminder = {
  id: string;
  taskId: string;
  kind: PlannerReminderKind;
  notifyAt: number;
  title: string;
  body: string;
};
