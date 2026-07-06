import React from 'react';
import { Box, Button, Typography, IconButton, Tooltip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { RehearsalPage } from './RehearsalPage';
import type { ChordData } from './ChordDiagram';
import type { Composition, PageData } from '../models/Composition';

// Narrower paper so two sheets sit side by side in a normal viewport. Height
// and margin keep the US-Letter ratio (see EditorScreen paper constants).
const PAGE_PAPER_WIDTH = 620;
const PAGE_PAPER_MARGIN = Math.round((PAGE_PAPER_WIDTH * 0.5) / 8.5);
const PAGE_CONTENT_WIDTH = PAGE_PAPER_WIDTH - PAGE_PAPER_MARGIN * 2;
const PAGE_PAPER_HEIGHT = Math.round((PAGE_PAPER_WIDTH * 11) / 8.5);
const SPREAD_GAP = 24; // px between pages (matches the flex gap below)

// Pages shown side by side per spread. At PAGE_PAPER_WIDTH ≈ 620px, three fit
// across a wide screen; the layout scrolls horizontally on narrower viewports.
const PAGES_PER_SPREAD_OPTIONS = [1, 2, 3];
const DEFAULT_PAGES_PER_SPREAD = 3;

interface RehearsalViewProps {
  pages: PageData[];
  composition: Composition;
  chordsData: ChordData[];
  rows: number;
  showStaff: boolean;
  onExit: () => void;
}

/**
 * Read-only rehearsal view: N pages side by side (like an open book/music
 * stand), paged a group at a time. A partial final group shows its pages
 * left-aligned (a lone last page renders alone). Left/Right arrow keys page.
 */
export const RehearsalView: React.FC<RehearsalViewProps> = ({
  pages, composition, chordsData, rows, showStaff, onExit,
}) => {
  const total = pages.length;
  const [perSpread, setPerSpread] = React.useState(DEFAULT_PAGES_PER_SPREAD);
  const spreadCount = Math.ceil(total / perSpread);
  const [spread, setSpread] = React.useState(0);

  // Keep the current spread valid when the group size changes.
  React.useEffect(() => { setSpread((s) => Math.min(s, Math.max(0, spreadCount - 1))); }, [spreadCount]);

  const start = spread * perSpread;
  const indices = Array.from({ length: perSpread }, (_, i) => start + i).filter((i) => i < total);

  const prev = React.useCallback(() => setSpread((s) => Math.max(0, s - 1)), []);
  const next = React.useCallback(() => setSpread((s) => Math.min(spreadCount - 1, s + 1)), [spreadCount]);

  // Scale pages so the whole spread fits the viewport (no scrolling). The scale
  // is the smaller of the height-fit and width-fit ratios for the current group.
  const areaRef = React.useRef<HTMLDivElement>(null);
  const [area, setArea] = React.useState({ w: 0, h: 0 });
  React.useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setArea({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const count = Math.max(1, indices.length);
  const naturalW = count * PAGE_PAPER_WIDTH + (count - 1) * SPREAD_GAP;
  const fitW = area.w > 0 ? area.w / naturalW : 1;
  const fitH = area.h > 0 ? area.h / PAGE_PAPER_HEIGHT : 1;
  // Never upscale past 1 (keeps a single page from ballooning).
  const scale = Math.min(1, fitW, fitH);

  // Arrow-key paging and Esc to exit.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') next();
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') prev();
      else if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onExit]);

  const renderPage = (index: number) => (
    <RehearsalPage
      page={pages[index]}
      composition={composition}
      chordsData={chordsData}
      rows={rows}
      showStaff={showStaff}
      contentWidth={PAGE_CONTENT_WIDTH}
      paperWidth={PAGE_PAPER_WIDTH}
      paperMargin={PAGE_PAPER_MARGIN}
      pageNumber={index + 1}
    />
  );

  return (
    // Full-viewport overlay: covers the app AppBar too, so the spread gets the
    // entire screen height to scale into (its own toolbar replaces the header).
    <Box
      sx={{
        position: 'fixed', inset: 0, zIndex: (t) => t.zIndex.appBar + 1,
        bgcolor: 'background.default', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      {/* Rehearsal toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', position: 'sticky', top: 0, zIndex: 1 }}>
        <Typography sx={{ fontWeight: 600 }}>Rehearsal mode</Typography>
        <Typography variant="body2" color="text.secondary" noWrap sx={{ flex: 1 }}>
          {composition.title || 'Untitled'}
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={perSpread}
          onChange={(_, v) => v && setPerSpread(v)}
        >
          {PAGES_PER_SPREAD_OPTIONS.map((n) => (
            <ToggleButton key={n} value={n}>{n}-up</ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Button variant="outlined" disabled={spread === 0} onClick={prev}>← Prev</Button>
        <Typography variant="body2" sx={{ minWidth: 130, textAlign: 'center' }}>
          {indices.length > 1
            ? `Pages ${indices[0] + 1}–${indices[indices.length - 1] + 1}`
            : `Page ${indices[0] + 1}`} of {total}
        </Typography>
        <Button variant="outlined" disabled={spread >= spreadCount - 1} onClick={next}>Next →</Button>
        <Tooltip title="Exit rehearsal (Esc)">
          <IconButton onClick={onExit}><CloseIcon /></IconButton>
        </Tooltip>
      </Box>

      {/* N-up spread scaled to fit the viewport — no scrolling. */}
      <Box ref={areaRef} sx={{ flex: 1, overflow: 'hidden', p: 2, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <Box sx={{ display: 'flex', gap: `${SPREAD_GAP}px`, alignItems: 'flex-start' }}>
          {indices.map((i) => (
            // Reserve the SCALED footprint so the flex row's total size matches
            // what's drawn; the inner page is transform-scaled from its top-left.
            <Box
              key={i}
              sx={{ width: PAGE_PAPER_WIDTH * scale, height: PAGE_PAPER_HEIGHT * scale, flexShrink: 0 }}
            >
              <Box sx={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                {renderPage(i)}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export { PAGE_PAPER_WIDTH };
