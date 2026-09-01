import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Home, Plus } from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";

import { PlannerBoard } from "./PlannerBoard";
import { PlannerFocus } from "./PlannerFocus";
import { PlannerSchedule } from "./PlannerSchedule";
import { PlannerTaskModal, type PlannerTaskFormValue } from "./PlannerTaskModal";
import { usePlannerMutations, usePlannerTasks } from "../../hooks/usePlanner";
import type { PlannerTask, PlannerTaskCreate, PlannerTaskStatus } from "../../types/planner.types";
import {
  addDays,
  combineDateAndTime,
  dateFromKey,
  dateKey,
  minutesBetween,
  statusTransitionPatch
} from "../../utils/plannerUtils";

type ExpandedPanel = "schedule" | "focus" | "board" | null;

type PlannerViewProps = {
  workspaceId: string | null;
  onNavigateHome: () => void;
};

function friendlyDate(value: string): string {
  return dateFromKey(value).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function PlannerView({ workspaceId, onNavigateHome }: PlannerViewProps) {
  const initialDate = new URLSearchParams(window.location.search).get("date") ?? dateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const tasksQuery = usePlannerTasks(workspaceId, selectedDate, selectedDate);
  const { createTask, updateTask, extendTask, deleteTask, pending } = usePlannerMutations(workspaceId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null);
  const [suggestedStart, setSuggestedStart] = useState<string | null>(null);
  const [suggestedStatus, setSuggestedStatus] = useState<PlannerTaskStatus>("todo");
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );
  const tasks = tasksQuery.data ?? [];
  const activeTask = tasks.find((task) => task.is_active && task.status === "in_progress") ?? null;
  const completed = tasks.filter((task) => task.status === "completed").length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  const openCreate = useCallback((options?: { start?: string | null; status?: PlannerTaskStatus }) => {
    setEditingTask(null);
    setSuggestedStart(options?.start ?? null);
    setSuggestedStatus(options?.status ?? "todo");
    setModalOpen(true);
  }, []);
  const openEdit = useCallback((task: PlannerTask) => {
    setEditingTask(task);
    setSuggestedStart(null);
    setSuggestedStatus(task.status);
    setModalOpen(true);
  }, []);

  const navigateDate = useCallback((date: string) => {
    setSelectedDate(date);
    const url = new URL(window.location.href);
    url.searchParams.set("view", "planner");
    url.searchParams.set("date", date);
    url.searchParams.delete("page");
    window.history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    const openRequestedTask = (event: Event) => {
      const detail = (event as CustomEvent<string | { taskId: string; date: string }>).detail;
      const taskId = typeof detail === "string" ? detail : detail.taskId;
      const taskDate = typeof detail === "string" ? null : detail.date;
      const task = tasks.find((item) => item.id === taskId);
      if (task) {
        openEdit(task);
        return;
      }
      if (taskDate && taskDate !== selectedDate) {
        setPendingTaskId(taskId);
        navigateDate(taskDate);
      }
    };
    document.addEventListener("notes:open-planner-task", openRequestedTask);
    return () => document.removeEventListener("notes:open-planner-task", openRequestedTask);
  }, [navigateDate, openEdit, selectedDate, tasks]);

  useEffect(() => {
    if (!pendingTaskId) return;
    const task = tasks.find((item) => item.id === pendingTaskId);
    if (!task) return;
    setPendingTaskId(null);
    openEdit(task);
  }, [openEdit, pendingTaskId, tasks]);

  const saveTask = (value: PlannerTaskFormValue) => {
    if (editingTask) {
      updateTask.mutate(
        { taskId: editingTask.id, payload: value },
        { onSuccess: () => setModalOpen(false) }
      );
      return;
    }
    createTask.mutate(
      { ...value, workspace_id: workspaceId as string } satisfies PlannerTaskCreate,
      { onSuccess: () => setModalOpen(false) }
    );
  };

  const changeStatus = (task: PlannerTask, status: PlannerTaskStatus) => {
    const hasActive = tasks.some((item) => item.is_active && item.status === "in_progress" && item.id !== task.id);
    updateTask.mutate({ taskId: task.id, payload: statusTransitionPatch(task, status, hasActive) });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const taskId = event.active.data.current?.taskId as string | undefined;
    const task = tasks.find((item) => item.id === taskId);
    const target = event.over?.data.current;
    if (!task || !target) return;
    if (target.kind === "status") {
      changeStatus(task, target.status as PlannerTaskStatus);
      return;
    }
    if (target.kind === "schedule") {
      const duration = Math.max(30, minutesBetween(task.start_time, task.end_time) || 60);
      const start = combineDateAndTime(target.date as string, target.time as string);
      const end = new Date(new Date(start).getTime() + duration * 60_000).toISOString();
      updateTask.mutate({ taskId: task.id, payload: { plan_date: target.date as string, start_time: start, end_time: end } });
    }
  };

  const enableNotifications = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") await Notification.requestPermission();
  };

  const toggleExpanded = (panel: Exclude<ExpandedPanel, null>) => {
    setExpandedPanel((current) => current === panel ? null : panel);
  };

  const dateHeading = useMemo(() => friendlyDate(selectedDate), [selectedDate]);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <main className={`planner-view ${expandedPanel ? "has-expanded-panel" : ""}`}>
        <header className="planner-topbar">
          <div className="planner-topbar-title">
            <button className="planner-mobile-home" type="button" aria-label="Back to Home" onClick={onNavigateHome}><Home size={17} /></button>
            <strong>Planner</strong>
          </div>
          <div className="planner-date-controls" aria-label="Planner date navigation">
            <button type="button" aria-label="Previous day" onClick={() => navigateDate(addDays(selectedDate, -1))}><ChevronLeft size={17} /></button>
            <button type="button" onClick={() => navigateDate(dateKey(new Date()))}>Today</button>
            <button type="button" aria-label="Next day" onClick={() => navigateDate(addDays(selectedDate, 1))}><ChevronRight size={17} /></button>
          </div>
          <div className="planner-topbar-actions">
            <button className="planner-icon-button" type="button" aria-label="Enable reminders" title="Enable reminders" onClick={() => void enableNotifications()}><Bell size={18} /></button>
            <div className="planner-daily-progress" aria-label={`${completed} of ${tasks.length} tasks completed`}>
              <span style={{ "--progress": `${progress * 3.6}deg` } as CSSProperties}><i /></span>
              <strong>{completed} / {tasks.length} done</strong>
            </div>
            <button className="planner-primary-button" type="button" onClick={() => openCreate()}><Plus size={17} />New task</button>
          </div>
        </header>

        <div className="planner-page-heading">
          <div><h1>{dateHeading}</h1><p>{selectedDate === dateKey(new Date()) ? `${greeting()}. Plan your day with intention.` : "Shape this day before it arrives."}</p></div>
          <span><CalendarDays size={16} />{tasks.length} {tasks.length === 1 ? "task" : "tasks"}</span>
        </div>

        {tasksQuery.isLoading ? <div className="planner-loading"><span className="spinner" />Loading your plan...</div> : null}
        {tasksQuery.isError ? <div className="planner-error">Your planner could not be loaded. Please try again.</div> : null}

        {!tasksQuery.isLoading && !tasksQuery.isError ? (
          <div className="planner-dashboard">
            <PlannerSchedule
              date={selectedDate}
              tasks={tasks}
              expanded={expandedPanel === "schedule"}
              onToggleExpanded={() => toggleExpanded("schedule")}
              onAddTask={(start) => openCreate({ start })}
              onEditTask={openEdit}
              onResizeTask={(task, duration) => task.start_time && updateTask.mutate({ taskId: task.id, payload: { end_time: new Date(new Date(task.start_time).getTime() + duration * 60_000).toISOString() } })}
            />
            <div className="planner-right-column">
              <PlannerFocus
                task={activeTask}
                expanded={expandedPanel === "focus"}
                onToggleExpanded={() => toggleExpanded("focus")}
                onPause={(task) => updateTask.mutate({ taskId: task.id, payload: { is_paused: !task.is_paused } })}
                onComplete={(task) => changeStatus(task, "completed")}
                onExtend={(task) => extendTask.mutate({ taskId: task.id, minutes: 10 })}
                onEdit={openEdit}
              />
              <PlannerBoard
                tasks={tasks}
                expanded={expandedPanel === "board"}
                onToggleExpanded={() => toggleExpanded("board")}
                onAddTask={(status) => openCreate({ status })}
                onEditTask={openEdit}
                onStartTask={(task) => changeStatus(task, "in_progress")}
                onCompleteTask={(task) => changeStatus(task, "completed")}
              />
            </div>
          </div>
        ) : null}
      </main>

      <PlannerTaskModal
        open={modalOpen}
        task={editingTask}
        date={selectedDate}
        suggestedStart={suggestedStart}
        suggestedStatus={suggestedStatus}
        pending={pending}
        onClose={() => setModalOpen(false)}
        onSave={saveTask}
        onDelete={(taskId) => deleteTask.mutate(taskId, { onSuccess: () => setModalOpen(false) })}
      />
    </DndContext>
  );
}
