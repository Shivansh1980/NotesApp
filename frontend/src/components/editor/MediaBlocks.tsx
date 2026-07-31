import { File, Image, Link2 } from "lucide-react";

import { resolveApiUrl } from "../../api/client";
import type { Block, BlockUpdate } from "../../types/block.types";
import { richText } from "../../utils/blockUtils";

type MediaBlockProps = {
  block: Block;
  onChange: (block: Block, update: BlockUpdate) => void;
  readOnly?: boolean;
};

export function ImageBlock({ block, onChange, readOnly = false }: MediaBlockProps) {
  const url = resolveApiUrl(String(block.props.url ?? ""));
  return (
    <figure className="image-block">
      {url ? <img src={url} alt={String(block.props.caption ?? "")} loading="lazy" /> : <Image size={28} />}
      <input
        readOnly={readOnly}
        placeholder="Add a caption"
        value={String(block.props.caption ?? "")}
        onChange={(event) => onChange(block, { props: { ...block.props, caption: event.target.value } })}
      />
    </figure>
  );
}

export function FileBlock({ block }: MediaBlockProps) {
  const url = resolveApiUrl(String(block.props.url ?? ""));
  return (
    <a className="file-block" href={url} target="_blank" rel="noreferrer">
      <File size={18} />
      <span>{String(block.props.fileName ?? "File")}</span>
    </a>
  );
}

export function BookmarkBlock({ block, onChange, readOnly = false }: MediaBlockProps) {
  const url = String(block.props.url ?? block.content[0]?.text ?? "");
  return (
    <div className="bookmark-block">
      <Link2 size={18} />
      <input
        readOnly={readOnly}
        value={url}
        onChange={(event) =>
          onChange(block, {
            content: [richText(event.target.value)],
            props: { ...block.props, url: event.target.value }
          })
        }
      />
    </div>
  );
}
