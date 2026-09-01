from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import AuditFields


PlannerStatus = Literal["todo", "in_progress", "completed"]
PlannerPriority = Literal["low", "medium", "high"]
PlannerRecurrence = Literal["none", "daily", "weekdays", "weekly", "custom"]


class PlannerTaskFields(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    plan_date: date
    start_time: datetime | None = None
    end_time: datetime | None = None
    status: PlannerStatus = "todo"
    category: str = Field(default="work", min_length=1, max_length=40)
    priority: PlannerPriority = "medium"
    reminders_enabled: bool = False
    reminder_minutes_before: int | None = Field(default=None, ge=0, le=1440)
    end_warning_minutes: int = Field(default=5, ge=0, le=180)
    notify_at_end: bool = False
    recurrence: PlannerRecurrence = "none"
    recurrence_days: list[int] = Field(default_factory=list, max_length=7)
    position: int = Field(default=0, ge=0)
    is_active: bool = False
    is_paused: bool = False

    @model_validator(mode="after")
    def validate_schedule(self):
        if (self.start_time is None) != (self.end_time is None):
            raise ValueError("Start and end time must both be set for scheduled tasks")
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("End time must be after start time")
        if self.recurrence == "custom" and not self.recurrence_days:
            raise ValueError("Choose at least one day for a custom recurrence")
        if any(day < 0 or day > 6 for day in self.recurrence_days):
            raise ValueError("Recurrence days must be between 0 and 6")
        if self.status == "completed":
            self.is_active = False
            self.is_paused = False
        return self


class PlannerTaskCreate(PlannerTaskFields):
    workspace_id: UUID


class PlannerTaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    plan_date: date | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    status: PlannerStatus | None = None
    category: str | None = Field(default=None, min_length=1, max_length=40)
    priority: PlannerPriority | None = None
    reminders_enabled: bool | None = None
    reminder_minutes_before: int | None = Field(default=None, ge=0, le=1440)
    end_warning_minutes: int | None = Field(default=None, ge=0, le=180)
    notify_at_end: bool | None = None
    recurrence: PlannerRecurrence | None = None
    recurrence_days: list[int] | None = Field(default=None, max_length=7)
    position: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
    is_paused: bool | None = None


class PlannerTaskResponse(AuditFields):
    workspace_id: UUID
    user_id: UUID
    series_id: UUID | None = None
    title: str
    description: str
    plan_date: date
    start_time: datetime | None = None
    end_time: datetime | None = None
    status: PlannerStatus
    category: str
    priority: PlannerPriority
    reminders_enabled: bool
    reminder_minutes_before: int | None = None
    end_warning_minutes: int
    notify_at_end: bool
    recurrence: PlannerRecurrence
    recurrence_days: list[int]
    position: int
    is_active: bool
    is_paused: bool
    paused_at: datetime | None = None
    total_paused_seconds: int


class PlannerTaskExtend(BaseModel):
    minutes: int = Field(default=10, ge=1, le=480)
