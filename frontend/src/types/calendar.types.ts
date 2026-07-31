export type CalendarStatus = {
  configured: boolean;
  connected: boolean;
  provider: "google";
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  all_day: boolean;
  html_link: string | null;
  location: string | null;
};
