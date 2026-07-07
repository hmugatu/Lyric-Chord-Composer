import React from 'react';

interface LyricLineProps {
  value: string;
  width: number;
  onChange: (text: string) => void;
  /** When true (default) the line is justified edge-to-edge; false = left-aligned. */
  justify?: boolean;
  /** Karaoke follow-along: 0..1 sweep across this line, or undefined when idle. */
  progress?: number;
  /** Read-only render (rehearsal mode): no contentEditable, no bottom rule. */
  readOnly?: boolean;
}

const HIGHLIGHT_COLOR = '#1976d2';

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
export const LyricLine: React.FC<LyricLineProps> = ({ value, width, onChange, justify = true, progress, readOnly = false }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  // Sync external value into the div without clobbering the caret while typing.
  React.useEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== value) el.textContent = value;
  }, [value]);

  // Text layout shared by the editable line and the karaoke overlay so the
  // colored copy sits exactly on top of the real glyphs.
  const textStyle: React.CSSProperties = {
    width,
    minHeight: 30,
    padding: '2px 0',
    margin: '2px 0',
    fontSize: 18,
    textAlign: justify ? 'justify' : 'left',
    textAlignLast: justify ? 'justify' : 'left',
    whiteSpace: 'pre-wrap',
    wordBreak: 'normal',
    boxSizing: 'border-box',
  };

  const showSweep = progress != null && value.length > 0;

  return (
    <>
      <style>{`
        .lcc-lyric:empty:before {
          content: attr(data-placeholder);
          color: #aaa;
          pointer-events: none;
        }
      `}</style>
    <div style={{ position: 'relative', width }}>
    {readOnly ? (
      // Rehearsal / print-style read-only line: plain text, no caret or rule.
      <div style={{ ...textStyle, color: '#333' }}>{value}</div>
    ) : (
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
        ...textStyle,
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid #ccc',
        outline: 'none',
        color: '#333',
      }}
    />
    )}
    {showSweep && (
      // Non-interactive colored copy clipped to the sweep progress. Sits on top
      // of the editable text (which is dark), so the sung portion reads blue.
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          width: `${Math.round(Math.max(0, Math.min(1, progress!)) * 100)}%`,
        }}
      >
        <div style={{ ...textStyle, color: HIGHLIGHT_COLOR, borderBottom: '1px solid transparent' }}>
          {value}
        </div>
      </div>
    )}
    </div>
    </>
  );
};
