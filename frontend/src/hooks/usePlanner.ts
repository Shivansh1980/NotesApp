import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { plannerApi } from "../api/planner.api";
import type { PlannerTask, PlannerTaskCreate, PlannerTaskUpdate } from "../types/planner.types";

export const plannerQueryKeys = {
  root: ["planner-tasks"] as const,
  workspace: (workspaceId: string) => ["planner-tasks", workspaceId] as const,
  range: (workspaceId: string, startDate: string, endDate: string) =>
    ["planner-tasks", workspaceId, startDate, endDate] as const
};

function replaceTask(current: PlannerTask[] | undefined, task: PlannerTask): PlannerTask[] | undefined {
  if (!current) return current;
  const index = current.findIndex((item) => item.id === task.id);
  if (index < 0) return current;
  return current.map((item) => (item.id === task.id ? task : item));
}

export function usePlannerTasks(workspaceId: string | null, startDate: string, endDate = startDate) {
  return useQuery({
    queryKey: plannerQueryKeys.range(workspaceId ?? "none", startDate, endDate),
    queryFn: () => plannerApi.list(workspaceId as string, startDate, endDate),
    enabled: Boolean(workspaceId),
    staleTime: 30_000
  });
}

export function usePlannerMutations(workspaceId: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    if (workspaceId) return queryClient.invalidateQueries({ queryKey: plannerQueryKeys.workspace(workspaceId) });
    return queryClient.invalidateQueries({ queryKey: plannerQueryKeys.root });
  };
  const updateCaches = (task: PlannerTask) => {
    if (!workspaceId) return;
    queryClient.setQueriesData<PlannerTask[]>(
      { queryKey: plannerQueryKeys.workspace(workspaceId) },
      (current) => replaceTask(current, task)
    );
  };

  const createTask = useMutation({
    mutationFn: (payload: PlannerTaskCreate) => plannerApi.create(payload),
    onSuccess: invalidate
  });
  const updateTask = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: PlannerTaskUpdate }) =>
      plannerApi.update(taskId, payload),
    onSuccess(task) {
      updateCaches(task);
      void invalidate();
    }
  });
  const extendTask = useMutation({
    mutationFn: ({ taskId, minutes }: { taskId: string; minutes?: number }) => plannerApi.extend(taskId, minutes),
    onSuccess(task) {
      updateCaches(task);
      void invalidate();
    }
  });
  const deleteTask = useMutation({
    mutationFn: plannerApi.delete,
    onSuccess: invalidate
  });

  return {
    createTask,
    updateTask,
    extendTask,
    deleteTask,
    pending: createTask.isPending || updateTask.isPending || extendTask.isPending || deleteTask.isPending
  };
}
