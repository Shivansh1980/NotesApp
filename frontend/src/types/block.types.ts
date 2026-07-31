export type BlockType =
  | "paragraph"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "bulleted_list"
  | "numbered_list"
  | "todo"
  | "toggle"
  | "quote"
  | "callout"
  | "divider"
  | "math"
  | "code"
  | "image"
  | "file"
  | "bookmark"
  | "table"
  | "subpage";

export type RichTextMark = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  color: string;
  backgroundColor: string;
  link: string | null;
};

export type RichText = {
  text: string;
  marks: RichTextMark;
};

export type BlockProps = Record<string, unknown> & {
  html?: string;
  checked?: boolean;
  language?: string;
  code?: string;
  latex?: string;
  wrap?: boolean;
  caption?: string;
  url?: string;
  fileName?: string;
  rows?: string[][];
  open?: boolean;
  indent?: number;
};

export type Block = {
  id: string;
  page_id: string;
  parent_block_id: string | null;
  type: BlockType;
  content: RichText[];
  props: BlockProps;
  order_key: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type BlockCreate = {
  page_id: string;
  parent_block_id?: string | null;
  type: BlockType;
  content?: RichText[];
  props?: BlockProps;
  order_key: string;
};

export type BlockUpdate = Partial<
  Pick<Block, "type" | "content" | "props" | "parent_block_id" | "order_key">
>;

export type PasteBlock = Omit<BlockCreate, "page_id" | "order_key">;
