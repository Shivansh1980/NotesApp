import { request } from "./client";
import type { PlannerTask, PlannerTaskCreate, PlannerTaskUpdate } from "../types/planner.types";

export const plannerApi = {
  list(workspaceId: string, startDate: string, endDate = startDate) {
    const query = new URLSearchParams({ workspace_id: workspaceId, start_date: startDate, end_date: endDate });
    return request<PlannerTask[]>(`/api/planner/tasks?${query.toString()}`);
  },
  create(payload: PlannerTaskCreate) {
    return request<PlannerTask>("/api/planner/tasks", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  update(taskId: string, payload: PlannerTaskUpdate) {
    return request<PlannerTask>(`/api/planner/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  extend(taskId: string, minutes = 10) {
    return request<PlannerTask>(`/api/planner/tasks/${taskId}/extend`, {
      method: "POST",
      body: JSON.stringify({ minutes })
    });
  },
  delete(taskId: string) {
    return request<void>(`/api/planner/tasks/${taskId}`, { method: "DELETE" });
  }
};
