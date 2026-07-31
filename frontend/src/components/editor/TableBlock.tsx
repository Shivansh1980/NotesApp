import type { Block, BlockUpdate } from "../../types/block.types";

type TableBlockProps = {
  block: Block;
  onChange: (block: Block, update: BlockUpdate) => void;
  readOnly?: boolean;
};

export function TableBlock({ block, onChange, readOnly = false }: TableBlockProps) {
  const rows = Array.isArray(block.props.rows) ? (block.props.rows as string[][]) : [["", ""]];

  const updateCell = (rowIndex: number, cellIndex: number, value: string) => {
    const nextRows = rows.map((row) => [...row]);
    nextRows[rowIndex][cellIndex] = value;
    onChange(block, { props: { ...block.props, rows: nextRows } });
  };

  return (
    <div className="table-block">
      <table>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>
                  <input
                    readOnly={readOnly}
                    value={cell}
                    onChange={(event) => updateCell(rowIndex, cellIndex, event.target.value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
