from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.schemas.search import SearchResponse
from app.services.search_service import SearchService


router = APIRouter(tags=["search"])


@router.get("/search", response_model=SearchResponse)
def workspace_search(
    q: str = Query(min_length=1),
    workspace_id: str = Query(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"query": q, "results": SearchService(db).workspace_search(current_user, workspace_id, q)}


@router.get("/pages/{page_id}/search", response_model=SearchResponse)
def page_search(
    page_id: str,
    q: str = Query(min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"query": q, "results": SearchService(db).page_search(current_user, page_id, q)}
