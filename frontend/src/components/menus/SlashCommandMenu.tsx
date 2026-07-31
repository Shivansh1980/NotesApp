import {
  CheckSquare,
  Code2,
  File,
  Heading1,
  Heading2,
  Heading3,
  Image,
  List,
  ListOrdered,
  MessageSquare,
  Minus,
  Sigma,
  Quote,
  Text,
  ToggleLeft
} from "lucide-react";

import type { BlockType } from "../../types/block.types";

export type SlashCommand = {
  id: string;
  label: string;
  aliases: string[];
  type?: BlockType;
  action?: "duplicate" | "delete" | "red" | "blue-bg";
  icon: React.ReactNode;
};

export const slashCommands: SlashCommand[] = [
  { id: "text", label: "Text", aliases: ["text", "paragraph"], type: "paragraph", icon: <Text size={16} /> },
  { id: "h1", label: "Heading 1", aliases: ["h1", "heading1"], type: "heading_1", icon: <Heading1 size={16} /> },
  { id: "h2", label: "Heading 2", aliases: ["h2", "heading2"], type: "heading_2", icon: <Heading2 size={16} /> },
  { id: "h3", label: "Heading 3", aliases: ["h3", "heading3"], type: "heading_3", icon: <Heading3 size={16} /> },
  { id: "bullet", label: "Bullet", aliases: ["bullet"], type: "bulleted_list", icon: <List size={16} /> },
  { id: "number", label: "Number", aliases: ["number"], type: "numbered_list", icon: <ListOrdered size={16} /> },
  { id: "todo", label: "To-do", aliases: ["todo", "checkbox"], type: "todo", icon: <CheckSquare size={16} /> },
  { id: "toggle", label: "Toggle", aliases: ["toggle"], type: "toggle", icon: <ToggleLeft size={16} /> },
  { id: "quote", label: "Quote", aliases: ["quote"], type: "quote", icon: <Quote size={16} /> },
  { id: "callout", label: "Callout", aliases: ["callout"], type: "callout", icon: <MessageSquare size={16} /> },
  { id: "divider", label: "Divider", aliases: ["divider"], type: "divider", icon: <Minus size={16} /> },
  { id: "math", label: "Equation", aliases: ["math", "latex", "equation"], type: "math", icon: <Sigma size={16} /> },
  { id: "code", label: "Code", aliases: ["code"], type: "code", icon: <Code2 size={16} /> },
  { id: "image", label: "Image", aliases: ["image"], type: "image", icon: <Image size={16} /> },
  { id: "file", label: "File", aliases: ["file"], type: "file", icon: <File size={16} /> }
];

type SlashCommandMenuProps = {
  query: string;
  x: number;
  y: number;
  onSelect: (command: SlashCommand) => void;
};

export function SlashCommandMenu({ query, x, y, onSelect }: SlashCommandMenuProps) {
  const normalized = query.toLowerCase().replace("/", "");
  const commands = slashCommands.filter(
    (command) =>
      command.label.toLowerCase().includes(normalized) ||
      command.aliases.some((alias) => alias.includes(normalized))
  );

  return (
    <div className="slash-menu" style={{ left: x, top: y }}>
      {commands.map((command) => (
        <button key={command.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(command)}>
          {command.icon}
          <span>{command.label}</span>
        </button>
      ))}
    </div>
  );
}
