import { request } from "./client";

export type Upload = {
  id: string;
  workspace_id: string;
  uploaded_by: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_key: string;
  public_url: string;
  created_at: string;
  updated_at: string;
};

export const uploadsApi = {
  upload(workspaceId: string, file: File) {
    const formData = new FormData();
    formData.set("workspace_id", workspaceId);
    formData.set("file", file);
    return request<Upload>("/api/uploads", {
      method: "POST",
      body: formData
    });
  },
  get(uploadId: string) {
    return request<Upload>(`/api/uploads/${uploadId}`);
  },
  remove(uploadId: string) {
    return request<void>(`/api/uploads/${uploadId}`, { method: "DELETE" });
  }
};
