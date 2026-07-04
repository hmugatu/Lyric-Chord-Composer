import React from 'react';

interface LyricLineProps {
  value: string;
  width: number;
  onChange: (text: string) => void;
  /** When true (default) the line is justified edge-to-edge; false = left-aligned. */
  justify?: boolean;
}

/**
 * Editable single lyric line that fills the row edge-to-edge (Word-style
 * justify). A plain <input> can't justify (no wrapping, no word-spacing spread),
 * so this uses a contentEditable div with `text-align: justify`. To make justify
 * actually stretch a single line to both edges we force a soft wrap by allowing
 * the text to break and applying `text-align-last: justify` — that spreads the
 * words of the (last / only) line across the full width.
 *
 * The DOM text is set imperatively so React re-renders don't reset the caret;
 * edits are committed on input.
 */
export const LyricLine: React.FC<LyricLineProps> = ({ value, width, onChange, justify = true }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  // Sync external value into the div without clobbering the caret while typing.
  React.useEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== value) el.textContent = value;
  }, [value]);

  return (
    <>
      <style>{`
        .lcc-lyric:empty:before {
          content: attr(data-placeholder);
          color: #aaa;
          pointer-events: none;
        }
      `}</style>
    <div
      ref={ref}
      className="lcc-lyric"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="Lyrics for this line"
      data-placeholder="click here to add lyrics!"
      onInput={(e) => onChange((e.currentTarget.textContent ?? '').replace(/\n/g, ' '))}
      style={{
        width,
        minHeight: 30,
        padding: '2px 0',
        margin: '2px 0',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid #ccc',
        outline: 'none',
        fontSize: 18,
        color: '#333',
        // Justify spreads words edge-to-edge; otherwise left-align.
        textAlign: justify ? 'justify' : 'left',
        textAlignLast: justify ? 'justify' : 'left',
        whiteSpace: 'pre-wrap',
        wordBreak: 'normal',
      }}
    />
    </>
  );
};
