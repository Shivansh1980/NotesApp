import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, GripVertical, Maximize2, Minimize2, Plus } from "lucide-react";
import { PointerEvent, useMemo, useState } from "react";

import { PlannerCategoryIcon, plannerCategoryLabel } from "./PlannerCategoryIcon";
import type { PlannerTask } from "../../types/planner.types";
import {
  formatDuration,
  minutesBetween,
  PLANNER_DAY_END_HOUR,
  PLANNER_DAY_START_HOUR,
  PLANNER_SLOT_MINUTES
} from "../../utils/plannerUtils";

const PIXELS_PER_HOUR = 48;

type PlannerScheduleProps = {
  date: string;
  tasks: PlannerTask[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onAddTask: (startTime?: string) => void;
  onEditTask: (task: PlannerTask) => void;
  onResizeTask: (task: PlannerTask, durationMinutes: number) => void;
};

function minutesFromStart(value: string): number {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes() - PLANNER_DAY_START_HOUR * 60;
}

function slotTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatSlotLabel(totalMinutes: number): string {
  const value = new Date(2000, 0, 1, Math.floor(totalMinutes / 60), totalMinutes % 60);
  return value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function TimelineSlot({ date, minutes, onAddTask }: { date: string; minutes: number; onAddTask: (time: string) => void }) {
  const time = slotTime(minutes);
  const { setNodeRef, isOver } = useDroppable({
    id: `planner-slot:${date}:${time}`,
    data: { kind: "schedule", date, time }
  });
  return (
    <button
      ref={setNodeRef}
      className={`planner-time-slot ${isOver ? "is-over" : ""}`}
      style={{ top: `${((minutes - PLANNER_DAY_START_HOUR * 60) / 60) * PIXELS_PER_HOUR}px` }}
      type="button"
      aria-label={`Add task at ${formatSlotLabel(minutes)}`}
      onClick={() => onAddTask(time)}
    >
      {minutes % 60 === 0 ? <span>{formatSlotLabel(minutes)}</span> : null}
    </button>
  );
}

function ScheduledTask({
  task,
  onEdit,
  onResize
}: {
  task: PlannerTask;
  onEdit: () => void;
  onResize: (minutes: number) => void;
}) {
  const initialDuration = Math.max(30, minutesBetween(task.start_time, task.end_time));
  const [previewDuration, setPreviewDuration] = useState<number | null>(null);
  const duration = previewDuration ?? initialDuration;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `schedule-task:${task.id}`,
    data: { kind: "task", taskId: task.id, source: "schedule" }
  });
  const top = Math.max(0, (minutesFromStart(task.start_time as string) / 60) * PIXELS_PER_HOUR);
  const height = Math.max(44, (duration / 60) * PIXELS_PER_HOUR - 4);

  const beginResize = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const originY = event.clientY;
    let latest = initialDuration;
    const move = (moveEvent: globalThis.PointerEvent) => {
      const change = Math.round(((moveEvent.clientY - originY) / PIXELS_PER_HOUR) * 4) * 15;
      latest = Math.max(15, Math.min(12 * 60, initialDuration + change));
      setPreviewDuration(latest);
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      setPreviewDuration(null);
      if (latest !== initialDuration) onResize(latest);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  };

  return (
    <article
      ref={setNodeRef}
      className={`planner-scheduled-task category-${task.category} ${task.status === "completed" ? "completed" : ""} ${isDragging ? "dragging" : ""}`}
      style={{ top, height, transform: CSS.Translate.toString(transform) }}
      onClick={onEdit}
      data-task-id={task.id}
    >
      <button className="planner-drag-handle" type="button" aria-label={`Move ${task.title}`} {...listeners} {...attributes} onClick={(event) => event.stopPropagation()}><GripVertical size={15} /></button>
      <span className="planner-schedule-icon"><PlannerCategoryIcon category={task.category} size={20} /></span>
      <span className="planner-schedule-copy"><strong>{task.title}</strong><small>{formatDuration(duration)}</small></span>
      <span className="planner-category-chip">{plannerCategoryLabel(task.category)}</span>
      <button className="planner-resize-handle" type="button" aria-label={`Resize ${task.title}`} onPointerDown={beginResize} onClick={(event) => event.stopPropagation()} />
    </article>
  );
}

export function PlannerSchedule({
  date,
  tasks,
  expanded,
  onToggleExpanded,
  onAddTask,
  onEditTask,
  onResizeTask
}: PlannerScheduleProps) {
  const slots = useMemo(() => {
    const result: number[] = [];
    for (let value = PLANNER_DAY_START_HOUR * 60; value <= PLANNER_DAY_END_HOUR * 60; value += PLANNER_SLOT_MINUTES) result.push(value);
    return result;
  }, []);
  const scheduledTasks = tasks
    .filter((task) => task.start_time && task.end_time)
    .sort((left, right) => new Date(left.start_time as string).getTime() - new Date(right.start_time as string).getTime());
  const timelineHeight = (PLANNER_DAY_END_HOUR - PLANNER_DAY_START_HOUR) * PIXELS_PER_HOUR + 30;

  return (
    <section className={`planner-panel planner-schedule-panel ${expanded ? "planner-panel-expanded" : ""}`} aria-labelledby="planner-schedule-heading">
      <header className="planner-panel-header">
        <div><CalendarDays size={18} /><h2 id="planner-schedule-heading">Today&apos;s schedule</h2></div>
        <button className="planner-icon-button" type="button" aria-label={expanded ? "Exit full schedule" : "Expand schedule"} title={expanded ? "Exit full screen" : "Expand"} onClick={onToggleExpanded}>{expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
      </header>
      <div className="planner-timeline-scroll">
        <div className="planner-timeline" style={{ height: timelineHeight }}>
          <div className="planner-timeline-line" />
          {slots.map((minutes) => <TimelineSlot key={minutes} date={date} minutes={minutes} onAddTask={onAddTask} />)}
          {scheduledTasks.map((task) => <ScheduledTask key={task.id} task={task} onEdit={() => onEditTask(task)} onResize={(minutes) => onResizeTask(task, minutes)} />)}
          {!scheduledTasks.length ? <div className="planner-schedule-empty"><CalendarDays size={22} /><strong>Your day is open</strong><span>Click a time to add your first block.</span></div> : null}
        </div>
      </div>
      <button className="planner-add-inline" type="button" onClick={() => onAddTask()}><Plus size={15} />Add time block</button>
    </section>
  );
}
