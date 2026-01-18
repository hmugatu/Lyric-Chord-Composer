/**
 * Note Renderer for Staff Notation
 * Derives notes from chord names and renders them on a musical staff
 */

import Chord from '@tonaljs/chord';
import Note from '@tonaljs/note';

export interface StaffNote {
  pitch: string;      // e.g., "C4", "E4", "G4"
  midiNote: number;   // MIDI note number for positioning
  accidental?: 'sharp' | 'flat' | 'natural';
}

/**
 * Get notes from a chord name using tonal.js
 */
export function getChordNotes(chordName: string): StaffNote[] {
  if (!chordName || chordName.trim() === '' || chordName === '-') {
    return [];
  }

  try {
    // Clean up chord name - remove parenthetical suffixes and normalize
    let cleanName = chordName
      .replace(/\s*\(easy\)/gi, '')
      .replace(/\s*\(barre\)/gi, '')
      .replace(/\s+major$/i, '')
      .replace(/\s+minor$/i, 'm')
      .trim();

    // Parse chord name
    let chord = Chord.get(cleanName);

    // If still no notes, try extracting just root + basic quality
    if (!chord.notes || chord.notes.length === 0) {
      // Extract root note (first 1-2 chars that look like a note)
      const rootMatch = cleanName.match(/^([A-G][#b]?)/i);
      if (rootMatch) {
        const root = rootMatch[1].toUpperCase();
        // Try just the root as major chord
        chord = Chord.get(root);
        if (!chord.notes || chord.notes.length === 0) {
          // Fallback: return just the root note
          return [noteToStaffNote(root, 4)];
        }
      }
    }

    if (!chord.notes || chord.notes.length === 0) {
      return [];
    }

    // Return first 3 notes (root, 3rd, 5th)
    return chord.notes.slice(0, 3).map(noteName => noteToStaffNote(noteName, 4));
  } catch (error) {
    console.warn(`Could not parse chord: ${chordName}`, error);
    return [];
  }
}

/**
 * Convert a note name to a StaffNote with positioning info
 */
function noteToStaffNote(noteName: string, octave: number = 4): StaffNote {
  const fullNote = noteName.includes(String(octave)) ? noteName : `${noteName}${octave}`;
  const midi = Note.midi(fullNote) || 60;

  let accidental: 'sharp' | 'flat' | undefined;
  if (noteName.includes('#')) {
    accidental = 'sharp';
  } else if (noteName.includes('b')) {
    accidental = 'flat';
  }

  return {
    pitch: fullNote,
    midiNote: midi,
    accidental,
  };
}

/**
 * Calculate Y position on staff for a given MIDI note
 * Staff lines (treble clef): E4, G4, B4, D5, F5 from bottom to top
 * Height is divided into 4 spaces (5 lines)
 */
export function getNoteYPosition(midiNote: number, staffHeight: number): number {
  // Map notes to staff positions
  const noteInOctave = midiNote % 12;
  const octave = Math.floor(midiNote / 12) - 1;
  const e4Octave = 4;

  // Staff position mapping for notes (relative to C)
  const staffPositions: {[key: number]: number} = {
    0: 0,   // C
    1: 0,   // C#
    2: 1,   // D
    3: 1,   // D#
    4: 2,   // E
    5: 3,   // F
    6: 3,   // F#
    7: 4,   // G
    8: 4,   // G#
    9: 5,   // A
    10: 5,  // A#
    11: 6,  // B
  };

  const notePosition = staffPositions[noteInOctave];
  const ePosition = 2; // E is at position 2 (C=0, D=1, E=2)

  // Calculate total staff steps from E4
  const octaveDiff = octave - e4Octave;
  const stepsFromE4 = (notePosition - ePosition) + (octaveDiff * 7);

  // Convert to Y position (bottom line = staffHeight, each line is staffHeight/4 apart)
  const lineSpacing = staffHeight / 4;
  const bottomLineY = staffHeight - 2;

  // Each staff step (line or space) is half a line spacing
  const yPosition = bottomLineY - (stepsFromE4 * (lineSpacing / 2));

  // Clamp to reasonable range
  return Math.max(-10, Math.min(staffHeight + 10, yPosition));
}

/**
 * Generate SVG for notes on a staff within a measure
 * @param chordName The chord to render notes for
 * @param width Width of the measure in pixels
 * @param height Height of the staff area in pixels
 */
export function generateNotesSvg(
  chordName: string,
  width: number,
  height: number
): string {
  const notes = getChordNotes(chordName);

  if (notes.length === 0) {
    return '';
  }

  const noteRadius = Math.min(height / 10, 6);
  const stemHeight = height * 0.4;
  const centerX = width / 2;

  // Stack notes vertically (chord voicing)
  const svgNotes = notes.map((note, index) => {
    const yPos = getNoteYPosition(note.midiNote, height * 0.7) + (height * 0.15);
    // Offset notes horizontally slightly to avoid overlap
    const xOffset = (index - (notes.length - 1) / 2) * (noteRadius * 0.8);
    const x = centerX + xOffset;

    let accidentalSvg = '';
    if (note.accidental === 'sharp') {
      accidentalSvg = `<text x="${x - noteRadius * 2}" y="${yPos + 3}" font-size="${noteRadius * 1.5}" fill="#000">#</text>`;
    } else if (note.accidental === 'flat') {
      accidentalSvg = `<text x="${x - noteRadius * 2}" y="${yPos + 3}" font-size="${noteRadius * 1.5}" fill="#000">♭</text>`;
    }

    // Note head (filled ellipse for quarter note)
    return `
      ${accidentalSvg}
      <ellipse cx="${x}" cy="${yPos}" rx="${noteRadius}" ry="${noteRadius * 0.7}" fill="#000" transform="rotate(-15, ${x}, ${yPos})" />
    `;
  }).join('');

  // Add stem (single stem for chord)
  const topNoteY = Math.min(...notes.map(n => getNoteYPosition(n.midiNote, height * 0.7) + (height * 0.15)));
  const stemX = centerX + noteRadius - 1;
  const stemSvg = `<line x1="${stemX}" y1="${topNoteY}" x2="${stemX}" y2="${topNoteY - stemHeight}" stroke="#000" stroke-width="1.5" />`;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="position: absolute; top: 0; left: 0;">
      ${svgNotes}
      ${stemSvg}
    </svg>
  `;
}

/**
 * Generate inline SVG string for HTML print output
 */
export function generateNotesHtml(
  beatChords: string[],
  measureWidth: number,
  staffHeight: number
): string {
  const beatWidth = measureWidth / 4;

  const notesHtml = beatChords.map((chord, beatIndex) => {
    if (!chord || chord.trim() === '') return '';

    const notes = getChordNotes(chord);
    if (notes.length === 0) return '';

    const noteRadius = Math.min(staffHeight / 12, 5);
    const centerX = beatWidth * beatIndex + beatWidth / 2;

    // Generate note heads
    const noteHeads = notes.slice(0, 3).map((note, noteIndex) => {
      const yPos = getNoteYPosition(note.midiNote, staffHeight * 0.75) + (staffHeight * 0.1);
      const xOffset = (noteIndex - 1) * (noteRadius * 0.5);
      const x = centerX + xOffset;

      let accidentalSvg = '';
      if (note.accidental) {
        const symbol = note.accidental === 'sharp' ? '#' : '♭';
        accidentalSvg = `<text x="${x - noteRadius * 1.8}" y="${yPos + 2}" font-size="${noteRadius * 1.2}" font-family="serif" fill="#000">${symbol}</text>`;
      }

      return `${accidentalSvg}<ellipse cx="${x}" cy="${yPos}" rx="${noteRadius}" ry="${noteRadius * 0.65}" fill="#000" transform="rotate(-15, ${x}, ${yPos})" />`;
    }).join('');

    // Add stem
    const topNoteY = Math.min(...notes.slice(0, 3).map(n => getNoteYPosition(n.midiNote, staffHeight * 0.75) + (staffHeight * 0.1)));
    const stemX = centerX + noteRadius - 0.5;
    const stemSvg = `<line x1="${stemX}" y1="${topNoteY}" x2="${stemX}" y2="${topNoteY - staffHeight * 0.35}" stroke="#000" stroke-width="1" />`;

    return `${noteHeads}${stemSvg}`;
  }).join('');

  if (!notesHtml) return '';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${measureWidth} ${staffHeight}" preserveAspectRatio="xMidYMid meet" style="position: absolute; top: 15%; left: 0; right: 0; bottom: 10%;">
      ${notesHtml}
    </svg>
  `;
}

/**
 * Chord data interface for tablature generation
 */
export interface ChordDataForTab {
  name: string;
  fingering: string[];
}

/**
 * Generate inline SVG string for tablature in HTML print output
 */
export function generateTablatureHtml(
  beatChords: string[],
  chordsData: ChordDataForTab[],
  measureWidth: number,
  tabHeight: number
): string {
  // Check if there are any chords
  const hasChords = beatChords.some(c => c && c.trim() !== '' && c !== '-');
  if (!hasChords) return '';

  const beatWidth = measureWidth / 4;
  const stringSpacing = tabHeight / 6;
  const labelWidth = 12;
  const contentWidth = measureWidth - labelWidth;

  // String labels (high to low: e B G D A E)
  const stringLabels = ['e', 'B', 'G', 'D', 'A', 'E'];

  // Generate string lines
  const stringLines = stringLabels.map((_, index) => {
    const y = stringSpacing * index + stringSpacing / 2;
    return `<line x1="${labelWidth}" y1="${y}" x2="${measureWidth}" y2="${y}" stroke="#999" stroke-width="0.5" />`;
  }).join('');

  // Generate string labels
  const labels = stringLabels.map((label, index) => {
    const y = stringSpacing * index + stringSpacing / 2 + 3;
    return `<text x="2" y="${y}" font-size="7" font-family="monospace" font-weight="bold" fill="#666">${label}</text>`;
  }).join('');

  // Generate fret numbers for each beat
  const fretNumbers = beatChords.map((chordName, beatIndex) => {
    if (!chordName || chordName.trim() === '' || chordName === '-') return '';

    const chord = chordsData.find(c => c.name === chordName);
    if (!chord || !chord.fingering) return '';

    const beatX = labelWidth + (contentWidth / 4) * beatIndex + (contentWidth / 4) / 2;

    // Fingering array is [low E, A, D, G, B, high e] but we display [e, B, G, D, A, E]
    // So we need to reverse the order for display
    const displayFingering = [...chord.fingering].reverse();

    return displayFingering.map((fret, stringIndex) => {
      const y = stringSpacing * stringIndex + stringSpacing / 2 + 3;
      const displayValue = fret === 'x' ? 'x' : fret;
      // Transparent background for fret number - lines show through
      const bgRect = `<rect x="${beatX - 5}" y="${y - 8}" width="10" height="10" fill="none" />`;
      const text = `<text x="${beatX}" y="${y}" font-size="8" font-family="monospace" font-weight="bold" fill="#000" text-anchor="middle">${displayValue}</text>`;
      return bgRect + text;
    }).join('');
  }).join('');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${tabHeight}" viewBox="0 0 ${measureWidth} ${tabHeight}" preserveAspectRatio="xMidYMid meet" style="margin-top: 2px;">
      ${stringLines}
      ${labels}
      ${fretNumbers}
    </svg>
  `;
}
