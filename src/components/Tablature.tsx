/**
 * Tablature Component
 * Renders guitar tablature (6 strings with fret numbers) below the staff notation
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ChordData {
  name: string;
  startingFret: number;
  fingering: string[];
  openStrings: number[];
  mutedStrings: number[];
}

interface TablatureProps {
  beatChords: string[];      // Array of chord names (numMeasures * 4 beats)
  chordsData: ChordData[];   // Full chord database to lookup fingerings
  width: number;             // Total width for all measures
  height?: number;           // Height of tablature area (default 60)
  numMeasures?: number;      // Number of measures to display (default 4)
}

// String labels for guitar (high to low: e B G D A E)
const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];

export const Tablature: React.FC<TablatureProps> = ({
  beatChords,
  chordsData,
  width,
  height = 60,
  numMeasures = 4
}) => {
  // Calculate measure widths to match StaffNotes
  const totalWidth = width - 20;
  const firstMeasureWidth = numMeasures > 1
    ? totalWidth / numMeasures + 40
    : totalWidth;
  const otherMeasureWidth = numMeasures > 1
    ? (totalWidth - firstMeasureWidth) / (numMeasures - 1)
    : 0;

  // Get fingering data for each beat's chord
  const beatFingerings = beatChords.map(chordName => {
    if (!chordName || chordName.trim() === '' || chordName === '-') {
      return null;
    }
    const chord = chordsData.find(c => c.name === chordName);
    return chord ? chord.fingering : null;
  });

  const stringHeight = height / 6;

  // Calculate bar line X positions
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

  // Calculate beat X position within measures
  const getBeatXPosition = (beatIndex: number): number => {
    const measureIndex = Math.floor(beatIndex / 4);
    const beatWithinMeasure = beatIndex % 4;

    let measureStart = 10;
    if (measureIndex > 0) {
      measureStart = 10 + firstMeasureWidth + ((measureIndex - 1) * otherMeasureWidth);
    }

    const currentMeasureWidth = measureIndex === 0 ? firstMeasureWidth : otherMeasureWidth;
    const beatWidth = currentMeasureWidth / 4;

    return measureStart + (beatWidth * beatWithinMeasure) + (beatWidth / 2);
  };

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Tab content area */}
      <View style={styles.tabContent}>
        {/* Horizontal string lines */}
        {[0, 1, 2, 3, 4, 5].map((stringIndex) => (
          <View
            key={`string-${stringIndex}`}
            style={[
              styles.stringLine,
              { top: stringHeight * stringIndex + stringHeight / 2 }
            ]}
          />
        ))}

        {/* Vertical bar lines */}
        {getBarLinePositions().map((xPos, index) => (
          <View
            key={`bar-${index}`}
            style={[styles.barLine, { left: xPos }]}
          />
        ))}

        {/* Fret numbers for each beat */}
        {beatFingerings.map((fingering, beatIndex) => {
          if (!fingering) return null;

          const beatX = getBeatXPosition(beatIndex);

          // Fingering array is [low E, A, D, G, B, high e] but we display [e, B, G, D, A, E]
          // So we need to reverse the order for display
          const displayFingering = [...fingering].reverse();

          return (
            <View key={`beat-${beatIndex}`} style={[styles.beatColumn, { left: beatX - 8 }]}>
              {displayFingering.map((fret, stringIndex) => {
                const displayValue = fret === 'x' ? 'x' : fret;
                const yPos = stringHeight * stringIndex + stringHeight / 2;

                return (
                  <View
                    key={`fret-${beatIndex}-${stringIndex}`}
                    style={[styles.fretContainer, { top: yPos - 7 }]}
                  >
                    <Text style={styles.fretNumber}>{displayValue}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginTop: 4,
  },
  labelColumn: {
    width: 14,
    borderRightWidth: 1,
    borderRightColor: '#ccc',
  },
  labelCell: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#555',
    fontFamily: 'monospace',
  },
  tabContent: {
    flex: 1,
    position: 'relative',
  },
  stringLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#888',
  },
  beatColumn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 18,
  },
  fretContainer: {
    position: 'absolute',
    left: 0,
    width: 18,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  fretNumber: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: 'monospace',
  },
  barLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#333',
  },
});
