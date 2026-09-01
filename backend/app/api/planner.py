from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.schemas.planner import (
    PlannerTaskCreate,
    PlannerTaskExtend,
    PlannerTaskResponse,
    PlannerTaskUpdate,
)
from app.services.planner_service import PlannerService


router = APIRouter(prefix="/planner", tags=["planner"])


@router.get("/tasks", response_model=list[PlannerTaskResponse])
def list_planner_tasks(
    workspace_id: str,
    start_date: date | None = Query(default=None),
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PlannerService(db).list_for_range(
        current_user,
        workspace_id,
        start_date or date.today(),
        end_date or start_date or date.today(),
    )


@router.post("/tasks", response_model=PlannerTaskResponse, status_code=201)
def create_planner_task(
    payload: PlannerTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PlannerService(db).create(current_user, payload)


@router.patch("/tasks/{task_id}", response_model=PlannerTaskResponse)
def update_planner_task(
    task_id: str,
    payload: PlannerTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PlannerService(db).update(current_user, task_id, payload)


@router.post("/tasks/{task_id}/extend", response_model=PlannerTaskResponse)
def extend_planner_task(
    task_id: str,
    payload: PlannerTaskExtend,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PlannerService(db).extend(current_user, task_id, payload.minutes)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_planner_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    PlannerService(db).delete(current_user, task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
