/**
 * Chord diagram components (web)
 * Ported verbatim from the layout math in the RN editor.
 */

import React from 'react';

export interface ChordData {
  name: string;
  startingFret: number;
  fingering: string[];
  openStrings: number[];
  mutedStrings: number[];
  commonFingeringNotes: string;
}

const box = (s: React.CSSProperties): React.CSSProperties => s;

export const MiniChordDiagram: React.FC<{ chord: ChordData }> = ({ chord }) => {
  const fingeringNums = chord.fingering.map((f) => (f === 'x' ? null : parseInt(f, 10)));

  return (
    <div
      style={box({
        backgroundColor: '#fff',
        padding: 6,
        border: '1px solid #ddd',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: 50,
      })}
    >
      <div style={{ fontSize: 9, fontWeight: 'bold', color: '#000', marginBottom: 4, textAlign: 'center' }}>
        {chord.name}
        {chord.startingFret > 1 && ` ${chord.startingFret}fr`}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Indicators */}
        <div style={{ display: 'flex', flexDirection: 'row', marginBottom: 2, justifyContent: 'center' }}>
          {fingeringNums.map((fret, stringIndex) => {
            const isOpen = chord.openStrings.includes(stringIndex);
            const isMuted = chord.mutedStrings.includes(stringIndex) || fret === null;
            return (
              <div key={stringIndex} style={{ width: 8, height: 8, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {isOpen ? (
                  <div style={{ width: 4, height: 4, border: '0.75px solid #000', borderRadius: '50%' }} />
                ) : isMuted ? (
                  <span style={{ fontSize: 7, lineHeight: '8px', color: '#000' }}>×</span>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Grid */}
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#000', zIndex: 10 }} />
          {[0, 1, 2, 3].map((fretNum) => (
            <div key={fretNum} style={{ display: 'flex', flexDirection: 'row', height: 10, position: 'relative' }}>
              {fingeringNums.map((fret, stringIndex) => {
                const isOpen = chord.openStrings.includes(stringIndex);
                const shouldShowDot = fret === fretNum + (chord.startingFret || 0) && !isOpen;
                return (
                  <div key={stringIndex} style={{ width: 8, height: 10, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 0.75, backgroundColor: '#333', transform: 'translateX(-0.375px)' }} />
                    {shouldShowDot && <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#000', zIndex: 5 }} />}
                  </div>
                );
              })}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 0.75, backgroundColor: '#333' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ChordDiagram: React.FC<{ chord: ChordData }> = ({ chord }) => {
  const fingeringNums = chord.fingering.map((f) => (f === 'x' ? null : parseInt(f, 10)));

  return (
    <div
      style={box({
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        border: '1px solid #e0e0e0',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      })}
    >
      <div style={{ fontSize: 28, fontWeight: 'bold', color: '#000', marginBottom: 12, textAlign: 'center' }}>
        {chord.name}
        {chord.startingFret > 1 && ` ${chord.startingFret}fr`}
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Indicators */}
          <div style={{ display: 'flex', flexDirection: 'row', marginBottom: 8, justifyContent: 'center' }}>
            {fingeringNums.map((fret, stringIndex) => {
              const isOpen = chord.openStrings.includes(stringIndex);
              const isMuted = chord.mutedStrings.includes(stringIndex) || fret === null;
              return (
                <div key={stringIndex} style={{ width: 40, height: 32, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {isOpen ? (
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #000' }} />
                  ) : isMuted ? (
                    <span style={{ fontSize: 24, lineHeight: '20px', color: '#000' }}>×</span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: '#000', zIndex: 10 }} />
            {[0, 1, 2, 3, 4].map((fretNum) => (
              <div key={fretNum} style={{ display: 'flex', flexDirection: 'row', height: 50, position: 'relative' }}>
                {fingeringNums.map((fret, stringIndex) => {
                  const isOpen = chord.openStrings.includes(stringIndex);
                  const shouldShowDot = fret === fretNum + (chord.startingFret || 0) && !isOpen;
                  return (
                    <div key={stringIndex} style={{ width: 40, height: 50, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, backgroundColor: '#333', transform: 'translateX(-1px)' }} />
                      {shouldShowDot && <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: '#000', zIndex: 5 }} />}
                    </div>
                  );
                })}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#333' }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 10, color: '#666', marginTop: 12, textAlign: 'center', fontStyle: 'italic', lineHeight: '14px' }}>
        {chord.commonFingeringNotes}
      </div>
    </div>
  );
};
