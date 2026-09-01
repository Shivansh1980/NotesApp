from datetime import UTC, date, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PlannerTask, User
from app.models.entities import new_id
from app.schemas.planner import PlannerTaskCreate, PlannerTaskUpdate
from app.services.permission_service import PermissionService


RECURRENCE_HORIZON_DAYS = 90


def _aware(value: datetime | None) -> datetime | None:
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=UTC)


def _combine_on_date(value: datetime | None, target_date: date) -> datetime | None:
    if value is None:
        return None
    return datetime.combine(target_date, value.timetz(), tzinfo=value.tzinfo)


def _recurs_on(recurrence: str, recurrence_days: list[int], candidate: date, origin: date) -> bool:
    if candidate <= origin:
        return False
    if recurrence == "daily":
        return True
    if recurrence == "weekdays":
        return candidate.weekday() < 5
    if recurrence == "weekly":
        return candidate.weekday() == origin.weekday()
    if recurrence == "custom":
        return candidate.weekday() in recurrence_days
    return False


class PlannerService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.permissions = PermissionService(db)

    def list_for_range(
        self,
        user: User,
        workspace_id: str,
        start_date: date,
        end_date: date,
    ) -> list[PlannerTask]:
        self.permissions.require_workspace(user, workspace_id)
        if end_date < start_date or (end_date - start_date).days > 31:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid planner date range")

        self._materialize_recurrences(user, workspace_id, start_date, end_date)

        tasks = list(
            self.db.scalars(
                select(PlannerTask).where(
                    PlannerTask.workspace_id == workspace_id,
                    PlannerTask.user_id == user.id,
                    PlannerTask.plan_date >= start_date,
                    PlannerTask.plan_date <= end_date,
                )
            )
        )
        return sorted(
            tasks,
            key=lambda task: (
                task.plan_date,
                task.start_time is None,
                _aware(task.start_time) or datetime.max.replace(tzinfo=UTC),
                task.position,
                task.created_at,
            ),
        )

    def create(self, user: User, payload: PlannerTaskCreate) -> PlannerTask:
        workspace_id = str(payload.workspace_id)
        self.permissions.require_workspace(user, workspace_id, "editor")
        values = payload.model_dump(exclude={"workspace_id"})
        values["title"] = payload.title.strip()
        if not values["title"]:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Task title is required")

        series_id = new_id() if payload.recurrence != "none" else None
        task = PlannerTask(
            workspace_id=workspace_id,
            user_id=user.id,
            series_id=series_id,
            **values,
        )
        self._normalize_active_state(task, user)
        self.db.add(task)

        if series_id:
            self._add_recurrence_instances(task, payload)

        self.db.commit()
        self.db.refresh(task)
        return task

    def update(self, user: User, task_id: str, payload: PlannerTaskUpdate) -> PlannerTask:
        task = self._require_task(user, task_id, "editor")
        changes = payload.model_dump(exclude_unset=True)

        if "plan_date" in changes and changes["plan_date"] and changes["plan_date"] != task.plan_date:
            if "start_time" not in changes:
                changes["start_time"] = _combine_on_date(task.start_time, changes["plan_date"])
            if "end_time" not in changes:
                changes["end_time"] = _combine_on_date(task.end_time, changes["plan_date"])

        merged_start = changes.get("start_time", task.start_time)
        merged_end = changes.get("end_time", task.end_time)
        if (merged_start is None) != (merged_end is None):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Start and end time must both be set for scheduled tasks",
            )
        if merged_start and merged_end and _aware(merged_end) <= _aware(merged_start):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="End time must be after start time")

        recurrence = changes.get("recurrence", task.recurrence)
        recurrence_days = changes.get("recurrence_days", task.recurrence_days)
        if recurrence == "custom" and not recurrence_days:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Choose a custom recurrence day")
        if recurrence_days and any(day < 0 or day > 6 for day in recurrence_days):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid recurrence day")

        requested_pause = changes.pop("is_paused", None)
        for field, value in changes.items():
            if field == "title" and value is not None:
                value = value.strip()
            setattr(task, field, value)

        if task.series_id and "plan_date" in changes:
            duplicate = self.db.scalar(
                select(PlannerTask).where(
                    PlannerTask.series_id == task.series_id,
                    PlannerTask.plan_date == task.plan_date,
                    PlannerTask.id != task.id,
                )
            )
            if duplicate:
                self.db.delete(duplicate)

        if task.status == "completed":
            task.is_active = False
            task.is_paused = False
            task.paused_at = None
        elif task.status == "todo":
            task.is_active = False
            task.is_paused = False
            task.paused_at = None
        elif task.status == "in_progress" and not self._active_task(user, task.workspace_id, exclude_id=task.id):
            task.is_active = True

        if task.is_active:
            task.status = "in_progress"
            self._deactivate_others(user, task.workspace_id, task.id)

        if requested_pause is not None:
            self._set_paused(task, requested_pause)

        self.db.commit()
        self.db.refresh(task)
        return task

    def extend(self, user: User, task_id: str, minutes: int) -> PlannerTask:
        task = self._require_task(user, task_id, "editor")
        if task.end_time is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Only scheduled tasks can be extended")
        task.end_time = task.end_time + timedelta(minutes=minutes)
        self.db.commit()
        self.db.refresh(task)
        return task

    def delete(self, user: User, task_id: str) -> None:
        task = self._require_task(user, task_id, "editor")
        self.db.delete(task)
        self.db.commit()

    def _require_task(self, user: User, task_id: str, role: str = "viewer") -> PlannerTask:
        task = self.db.get(PlannerTask, task_id)
        if not task or task.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planner task not found")
        self.permissions.require_workspace(user, task.workspace_id, role)
        return task

    def _normalize_active_state(self, task: PlannerTask, user: User) -> None:
        if task.status == "completed":
            task.is_active = False
            task.is_paused = False
            return
        if task.is_active:
            task.status = "in_progress"
            self._deactivate_others(user, task.workspace_id, task.id)
            return
        if task.status == "in_progress" and not self._active_task(user, task.workspace_id):
            task.is_active = True

    def _active_task(self, user: User, workspace_id: str, exclude_id: str | None = None) -> PlannerTask | None:
        query = select(PlannerTask).where(
            PlannerTask.user_id == user.id,
            PlannerTask.workspace_id == workspace_id,
            PlannerTask.is_active.is_(True),
            PlannerTask.status == "in_progress",
        )
        if exclude_id:
            query = query.where(PlannerTask.id != exclude_id)
        return self.db.scalar(query)

    def _deactivate_others(self, user: User, workspace_id: str, active_id: str) -> None:
        others = self.db.scalars(
            select(PlannerTask).where(
                PlannerTask.user_id == user.id,
                PlannerTask.workspace_id == workspace_id,
                PlannerTask.id != active_id,
                PlannerTask.is_active.is_(True),
            )
        )
        for other in others:
            other.is_active = False
            other.is_paused = False
            other.paused_at = None

    def _set_paused(self, task: PlannerTask, paused: bool) -> None:
        now = datetime.now(UTC)
        if paused:
            if task.status != "in_progress" or not task.is_active:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only the current task can be paused")
            if not task.is_paused:
                task.is_paused = True
                task.paused_at = now
            return

        if task.is_paused and task.paused_at:
            paused_at = _aware(task.paused_at) or now
            elapsed = max(0, int((now - paused_at).total_seconds()))
            task.total_paused_seconds += elapsed
            if task.end_time:
                task.end_time = task.end_time + timedelta(seconds=elapsed)
        task.is_paused = False
        task.paused_at = None

    def _add_recurrence_instances(self, root: PlannerTask, payload: PlannerTaskCreate) -> None:
        for offset in range(1, RECURRENCE_HORIZON_DAYS + 1):
            occurrence_date = payload.plan_date + timedelta(days=offset)
            if not _recurs_on(payload.recurrence, payload.recurrence_days, occurrence_date, payload.plan_date):
                continue
            values = payload.model_dump(exclude={"workspace_id", "plan_date", "start_time", "end_time"})
            values["status"] = "todo"
            values["is_active"] = False
            values["is_paused"] = False
            self.db.add(
                PlannerTask(
                    workspace_id=root.workspace_id,
                    user_id=root.user_id,
                    series_id=root.series_id,
                    plan_date=occurrence_date,
                    start_time=_combine_on_date(payload.start_time, occurrence_date),
                    end_time=_combine_on_date(payload.end_time, occurrence_date),
                    **values,
                )
            )

    def _materialize_recurrences(
        self,
        user: User,
        workspace_id: str,
        start_date: date,
        end_date: date,
    ) -> None:
        recurring_tasks = list(
            self.db.scalars(
                select(PlannerTask).where(
                    PlannerTask.workspace_id == workspace_id,
                    PlannerTask.user_id == user.id,
                    PlannerTask.series_id.is_not(None),
                    PlannerTask.recurrence != "none",
                )
            )
        )
        series: dict[str, list[PlannerTask]] = {}
        for task in recurring_tasks:
            if task.series_id:
                series.setdefault(task.series_id, []).append(task)

        created = False
        for series_id, occurrences in series.items():
            seed = min(occurrences, key=lambda task: (task.created_at, task.plan_date, task.id))
            existing_dates = {task.plan_date for task in occurrences}
            for offset in range((end_date - start_date).days + 1):
                occurrence_date = start_date + timedelta(days=offset)
                if occurrence_date in existing_dates:
                    continue
                if not _recurs_on(seed.recurrence, seed.recurrence_days, occurrence_date, seed.plan_date):
                    continue
                self.db.add(self._copy_occurrence(seed, series_id, occurrence_date))
                existing_dates.add(occurrence_date)
                created = True

        if created:
            self.db.commit()

    @staticmethod
    def _copy_occurrence(seed: PlannerTask, series_id: str, occurrence_date: date) -> PlannerTask:
        return PlannerTask(
            workspace_id=seed.workspace_id,
            user_id=seed.user_id,
            series_id=series_id,
            title=seed.title,
            description=seed.description,
            plan_date=occurrence_date,
            start_time=_combine_on_date(seed.start_time, occurrence_date),
            end_time=_combine_on_date(seed.end_time, occurrence_date),
            status="todo",
            category=seed.category,
            priority=seed.priority,
            reminders_enabled=seed.reminders_enabled,
            reminder_minutes_before=seed.reminder_minutes_before,
            end_warning_minutes=seed.end_warning_minutes,
            notify_at_end=seed.notify_at_end,
            recurrence=seed.recurrence,
            recurrence_days=list(seed.recurrence_days),
            position=seed.position,
            is_active=False,
            is_paused=False,
        )
