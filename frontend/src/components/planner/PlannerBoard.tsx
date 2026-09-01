import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Check, CheckCircle2, GripVertical, Maximize2, Minimize2, Pencil, Play, Plus } from "lucide-react";

import { PlannerCategoryIcon, plannerCategoryLabel } from "./PlannerCategoryIcon";
import type { PlannerTask, PlannerTaskStatus } from "../../types/planner.types";
import { formatTaskTime, remainingTimeLabel } from "../../utils/plannerUtils";

type PlannerBoardProps = {
  tasks: PlannerTask[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onAddTask: (status: PlannerTaskStatus) => void;
  onEditTask: (task: PlannerTask) => void;
  onStartTask: (task: PlannerTask) => void;
  onCompleteTask: (task: PlannerTask) => void;
};

const COLUMNS: Array<{ status: PlannerTaskStatus; label: string }> = [
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "completed", label: "Completed" }
];

function BoardTaskCard({ task, onEdit, onStart, onComplete }: { task: PlannerTask; onEdit: () => void; onStart: () => void; onComplete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `board-task:${task.id}`,
    data: { kind: "task", taskId: task.id, source: "board" }
  });
  const overdue = Boolean(task.end_time && task.status !== "completed" && new Date(task.end_time).getTime() < Date.now());
  return (
    <article ref={setNodeRef} className={`planner-task-card ${task.status === "completed" ? "completed" : ""} ${isDragging ? "dragging" : ""}`} style={{ transform: CSS.Translate.toString(transform) }} onClick={onEdit}>
      <button className="planner-task-grip" type="button" aria-label={`Move ${task.title}`} {...listeners} {...attributes} onClick={(event) => event.stopPropagation()}><GripVertical size={14} /></button>
      <span className={`planner-task-status-dot category-${task.category}`}>{task.status === "completed" ? <CheckCircle2 size={15} /> : <PlannerCategoryIcon category={task.category} size={14} />}</span>
      <div className="planner-task-card-copy">
        <strong>{task.title}</strong>
        <span>{task.start_time ? formatTaskTime(task) : plannerCategoryLabel(task.category)}</span>
        {task.status === "in_progress" && task.end_time ? <small className={overdue ? "overdue" : ""}>{remainingTimeLabel(task)}</small> : null}
      </div>
      <div className="planner-task-quick-actions">
        {task.status === "todo" ? <button type="button" aria-label={`Start ${task.title}`} title="Start" onClick={(event) => { event.stopPropagation(); onStart(); }}><Play size={13} /></button> : null}
        {task.status !== "completed" ? <button type="button" aria-label={`Complete ${task.title}`} title="Complete" onClick={(event) => { event.stopPropagation(); onComplete(); }}><Check size={13} /></button> : null}
        <button type="button" aria-label={`Edit ${task.title}`} title="Edit" onClick={(event) => { event.stopPropagation(); onEdit(); }}><Pencil size={13} /></button>
      </div>
    </article>
  );
}

function BoardColumn({ status, label, tasks, onAddTask, onEditTask, onStartTask, onCompleteTask }: { status: PlannerTaskStatus; label: string; tasks: PlannerTask[]; onAddTask: () => void; onEditTask: (task: PlannerTask) => void; onStartTask: (task: PlannerTask) => void; onCompleteTask: (task: PlannerTask) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `planner-status:${status}`, data: { kind: "status", status } });
  return (
    <section ref={setNodeRef} className={`planner-board-column ${isOver ? "is-over" : ""}`} aria-label={`${label} tasks`}>
      <header><span>{label}</span><strong>{tasks.length}</strong></header>
      <div className="planner-board-list">
        {tasks.map((task) => <BoardTaskCard key={task.id} task={task} onEdit={() => onEditTask(task)} onStart={() => onStartTask(task)} onComplete={() => onCompleteTask(task)} />)}
        {!tasks.length ? <div className="planner-column-empty">Drop a task here</div> : null}
      </div>
      <button className="planner-column-add" type="button" onClick={onAddTask}><Plus size={14} />Add task</button>
    </section>
  );
}

export function PlannerBoard({ tasks, expanded, onToggleExpanded, onAddTask, onEditTask, onStartTask, onCompleteTask }: PlannerBoardProps) {
  return (
    <section className={`planner-panel planner-board-panel ${expanded ? "planner-panel-expanded" : ""}`} aria-labelledby="planner-board-heading">
      <header className="planner-panel-header">
        <div><CheckCircle2 size={18} /><h2 id="planner-board-heading">Tasks</h2></div>
        <button className="planner-icon-button" type="button" aria-label={expanded ? "Exit full task board" : "Expand task board"} title={expanded ? "Exit full screen" : "Expand"} onClick={onToggleExpanded}>{expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
      </header>
      <div className="planner-board-grid">
        {COLUMNS.map((column) => (
          <BoardColumn
            key={column.status}
            {...column}
            tasks={tasks.filter((task) => task.status === column.status).sort((left, right) => left.position - right.position)}
            onAddTask={() => onAddTask(column.status)}
            onEditTask={onEditTask}
            onStartTask={onStartTask}
            onCompleteTask={onCompleteTask}
          />
        ))}
      </div>
    </section>
  );
}
