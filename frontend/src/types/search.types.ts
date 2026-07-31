export type SearchResult = {
  id: string;
  type: "page" | "block";
  title: string;
  snippet: string;
  page_id: string | null;
  workspace_id: string;
  created_by: string | null;
  updated_at: string;
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
};
