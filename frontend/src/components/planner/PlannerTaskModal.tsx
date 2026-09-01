import { Bell, CalendarDays, Check, Clock3, Repeat2, Trash2, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { IconButton } from "../common/IconButton";
import { PlannerCategoryIcon, PLANNER_CATEGORIES } from "./PlannerCategoryIcon";
import type {
  PlannerCategory,
  PlannerPriority,
  PlannerRecurrence,
  PlannerTask,
  PlannerTaskStatus
} from "../../types/planner.types";
import {
  addMinutesToDateTime,
  combineDateAndTime,
  dateKey,
  findScheduleConflict,
  minutesBetween,
  PLANNER_DEFAULT_DURATION_MINUTES,
  PLANNER_DURATION_PRESETS,
  timeInputValue
} from "../../utils/plannerUtils";

export type PlannerTaskFormValue = {
  title: string;
  description: string;
  plan_date: string;
  start_time: string | null;
  end_time: string | null;
  status: PlannerTaskStatus;
  category: PlannerCategory;
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
};

type PlannerTaskModalProps = {
  open: boolean;
  task: PlannerTask | null;
  date: string;
  suggestedStart?: string | null;
  suggestedDuration?: number;
  suggestedStatus?: PlannerTaskStatus;
  existingTasks?: PlannerTask[];
  pending?: boolean;
  onClose: () => void;
  onSave: (value: PlannerTaskFormValue) => void;
  onDelete: (taskId: string) => void;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function endTimeLabel(value: string, planDate: string): string {
  const end = new Date(value);
  const label = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return dateKey(end) === planDate ? label : `${label} next day`;
}

export function PlannerTaskModal({
  open,
  task,
  date,
  suggestedStart,
  suggestedDuration = PLANNER_DEFAULT_DURATION_MINUTES,
  suggestedStatus = "todo",
  existingTasks = [],
  pending = false,
  onClose,
  onSave,
  onDelete
}: PlannerTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [planDate, setPlanDate] = useState(date);
  const [scheduled, setScheduled] = useState(Boolean(suggestedStart));
  const [startTime, setStartTime] = useState(suggestedStart ?? "09:00");
  const [durationMinutes, setDurationMinutes] = useState(suggestedDuration);
  const [status, setStatus] = useState<PlannerTaskStatus>("todo");
  const [category, setCategory] = useState<PlannerCategory>("work");
  const [priority, setPriority] = useState<PlannerPriority>("medium");
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderBefore, setReminderBefore] = useState<number | null>(10);
  const [endWarning, setEndWarning] = useState(5);
  const [notifyAtEnd, setNotifyAtEnd] = useState(false);
  const [recurrence, setRecurrence] = useState<PlannerRecurrence>("none");
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    const nextStart = task ? timeInputValue(task.start_time) : suggestedStart ?? "09:00";
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setPlanDate(task?.plan_date ?? date);
    setScheduled(Boolean(task?.start_time || suggestedStart));
    setStartTime(nextStart || "09:00");
    setDurationMinutes(task
      ? Math.max(1, minutesBetween(task.start_time, task.end_time) || suggestedDuration)
      : suggestedDuration);
    setStatus(task?.status ?? suggestedStatus);
    setCategory((task?.category as PlannerCategory) ?? "work");
    setPriority(task?.priority ?? "medium");
    setRemindersEnabled(task?.reminders_enabled ?? false);
    setReminderBefore(task?.reminder_minutes_before ?? 10);
    setEndWarning(task?.end_warning_minutes ?? 5);
    setNotifyAtEnd(task?.notify_at_end ?? false);
    setRecurrence(task?.recurrence ?? "none");
    setRecurrenceDays(task?.recurrence_days ?? []);
    setError(null);
    setConfirmDelete(false);
  }, [date, open, suggestedDuration, suggestedStart, suggestedStatus, task]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const toggleReminders = async (enabled: boolean) => {
    setRemindersEnabled(enabled);
    if (enabled && "Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Give this task a clear title.");
      return;
    }
    if (scheduled && (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 12 * 60)) {
      setError("Duration must be between 1 minute and 12 hours.");
      return;
    }
    const start = scheduled ? combineDateAndTime(planDate, startTime) : null;
    const end = scheduled ? addMinutesToDateTime(planDate, startTime, durationMinutes) : null;
    const conflict = start && end ? findScheduleConflict(existingTasks, start, end, task?.id) : null;
    if (conflict) {
      setError(`This time overlaps "${conflict.title}". Choose another start time or duration.`);
      return;
    }
    if (recurrence === "custom" && recurrenceDays.length === 0) {
      setError("Choose at least one repeat day.");
      return;
    }
    onSave({
      title: cleanTitle,
      description: description.trim(),
      plan_date: planDate,
      start_time: start,
      end_time: end,
      status,
      category,
      priority,
      reminders_enabled: remindersEnabled && scheduled,
      reminder_minutes_before: remindersEnabled && scheduled ? reminderBefore : null,
      end_warning_minutes: endWarning,
      notify_at_end: remindersEnabled && scheduled && notifyAtEnd,
      recurrence,
      recurrence_days: recurrence === "custom" ? recurrenceDays : [],
      position: task?.position ?? 0,
      is_active: task?.is_active ?? false,
      is_paused: task?.is_paused ?? false
    });
  };

  const calculatedEnd = scheduled && durationMinutes > 0
    ? addMinutesToDateTime(planDate, startTime, durationMinutes)
    : null;

  return (
    <div className="planner-modal-backdrop" onMouseDown={onClose}>
      <section
        className="planner-task-modal"
        role="dialog"
        aria-modal="true"
        aria-label={task ? "Edit planner task" : "Add planner task"}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="planner-modal-kicker">{task ? "Task details" : "Plan something"}</span>
            <h2>{task ? "Edit task" : "New task"}</h2>
          </div>
          <IconButton label="Close task editor" onClick={onClose}><X size={18} /></IconButton>
        </header>

        <form noValidate onSubmit={submit}>
          <label className="planner-field planner-title-field">
            <span>Task title</span>
            <input autoFocus value={title} maxLength={200} placeholder="What needs your attention?" onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="planner-field">
            <span>Notes</span>
            <textarea value={description} rows={3} maxLength={5000} placeholder="Add context, links, or a useful outcome..." onChange={(event) => setDescription(event.target.value)} />
          </label>

          <div className="planner-form-row three">
            <label className="planner-field">
              <span><CalendarDays size={14} />Date</span>
              <input type="date" value={planDate} onChange={(event) => setPlanDate(event.target.value)} />
            </label>
            <label className="planner-field">
              <span>Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as PlannerTaskStatus)}>
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label className="planner-field">
              <span>Priority</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value as PlannerPriority)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <section className="planner-form-section">
            <div className="planner-section-toggle">
              <div><Clock3 size={16} /><span><strong>Schedule</strong><small>Choose a start time and duration</small></span></div>
              <button className={`switch-control ${scheduled ? "on" : ""}`} type="button" role="switch" aria-label="Schedule task" aria-checked={scheduled} onClick={() => setScheduled((value) => !value)}><span /></button>
            </div>
            {scheduled ? (
              <div className="planner-schedule-fields indented">
                <label className="planner-field"><span>Starts</span><input type="time" step={900} value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
                <div className="planner-duration-field">
                  <span>Duration</span>
                  <div className="planner-duration-controls">
                    <div className="planner-duration-presets" aria-label="Task duration presets">
                      {PLANNER_DURATION_PRESETS.map((minutes) => (
                        <button
                          className={durationMinutes === minutes ? "selected" : ""}
                          type="button"
                          key={minutes}
                          aria-pressed={durationMinutes === minutes}
                          onClick={() => setDurationMinutes(minutes)}
                        >
                          {minutes}m
                        </button>
                      ))}
                    </div>
                    <label className="planner-custom-duration">
                      <input
                        aria-label="Custom duration in minutes"
                        type="number"
                        min={1}
                        max={720}
                        step={1}
                        value={durationMinutes}
                        onChange={(event) => setDurationMinutes(Number(event.target.value))}
                      />
                      <span>min</span>
                    </label>
                  </div>
                </div>
                {calculatedEnd ? (
                  <div className="planner-calculated-end" aria-live="polite">
                    <Clock3 size={14} />Ends at <strong>{endTimeLabel(calculatedEnd, planDate)}</strong>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <fieldset className="planner-category-picker">
            <legend>Category</legend>
            <div>
              {PLANNER_CATEGORIES.map((item) => (
                <button className={category === item.value ? "selected" : ""} type="button" key={item.value} aria-pressed={category === item.value} onClick={() => setCategory(item.value)}>
                  <PlannerCategoryIcon category={item.value} size={16} />{item.label}{category === item.value ? <Check size={13} /> : null}
                </button>
              ))}
            </div>
          </fieldset>

          <section className="planner-form-section">
            <div className="planner-section-toggle">
              <div><Bell size={16} /><span><strong>Reminders</strong><small>Start, ending, and completion alerts</small></span></div>
              <button className={`switch-control ${remindersEnabled ? "on" : ""}`} disabled={!scheduled} type="button" role="switch" aria-label="Enable task reminders" aria-checked={remindersEnabled} onClick={() => void toggleReminders(!remindersEnabled)}><span /></button>
            </div>
            {remindersEnabled && scheduled ? (
              <div className="planner-reminder-settings indented">
                <label className="planner-field"><span>Before start</span><select value={reminderBefore ?? ""} onChange={(event) => setReminderBefore(event.target.value ? Number(event.target.value) : null)}><option value="">Off</option><option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min</option><option value="30">30 min</option></select></label>
                <label className="planner-field"><span>Ending warning</span><select value={endWarning} onChange={(event) => setEndWarning(Number(event.target.value))}><option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min</option></select></label>
                <label className="planner-checkbox"><input type="checkbox" checked={notifyAtEnd} onChange={(event) => setNotifyAtEnd(event.target.checked)} /><span>Notify when task ends</span></label>
              </div>
            ) : null}
          </section>

          <section className="planner-form-section">
            <div className="planner-section-heading"><Repeat2 size={16} /><strong>Repeat</strong></div>
            <div className="planner-form-row two indented">
              <label className="planner-field"><span>Frequency</span><select value={recurrence} onChange={(event) => setRecurrence(event.target.value as PlannerRecurrence)}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option><option value="custom">Custom days</option></select></label>
            </div>
            {recurrence === "custom" ? (
              <div className="planner-weekday-picker indented">
                {WEEKDAYS.map((day, index) => <button className={recurrenceDays.includes(index) ? "selected" : ""} type="button" key={day} aria-pressed={recurrenceDays.includes(index)} onClick={() => setRecurrenceDays((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])}>{day}</button>)}
              </div>
            ) : null}
          </section>

          {error ? <p className="planner-form-error" role="alert">{error}</p> : null}
          <footer>
            {task ? (
              confirmDelete ? <button className="planner-danger-button" type="button" disabled={pending} onClick={() => onDelete(task.id)}>Confirm delete</button> : <button className="planner-delete-button" type="button" onClick={() => setConfirmDelete(true)}><Trash2 size={15} />Delete</button>
            ) : <span />}
            <div><button type="button" onClick={onClose}>Cancel</button><button className="planner-primary-button" type="submit" disabled={pending}><Check size={16} />{pending ? "Saving..." : "Save task"}</button></div>
          </footer>
        </form>
      </section>
    </div>
  );
}
