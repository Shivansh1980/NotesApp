from fastapi import APIRouter

from app.api import auth, blocks, calendar, comments, pages, planner, search, uploads, workspaces


api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(workspaces.router)
api_router.include_router(pages.router)
api_router.include_router(blocks.router)
api_router.include_router(uploads.router)
api_router.include_router(search.router)
api_router.include_router(comments.router)
api_router.include_router(calendar.router)
api_router.include_router(planner.router)
