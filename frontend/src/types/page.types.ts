export type Page = {
  id: string;
  workspace_id: string;
  parent_page_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  order_key: string;
  is_archived: boolean;
  page_font: "default" | "serif" | "mono";
  page_width: "default" | "wide" | "full";
  small_text: boolean;
  is_locked: boolean;
  is_favorite: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PageTreeNode = Page & {
  children: PageTreeNode[];
};

export type PageCreate = {
  workspace_id: string;
  parent_page_id?: string | null;
  title?: string;
  icon?: string | null;
  cover_url?: string | null;
  order_key?: string;
  page_font?: Page["page_font"];
  page_width?: Page["page_width"];
  small_text?: boolean;
  is_locked?: boolean;
  is_favorite?: boolean;
};

export type PageUpdate = Partial<
  Pick<
    Page,
    | "parent_page_id"
    | "title"
    | "icon"
    | "cover_url"
    | "order_key"
    | "is_archived"
    | "page_font"
    | "page_width"
    | "small_text"
    | "is_locked"
    | "is_favorite"
  >
>;
