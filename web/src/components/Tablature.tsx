/**
 * Tablature Component (web)
 * Renders 6-string guitar tab with absolutely-positioned divs.
 * Measure-width math matches StaffNotes so tab and staff stay aligned.
 */

import React from 'react';

interface ChordData {
  name: string;
  startingFret: number;
  fingering: string[];
  openStrings: number[];
  mutedStrings: number[];
}

interface TablatureProps {
  beatChords: string[];
  chordsData: ChordData[];
  width: number;
  height?: number;
  numMeasures?: number;
}

export const Tablature: React.FC<TablatureProps> = ({
  beatChords,
  chordsData,
  width,
  height = 60,
  numMeasures = 4,
}) => {
  const totalWidth = width - 20;
  const firstMeasureWidth = numMeasures > 1 ? totalWidth / numMeasures + 40 : totalWidth;
  const otherMeasureWidth = numMeasures > 1 ? (totalWidth - firstMeasureWidth) / (numMeasures - 1) : 0;

  const beatFingerings = beatChords.map((chordName) => {
    if (!chordName || chordName.trim() === '' || chordName === '-') {
      return null;
    }
    const chord = chordsData.find((c) => c.name === chordName);
    return chord ? chord.fingering : null;
  });

  const stringHeight = height / 6;

  const getBarLinePositions = (): number[] => {
    const positions: number[] = [];
    let currentX = 10;
    for (let m = 0; m <= numMeasures; m++) {
      positions.push(currentX);
      if (m === 0) {
        currentX += firstMeasureWidth;
      } else if (m < numMeasures) {
        currentX += otherMeasureWidth;
      }
    }
    return positions;
  };

  const getBeatXPosition = (beatIndex: number): number => {
    const measureIndex = Math.floor(beatIndex / 4);
    const beatWithinMeasure = beatIndex % 4;

    let measureStart = 10;
    if (measureIndex > 0) {
      measureStart = 10 + firstMeasureWidth + (measureIndex - 1) * otherMeasureWidth;
    }

    const currentMeasureWidth = measureIndex === 0 ? firstMeasureWidth : otherMeasureWidth;
    const beatWidth = currentMeasureWidth / 4;

    return measureStart + beatWidth * beatWithinMeasure + beatWidth / 2;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', backgroundColor: '#fff', marginTop: 4, width, height }}>
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Horizontal string lines */}
        {[0, 1, 2, 3, 4, 5].map((stringIndex) => (
          <div
            key={`string-${stringIndex}`}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: '#888',
              top: stringHeight * stringIndex + stringHeight / 2,
            }}
          />
        ))}

        {/* Vertical bar lines */}
        {getBarLinePositions().map((xPos, index) => (
          <div
            key={`bar-${index}`}
            style={{ position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#333', left: xPos }}
          />
        ))}

        {/* Fret numbers for each beat */}
        {beatFingerings.map((fingering, beatIndex) => {
          if (!fingering) return null;
          const beatX = getBeatXPosition(beatIndex);
          // Fingering is [low E .. high e]; display order is [e B G D A E]
          const displayFingering = [...fingering].reverse();

          return (
            <div key={`beat-${beatIndex}`} style={{ position: 'absolute', top: 0, bottom: 0, width: 18, left: beatX - 8 }}>
              {displayFingering.map((fret, stringIndex) => {
                const displayValue = fret === 'x' ? 'x' : fret;
                const yPos = stringHeight * stringIndex + stringHeight / 2;
                return (
                  <div
                    key={`fret-${beatIndex}-${stringIndex}`}
                    style={{
                      position: 'absolute',
                      left: 0,
                      width: 18,
                      height: 12,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      top: yPos - 7,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 'bold',
                        color: '#000',
                        fontFamily: 'monospace',
                        backgroundColor: '#fff',
                        padding: '0 1px',
                        lineHeight: 1,
                      }}
                    >
                      {displayValue}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
