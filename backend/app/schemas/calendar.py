from pydantic import BaseModel


class CalendarStatusResponse(BaseModel):
    configured: bool
    connected: bool
    provider: str = "google"


class CalendarAuthorizationResponse(BaseModel):
    authorization_url: str


class CalendarEventResponse(BaseModel):
    id: str
    title: str
    start: str
    end: str | None = None
    all_day: bool = False
    html_link: str | None = None
    location: str | None = None


class CalendarEventsResponse(BaseModel):
    events: list[CalendarEventResponse]
