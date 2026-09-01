import { Bell, Check, Clock3, Maximize2, Minimize2, Pause, Pencil, Play, Target } from "lucide-react";
import { useEffect, useState } from "react";

import { PlannerCategoryIcon } from "./PlannerCategoryIcon";
import type { PlannerTask } from "../../types/planner.types";
import { formatDuration, formatTaskTime, minutesBetween, plannerProgress, remainingTimeLabel } from "../../utils/plannerUtils";

type PlannerFocusProps = {
  task: PlannerTask | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  onPause: (task: PlannerTask) => void;
  onComplete: (task: PlannerTask) => void;
  onExtend: (task: PlannerTask) => void;
  onEdit: (task: PlannerTask) => void;
};

export function PlannerFocus({ task, expanded, onToggleExpanded, onPause, onComplete, onExtend, onEdit }: PlannerFocusProps) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const progress = task ? plannerProgress(task, now) : 0;
  const duration = task ? minutesBetween(task.start_time, task.end_time) : 0;

  return (
    <section className={`planner-panel planner-focus-panel ${expanded ? "planner-panel-expanded" : ""}`} aria-labelledby="planner-focus-heading">
      <header className="planner-panel-header">
        <div><Target size={18} /><h2 id="planner-focus-heading">Current focus</h2></div>
        <button className="planner-icon-button" type="button" aria-label={expanded ? "Exit full current focus" : "Expand current focus"} title={expanded ? "Exit full screen" : "Expand"} onClick={onToggleExpanded}>{expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
      </header>
      {task ? (
        <div className="planner-focus-content">
          <div className={`planner-focus-icon category-${task.category}`}><PlannerCategoryIcon category={task.category} size={32} /></div>
          <div className="planner-focus-copy">
            <strong>{task.title}</strong>
            <span className={task.end_time && new Date(task.end_time).getTime() < now ? "overdue" : ""}>{remainingTimeLabel(task, now)}</span>
            <small>{formatTaskTime(task)}</small>
          </div>
          <button className="planner-edit-focus" type="button" aria-label="Edit current task" onClick={() => onEdit(task)}><Pencil size={15} /></button>
          <div className="planner-focus-progress">
            <div><span style={{ width: `${progress}%` }} /></div>
            <p><span>{task.is_paused ? "Timer paused" : `${formatDuration(Math.round((duration * progress) / 100))} completed`}</span><strong>{Math.round(progress)}%</strong></p>
          </div>
          <div className="planner-focus-actions">
            <button className="planner-primary-button" type="button" onClick={() => onComplete(task)}><Check size={16} />Complete</button>
            <button type="button" onClick={() => onPause(task)}>{task.is_paused ? <Play size={16} /> : <Pause size={16} />}{task.is_paused ? "Resume" : "Pause"}</button>
            <button type="button" disabled={!task.end_time} onClick={() => onExtend(task)}><Clock3 size={16} />Extend 10 min</button>
          </div>
          {task.reminders_enabled ? <div className="planner-focus-reminder"><Bell size={14} />Ending warning set for {task.end_warning_minutes} minutes before</div> : null}
        </div>
      ) : (
        <div className="planner-focus-empty">
          <span><Target size={24} /></span>
          <strong>No task in progress</strong>
          <p>Choose one from To Do or start your next scheduled task.</p>
        </div>
      )}
    </section>
  );
}
