import type { Block, BlockCreate, BlockProps, BlockType, RichText, RichTextMark } from "../types/block.types";

export const defaultMarks: RichTextMark = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  color: "default",
  backgroundColor: "default",
  link: null
};

export function richText(text = "", marks: Partial<RichTextMark> = {}): RichText {
  return {
    text,
    marks: { ...defaultMarks, ...marks }
  };
}

export function blockText(block: Pick<Block, "content" | "props" | "type">): string {
  if (block.type === "code") return String(block.props.code ?? "");
  if (block.type === "math") return String(block.props.latex ?? "");
  return block.content.map((item) => item.text).join("");
}

export function makeBlock(
  pageId: string,
  type: BlockType = "paragraph",
  orderKey: string,
  content: RichText[] = [],
  props: BlockProps = {},
  parentBlockId: string | null = null
): BlockCreate {
  return {
    page_id: pageId,
    parent_block_id: parentBlockId,
    type,
    content,
    props,
    order_key: orderKey
  };
}

export function cloneForCreate(pageId: string, block: Block, orderKey: string): BlockCreate {
  return {
    page_id: pageId,
    parent_block_id: block.parent_block_id,
    type: block.type,
    content: structuredClone(block.content),
    props: structuredClone(block.props),
    order_key: orderKey
  };
}

export function blockLabel(type: BlockType): string {
  const labels: Record<BlockType, string> = {
    paragraph: "Text",
    heading_1: "Heading 1",
    heading_2: "Heading 2",
    heading_3: "Heading 3",
    bulleted_list: "Bullet",
    numbered_list: "Number",
    todo: "To-do",
    toggle: "Toggle",
    quote: "Quote",
    callout: "Callout",
    divider: "Divider",
    math: "Equation",
    code: "Code",
    image: "Image",
    file: "File",
    bookmark: "Bookmark",
    table: "Table",
    subpage: "Subpage"
  };
  return labels[type];
}

export function emptyPropsForType(type: BlockType): BlockProps {
  if (type === "code") return { language: "auto", code: "", wrap: false, caption: "" };
  if (type === "math") return { latex: "", caption: "" };
  if (type === "todo") return { checked: false };
  if (type === "toggle") return { open: true };
  if (type === "table") return { rows: [["", ""], ["", ""]] };
  if (type === "callout") return { icon: "!" };
  return {};
}
