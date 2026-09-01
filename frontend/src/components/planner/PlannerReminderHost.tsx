import { Bell, Check, Clock3, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { usePlannerMutations, usePlannerTasks } from "../../hooks/usePlanner";
import { useEditorStore } from "../../store/editorStore";
import type { PlannerReminder, PlannerTask } from "../../types/planner.types";
import { addDays, calculateTaskReminders, dateKey, readReminderLedger, rememberReminder } from "../../utils/plannerUtils";

type PlannerToast = PlannerReminder & { task: PlannerTask };

type PlannerReminderHostProps = {
  workspaceId: string | null;
};

export function PlannerReminderHost({ workspaceId }: PlannerReminderHostProps) {
  const today = dateKey(new Date());
  const tomorrow = addDays(today, 1);
  const tasksQuery = usePlannerTasks(workspaceId, today, tomorrow);
  const { updateTask, extendTask } = usePlannerMutations(workspaceId);
  const setPlannerOpen = useEditorStore((state) => state.setPlannerOpen);
  const fired = useRef(readReminderLedger());
  const [toasts, setToasts] = useState<PlannerToast[]>([]);

  const openTask = useCallback((task: PlannerTask) => {
    setPlannerOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.set("view", "planner");
    url.searchParams.set("date", task.plan_date);
    url.searchParams.delete("page");
    window.history.replaceState(null, "", url);
    window.setTimeout(() => document.dispatchEvent(new CustomEvent("notes:open-planner-task", {
      detail: { taskId: task.id, date: task.plan_date }
    })), 0);
  }, [setPlannerOpen]);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      for (const task of tasksQuery.data ?? []) {
        for (const reminder of calculateTaskReminders(task)) {
          if (fired.current.has(reminder.id) || reminder.notifyAt > now) continue;
          fired.current.add(reminder.id);
          rememberReminder(reminder.id);
          if (now - reminder.notifyAt > 5 * 60_000) continue;

          if ("Notification" in window && Notification.permission === "granted") {
            const notification = new Notification(reminder.title, {
              body: reminder.body,
              icon: "/favicon.ico",
              tag: reminder.id,
              requireInteraction: reminder.kind !== "start"
            });
            notification.onclick = () => {
              window.focus();
              openTask(task);
              notification.close();
            };
          } else {
            setToasts((current) => [...current.filter((item) => item.id !== reminder.id), { ...reminder, task }].slice(-3));
          }
        }
      }
    };
    check();
    const timer = window.setInterval(check, 15_000);
    return () => window.clearInterval(timer);
  }, [openTask, tasksQuery.data]);

  const dismiss = (id: string) => setToasts((current) => current.filter((item) => item.id !== id));
  if (!toasts.length) return null;

  return (
    <div className="planner-toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <section className="planner-toast" key={toast.id}>
          <span className="planner-toast-icon"><Bell size={17} /></span>
          <div><strong>{toast.title}</strong><p>{toast.body}</p></div>
          <button className="planner-toast-close" type="button" aria-label="Dismiss reminder" onClick={() => dismiss(toast.id)}><X size={14} /></button>
          <div className="planner-toast-actions">
            <button type="button" onClick={() => { updateTask.mutate({ taskId: toast.task.id, payload: { status: "completed", is_active: false, is_paused: false } }); dismiss(toast.id); }}><Check size={14} />Complete</button>
            {toast.task.end_time ? <button type="button" onClick={() => { extendTask.mutate({ taskId: toast.task.id, minutes: 10 }); dismiss(toast.id); }}><Clock3 size={14} />+10 min</button> : null}
            <button type="button" onClick={() => { openTask(toast.task); dismiss(toast.id); }}>Open task</button>
          </div>
        </section>
      ))}
    </div>
  );
}
