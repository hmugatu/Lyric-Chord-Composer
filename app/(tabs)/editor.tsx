import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TextInput as RNTextInput, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Button, Dialog, Portal, IconButton, TextInput, Tooltip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCompositionStore } from '../../src/store/compositionStore';
import { CompositionStorageService } from '../../src/services/compositionService';
import { CompositionSyncManager } from '../../src/services/compositionSyncManager';
import chordsDataJson from '../../chords/chords.json';

type EditorView = 'chords' | 'tabs' | 'notation' | 'lyrics';

interface ChordData {
  name: string;
  startingFret: number;
  fingering: string[];
  openStrings: number[];
  mutedStrings: number[];
  commonFingeringNotes: string;
}

const MiniChordDiagram: React.FC<{ chord: ChordData }> = ({ chord }) => {
  const fingeringNums = chord.fingering.map(f => f === 'x' ? null : parseInt(f, 10));

  return (
    <View style={styles.miniChordContainer}>
      {/* Chord Name */}
      <Text style={styles.miniChordName}>
        {chord.name}
        {chord.startingFret > 1 && ` ${chord.startingFret}fr`}
      </Text>

      <View style={styles.miniDiagramContent}>
        {/* Top indicators (open/muted) */}
        <View style={styles.miniIndicatorsRow}>
          {fingeringNums.map((fret, stringIndex) => {
            const isOpen = chord.openStrings.includes(stringIndex);
            const isMuted = chord.mutedStrings.includes(stringIndex) || fret === null;

            return (
              <View key={`indicator-${stringIndex}`} style={styles.miniStringIndicator}>
                {isOpen ? (
                  <View style={styles.miniOpenCircle} />
                ) : isMuted ? (
                  <View style={styles.miniMutedXContainer}>
                    <View style={styles.miniMutedXLine1} />
                    <View style={styles.miniMutedXLine2} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Grid */}
        <View style={styles.miniGridContainer}>
          <View style={styles.miniNutLine} />

          {[0, 1, 2, 3].map((fretNum) => (
            <View key={`fret-${fretNum}`} style={styles.miniFretRow}>
              {fingeringNums.map((fret, stringIndex) => {
                const isOpen = chord.openStrings.includes(stringIndex);
                const shouldShowDot = fret === fretNum + (chord.startingFret || 0) && !isOpen;

                return (
                  <View key={`cell-${fretNum}-${stringIndex}`} style={styles.miniFretCell}>
                    <View style={styles.miniStringLine} />
                    {shouldShowDot && <View style={styles.miniFingerDot} />}
                  </View>
                );
              })}
              <View style={styles.miniFretLine} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const ChordDiagram: React.FC<{ chord: ChordData }> = ({ chord }) => {
  const FRET_HEIGHT = 50;
  const STRING_WIDTH = 40;
  const NUM_STRINGS = 6;
  const NUM_FRETS = 5;

  // Convert string fingering to numbers for comparison
  const fingeringNums = chord.fingering.map(f => f === 'x' ? null : parseInt(f, 10));

  return (
    <View style={styles.chordDiagramContainer}>
      {/* Chord Name at Top with Starting Fret */}
      <Text style={styles.chordName}>
        {chord.name}
        {chord.startingFret > 1 && ` ${chord.startingFret}fr`}
      </Text>

      <View style={styles.diagramWrapper}>
        <View style={styles.diagramContent}>
          {/* Top indicators row (open/muted) - Above the nut */}
          <View style={styles.indicatorsRow}>
            {fingeringNums.map((fret, stringIndex) => {
              const isOpen = chord.openStrings.includes(stringIndex);
              const isMuted = chord.mutedStrings.includes(stringIndex) || fret === null;

              return (
                <View key={`indicator-${stringIndex}`} style={styles.stringIndicator}>
                  {isOpen ? (
                    <View style={styles.openCircle} />
                  ) : isMuted ? (
                    <View style={styles.mutedXContainer}>
                      <View style={styles.mutedXLine1} />
                      <View style={styles.mutedXLine2} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          {/* Chord Grid */}
          <View style={styles.gridContainer}>
            {/* Nut (thick top line) */}
            <View style={styles.nutLine} />

            {/* Fret grid */}
            {[0, 1, 2, 3, 4].map((fretNum) => (
              <View key={`fret-${fretNum}`} style={styles.fretRow}>
                {fingeringNums.map((fret, stringIndex) => {
                  const isOpen = chord.openStrings.includes(stringIndex);
                  const shouldShowDot = fret === fretNum + (chord.startingFret || 0) && !isOpen;

                  return (
                    <View
                      key={`cell-${fretNum}-${stringIndex}`}
                      style={styles.fretCell}
                    >
                      {/* Vertical string line */}
                      <View style={styles.stringLine} />

                      {/* Finger dot */}
                      {shouldShowDot && <View style={styles.fingerDot} />}
                    </View>
                  );
                })}
                {/* Horizontal fret line at bottom of row */}
                <View style={styles.fretLine} />
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Fingering notes at bottom */}
      <Text style={styles.commonNotes}>{chord.commonFingeringNotes}</Text>
    </View>
  );
};

export default function EditorScreen() {
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tempo, setTempo] = useState('');
  const [key, setKey] = useState('');
  const [capo, setCapo] = useState('');
  const [beats, setBeats] = useState('');
  const [beatValue, setBeatValue] = useState('');
  const [tuningName, setTuningName] = useState('');
  const [hoveredChordName, setHoveredChordName] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [allPages, setAllPages] = useState<{barLyrics: string[], barBeatChords: string[][]}[]>([{
    barLyrics: Array(16).fill(''),
    barBeatChords: Array(16).fill(null).map(() => Array(4).fill(''))
  }]);
  const [tooltipVisible, setTooltipVisible] = useState<{[key: number]: boolean}>({});
  const [showChordModal, setShowChordModal] = useState(false);

  // Calculate responsive chord margin based on screen width
  const screenWidth = Dimensions.get('window').width;
  const responsiveChordMargin = Math.max(8, Math.min(30, screenWidth * 0.05)); // Between 8px and 30px

  // Current page data (for backward compatibility with existing code)
  const barLyrics = allPages[currentPage]?.barLyrics || Array(16).fill('');
  const barBeatChords = allPages[currentPage]?.barBeatChords || Array(16).fill(null).map(() => Array(4).fill(''));

  const setBarLyrics = (newLyrics: string[]) => {
    const newPages = [...allPages];
    newPages[currentPage] = { ...newPages[currentPage], barLyrics: newLyrics };
    setAllPages(newPages);
  };

  const setBarBeatChords = (newChords: string[][]) => {
    const newPages = [...allPages];
    newPages[currentPage] = { ...newPages[currentPage], barBeatChords: newChords };
    setAllPages(newPages);
  };
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);
  const [selectedBeatIndex, setSelectedBeatIndex] = useState<number | null>(null);
  const [availableChords, setAvailableChords] = useState<string[]>([]);
  const [chordSearchText, setChordSearchText] = useState('');
  const [chordsData, setChordsData] = useState<ChordData[]>([]);
  const [selectedChordData, setSelectedChordData] = useState<ChordData | null>(null);
  
  const currentComposition = useCompositionStore((state) => state.currentComposition);
  const updateGlobalSettings = useCompositionStore((state) => state.updateGlobalSettings);
  const updateComposition = useCompositionStore((state) => state.updateComposition);
  const createComposition = useCompositionStore((state) => state.createComposition);
  const compositions = useCompositionStore((state) => state.compositions);
  const storageService = new CompositionStorageService();
  const syncManager = new CompositionSyncManager();

  // Load chords from JSON file
  React.useEffect(() => {
    try {
      const chordsData: ChordData[] = chordsDataJson as ChordData[];
      const chordNames = chordsData.map(c => c.name);
      setAvailableChords(chordNames);
      setChordsData(chordsData);
    } catch (error) {
      console.log('Could not load chords from JSON:', error);
      // Fallback to common chord names
      setAvailableChords(['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm', 'C7', 'D7', 'E7', 'F7', 'G7', 'A7', 'B7']);
    }
  }, []);

  // Initialize settings from composition
  React.useEffect(() => {
    if (currentComposition) {
      setTempo(currentComposition.globalSettings.tempo.toString());
      setKey(currentComposition.globalSettings.key);
      setCapo((currentComposition.globalSettings.capo || 0).toString());
      setBeats(currentComposition.globalSettings.timeSignature.beats.toString());
      setBeatValue(currentComposition.globalSettings.timeSignature.beatValue.toString());
      setTuningName(currentComposition.globalSettings.tuning.name);
      
      // Load bar data from composition notes if exists
      if (currentComposition.notes) {
        try {
          const barData = JSON.parse(currentComposition.notes);

          // Check if we have multi-page format
          if (barData.pages && Array.isArray(barData.pages)) {
            setAllPages(barData.pages);
            setCurrentPage(0);
          }
          // Legacy single-page format
          else if (barData.barLyrics && barData.barBeatChords) {
            setAllPages([{
              barLyrics: barData.barLyrics,
              barBeatChords: barData.barBeatChords
            }]);
            setCurrentPage(0);
          }
          // Very old format with barChords
          else if (barData.barChords) {
            const newBeatChords = barData.barChords.map((chord: string) => [chord, '', '', '']);
            setAllPages([{
              barLyrics: Array(16).fill(''),
              barBeatChords: newBeatChords
            }]);
            setCurrentPage(0);
          }
        } catch (e) {
          // Notes not in expected format, use defaults
        }
      }
    }
  }, [currentComposition?.id]);

  const handleLyricsChange = (barIndex: number, text: string) => {
    const newLyrics = [...barLyrics];
    newLyrics[barIndex] = text;
    setBarLyrics(newLyrics);
    
    // Save to composition with pages structure
    if (currentComposition) {
      const barData = {
        pages: allPages
      };
      updateComposition({
        notes: JSON.stringify(barData),
      });
    }
  };

  const handleBeatChordChange = (barIndex: number, beatIndex: number, chord: string) => {
    const newChords = barBeatChords.map(row => [...row]);
    newChords[barIndex][beatIndex] = chord;
    setBarBeatChords(newChords);
    
    // Save to composition with pages structure
    if (currentComposition) {
      const barData = {
        pages: allPages
      };
      updateComposition({
        notes: JSON.stringify(barData),
      });
    }
  };

  const openChordSelector = (barIndex: number, beatIndex: number) => {
    setSelectedBarIndex(barIndex);
    setSelectedBeatIndex(beatIndex);
    setChordSearchText('');
    setShowChordModal(true);
  };

  const selectChord = (chord: string) => {
    if (selectedBarIndex !== null && selectedBeatIndex !== null) {
      handleBeatChordChange(selectedBarIndex, selectedBeatIndex, chord);
      const chordDetail = chordsData.find(c => c.name === chord);
      if (chordDetail) {
        setSelectedChordData(chordDetail);
        // Close modal after confirming selection
        setTimeout(() => {
          setShowChordModal(false);
          setChordSearchText('');
          setSelectedChordData(null);
        }, 500);
      }
    }
  };

  const filteredChords = availableChords.filter(chord =>
    chord.toLowerCase().includes(chordSearchText.toLowerCase())
  );

  const handleCreateNew = () => {
    const title = `New Composition ${compositions.length + 1}`;
    createComposition(title);
  };

  const handleSettingsSave = () => {
    if (!currentComposition) return;

    try {
      updateGlobalSettings({
        tempo: parseInt(tempo) || 120,
        key: key || 'C',
        capo: parseInt(capo) || 0,
        timeSignature: {
          beats: parseInt(beats) || 4,
          beatValue: parseInt(beatValue) || 4,
        },
        tuning: {
          ...currentComposition.globalSettings.tuning,
          name: tuningName || 'Standard',
        },
      });
      setShowSettingsDialog(false);
      Alert.alert('Success', 'Settings saved');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const handleSaveToDesktop = async () => {
    if (!currentComposition) {
      Alert.alert('Error', 'No composition to save');
      return;
    }

    try {
      setIsSaving(true);

      // Update composition with current title before saving
      const compositionToSave = {
        ...currentComposition,
        title: currentComposition.title || 'Untitled Song',
        updatedAt: new Date(),
      };

      console.log('Saving composition:', compositionToSave.title);

      await storageService.setProvider('local');
      await storageService.exportComposition(compositionToSave);

      console.log('Export completed successfully');
      Alert.alert('Success', `Composition saved as ${compositionToSave.title}.hmlcc`);
    } catch (error) {
      console.error('Save to desktop error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save';
      Alert.alert('Error', `Failed to save: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToGoogleDrive = async () => {
    if (!currentComposition) {
      Alert.alert('Error', 'No composition to save');
      return;
    }

    try {
      setIsSaving(true);

      // Update composition with current title before saving
      const compositionToSave = {
        ...currentComposition,
        title: currentComposition.title || 'Untitled Song',
        updatedAt: new Date(),
      };

      await storageService.setProvider('google-drive');
      const metadata = await syncManager.uploadCompositionToCloud(compositionToSave, 'google-drive');
      if (metadata) {
        Alert.alert('Success', 'Composition saved to Google Drive');
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save to Google Drive');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToOneDrive = async () => {
    if (!currentComposition) {
      Alert.alert('Error', 'No composition to save');
      return;
    }

    try {
      setIsSaving(true);

      // Update composition with current title before saving
      const compositionToSave = {
        ...currentComposition,
        title: currentComposition.title || 'Untitled Song',
        updatedAt: new Date(),
      };

      await storageService.setProvider('onedrive');
      const metadata = await syncManager.uploadCompositionToCloud(compositionToSave, 'onedrive');
      if (metadata) {
        Alert.alert('Success', 'Composition saved to OneDrive');
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save to OneDrive');
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentComposition) {
    return (
      <View style={styles.container}>
        <View style={styles.empty}>
          <Text variant="titleLarge">No composition selected</Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Create or open a composition to start editing
          </Text>
          <Button mode="contained" onPress={handleCreateNew} style={styles.button}>
            Create New Composition
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <RNTextInput
            style={styles.titleInput}
            value={currentComposition.title}
            onChangeText={(text) => updateComposition({ title: text })}
            placeholder="Untitled Song"
            placeholderTextColor="#999"
          />
          <View style={styles.headerButtons}>
            <IconButton
              icon="cog"
              size={24}
              onPress={() => setShowSettingsDialog(true)}
            />
            <IconButton
              icon="content-save"
              size={24}
              onPress={handleSaveToDesktop}
              disabled={isSaving}
              iconColor="#6200ee"
            />
            <IconButton
              icon="google-drive"
              size={24}
              onPress={handleSaveToGoogleDrive}
              disabled={isSaving}
              iconColor="#4285F4"
            />
            <IconButton
              icon="microsoft-onedrive"
              size={24}
              onPress={handleSaveToOneDrive}
              disabled={isSaving}
              iconColor="#0078D4"
            />
          </View>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Global Settings Bar */}
        <View style={styles.settingsBar}>
          <View style={styles.settingsItem}>
            <Text style={styles.settingLabel}>Key: </Text>
            <Text style={styles.settingValue}>{currentComposition.globalSettings.key}</Text>
          </View>
          <View style={styles.settingsItem}>
            <Text style={styles.settingLabel}>Tempo: </Text>
            <Text style={styles.settingValue}>♩ = {currentComposition.globalSettings.tempo}</Text>
          </View>
          <View style={styles.settingsItem}>
            <Text style={styles.settingLabel}>Capo: </Text>
            <Text style={styles.settingValue}>{currentComposition.globalSettings.capo || 'None'}</Text>
          </View>
        </View>

        {/* Page Navigation */}
        <View style={styles.pageNavContainer}>
          <Button
            mode="outlined"
            onPress={() => {
              if (currentPage > 0) setCurrentPage(currentPage - 1);
            }}
            disabled={currentPage === 0}
            style={styles.pageButton}
          >
            ← Previous
          </Button>
          <View style={styles.pageInfo}>
            <Text style={styles.pageNumber}>Page {currentPage + 1} of {allPages.length}</Text>
            <Text style={styles.pageDescription}>(16 bars per page)</Text>
          </View>
          <Button
            mode="outlined"
            onPress={() => {
              if (currentPage < allPages.length - 1) {
                setCurrentPage(currentPage + 1);
              } else {
                // Add new page
                setAllPages([...allPages, {
                  barLyrics: Array(16).fill(''),
                  barBeatChords: Array(16).fill(null).map(() => Array(4).fill(''))
                }]);
                setCurrentPage(allPages.length);
              }
            }}
            style={styles.pageButton}
          >
            {currentPage === allPages.length - 1 ? '+ Add Page' : 'Next →'}
          </Button>
        </View>

        {/* Chord Reference Section - Show unique chords (only on first page) */}
        {currentPage === 0 && (() => {
          // Get all unique chords used across ALL pages in the composition
          const usedChordNames = new Set<string>();
          allPages.forEach(page => {
            page.barBeatChords.forEach(bar => {
              bar.forEach(chord => {
                if (chord) usedChordNames.add(chord);
              });
            });
          });

          const uniqueChords = Array.from(usedChordNames)
            .map(name => chordsData.find(c => c.name === name))
            .filter(chord => chord !== undefined) as ChordData[];

          if (uniqueChords.length === 0) return null;

          return (
            <View style={styles.chordReferenceSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chordReferenceScroll}>
                {uniqueChords.map((chord, index) => (
                  <View key={index} style={styles.miniChordDiagramWrapper}>
                    <MiniChordDiagram chord={chord} />
                  </View>
                ))}
              </ScrollView>
            </View>
          );
        })()}

        {/* 16 Bars Sheet Music Layout (4 rows x 4 bars) */}
        <View style={styles.sheetMusicContainer}>
          {[0, 1, 2, 3].map((rowIndex) => (
            <View key={rowIndex} style={styles.barRow}>
              {[0, 1, 2, 3].map((colIndex) => {
                const barNumber = rowIndex * 4 + colIndex + 1;
                const barIndex = barNumber - 1;
                return (
                  <View key={barNumber} style={styles.barContainer}>
                    {/* Editable Lyrics Text Box */}
                    <Tooltip 
                      title="click here to add lyrics!"
                    >
                      <RNTextInput
                        style={styles.lyricsInput}
                        value={barLyrics[barIndex]}
                        onChangeText={(text) => handleLyricsChange(barIndex, text)}
                        onFocus={() => setTooltipVisible({})}
                        placeholder=""
                        placeholderTextColor="#999"
                        multiline={false}
                      />
                    </Tooltip>
                    
                    {/* Chord Boxes for Each Beat */}
                    <View style={styles.beatChordRow}>
                      {[0, 1, 2, 3].map((beatIndex) => {
                        const chordName = barBeatChords[barIndex][beatIndex];
                        const chordData = chordName ? chordsData.find(c => c.name === chordName) : null;
                        const isHovered = hoveredChordName === chordName && chordName;
                        
                        return (
                          <Tooltip 
                            key={beatIndex}
                            title={isHovered && chordData ? <View style={styles.tooltipChordDiagram}><View style={styles.tooltipChordContent}><MiniChordDiagram chord={chordData} /></View></View> : (!chordName ? "click to select chord!" : undefined)}
                          >
                            <TouchableOpacity
                              style={[styles.beatChordBox, { marginHorizontal: responsiveChordMargin }]}
                              onPress={() => openChordSelector(barIndex, beatIndex)}
                              onMouseEnter={() => chordName && setHoveredChordName(chordName)}
                              onMouseLeave={() => setHoveredChordName(null)}
                            >
                              <Text style={styles.beatChordText}>
                                {barBeatChords[barIndex][beatIndex] || '-'}
                              </Text>
                            </TouchableOpacity>
                          </Tooltip>
                        );
                      })}
                    </View>
                    
                    {/* Bar/Measure */}
                    <View style={styles.measureBox}>
                      <Text style={styles.barNumber}>{barNumber}</Text>
                      
                      {/* Staff Lines */}
                      <View style={styles.staffLines}>
                        {[0, 1, 2, 3, 4].map((lineIndex) => (
                          <View key={lineIndex} style={styles.staffLine} />
                        ))}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <Portal>
        {/* Chord Selector Modal */}
        <Dialog visible={showChordModal} onDismiss={() => setShowChordModal(false)} style={styles.chordDialog}>
          <Dialog.Title>Select a Chord</Dialog.Title>
          <Dialog.Content style={styles.chordDialogContent}>
            {/* Left Panel - Search & Listbox */}
            <View style={styles.leftPanel}>
              {/* Search Input */}
              <TextInput
                label="Search chords"
                value={chordSearchText}
                onChangeText={setChordSearchText}
                mode="outlined"
                placeholder="e.g., C, Dm, G7"
                style={styles.chordSearchInput}
                left={<TextInput.Icon icon="magnify" />}
                autoFocus
              />
              
              {/* Chord Listbox */}
              <View style={styles.chordListbox}>
                <FlatList
                  data={filteredChords}
                  keyExtractor={(item, index) => index.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.listboxItem,
                        selectedChordData?.name === item && styles.listboxItemSelected
                      ]}
                      onPress={() => {
                        const chordDetail = chordsData.find(c => c.name === item);
                        if (chordDetail) {
                          setSelectedChordData(chordDetail);
                        }
                      }}
                    >
                      <Text style={[
                        styles.listboxItemText,
                        selectedChordData?.name === item && styles.listboxItemTextSelected
                      ]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )}
                  scrollEnabled={true}
                  nestedScrollEnabled={true}
                />
              </View>
            </View>

            {/* Right Panel - Chord Preview */}
            <View style={styles.rightPanel}>
              {selectedChordData ? (
                <>
                  <ChordDiagram chord={selectedChordData} />
                  {/* Common Fingering Notes */}
                  <View style={styles.fingeeringNotesContainer}>
                    <Text style={styles.fingeeringNotesLabel}>How to Play:</Text>
                    <Text style={styles.fingeeringNotesText}>
                      {selectedChordData.commonFingeringNotes}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.emptyPreview}>
                  <Text style={styles.emptyPreviewText}>
                    Select a chord from the list to view details
                  </Text>
                </View>
              )}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            {selectedChordData && (
              <Button
                mode="contained"
                onPress={() => selectChord(selectedChordData.name)}
              >
                Select
              </Button>
            )}
            <Button
              onPress={() => {
                if (selectedBarIndex !== null && selectedBeatIndex !== null) {
                  handleBeatChordChange(selectedBarIndex, selectedBeatIndex, '');
                  setShowChordModal(false);
                  setChordSearchText('');
                  setSelectedChordData(null);
                }
              }}
            >
              Clear
            </Button>
            <Button
              onPress={() => {
                setShowChordModal(false);
                setChordSearchText('');
                setSelectedChordData(null);
              }}
            >
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showSettingsDialog} onDismiss={() => setShowSettingsDialog(false)}>
          <Dialog.Title>Composition Settings</Dialog.Title>
          <Dialog.Content>
            <View style={styles.settingsContent}>
              <TextInput
                label="Key"
                value={key}
                onChangeText={setKey}
                mode="outlined"
                placeholder="e.g., C, G, D"
                style={styles.settingsInput}
              />
              <TextInput
                label="Tempo (BPM)"
                value={tempo}
                onChangeText={setTempo}
                mode="outlined"
                keyboardType="numeric"
                placeholder="120"
                style={styles.settingsInput}
              />
              <TextInput
                label="Capo"
                value={capo}
                onChangeText={setCapo}
                mode="outlined"
                keyboardType="numeric"
                placeholder="0"
                style={styles.settingsInput}
              />
              <View style={styles.timeSignatureRow}>
                <TextInput
                  label="Beats"
                  value={beats}
                  onChangeText={setBeats}
                  mode="outlined"
                  keyboardType="numeric"
                  placeholder="4"
                  style={styles.timeSignatureInput}
                />
                <Text style={styles.timeSignatureSeparator}>/</Text>
                <TextInput
                  label="Beat Value"
                  value={beatValue}
                  onChangeText={setBeatValue}
                  mode="outlined"
                  keyboardType="numeric"
                  placeholder="4"
                  style={styles.timeSignatureInput}
                />
              </View>
              <TextInput
                label="Tuning"
                value={tuningName}
                onChangeText={setTuningName}
                mode="outlined"
                placeholder="e.g., Standard, Drop D"
                style={styles.settingsInput}
              />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowSettingsDialog(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleSettingsSave}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },
  titleSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  songTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  artistName: {
    fontSize: 18,
    fontStyle: 'italic',
    color: '#666',
  },
  settingsBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    justifyContent: 'flex-start',
    gap: 24,
  },
  pageNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#f5f5f5',
  },
  pageButton: {
    flex: 0,
    marginHorizontal: 4,
  },
  pageInfo: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  pageNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  pageDescription: {
    fontSize: 12,
    color: '#999',
  },
  chordReferenceSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  chordReferenceTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  chordReferenceScroll: {
    flexDirection: 'row',
  },
  miniChordDiagramWrapper: {
    marginRight: 12,
  },
  miniChordContainer: {
    backgroundColor: '#fff',
    borderRadius: 0,
    padding: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    minWidth: 50,
  },
  miniChordName: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
    textAlign: 'center',
  },
  miniDiagramContent: {
    alignItems: 'center',
  },
  miniIndicatorsRow: {
    flexDirection: 'row',
    marginBottom: 2,
    justifyContent: 'center',
  },
  miniStringIndicator: {
    width: 8,
    height: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniOpenCircle: {
    width: 4,
    height: 4,
    borderRadius: 0,
    borderWidth: 0.75,
    borderColor: '#000',
    backgroundColor: 'transparent',
  },
  miniMutedXContainer: {
    width: 5,
    height: 5,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniMutedXLine1: {
    position: 'absolute',
    width: 5,
    height: 1,
    backgroundColor: '#000',
    transform: [{ rotate: '45deg' }],
  },
  miniMutedXLine2: {
    position: 'absolute',
    width: 5,
    height: 1,
    backgroundColor: '#000',
    transform: [{ rotate: '-45deg' }],
  },
  miniGridContainer: {
    backgroundColor: 'transparent',
    position: 'relative',
  },
  miniNutLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#000',
    zIndex: 10,
  },
  miniFretRow: {
    flexDirection: 'row',
    height: 10,
    position: 'relative',
  },
  miniFretCell: {
    width: 8,
    height: 10,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  miniStringLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 0.75,
    backgroundColor: '#333',
    transform: [{ translateX: -0.375 }],
  },
  miniFretLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 0.75,
    backgroundColor: '#333',
  },
  miniFingerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#000',
    zIndex: 5,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  settingValue: {
    fontSize: 12,
    marginLeft: 4,
  },
  sheetMusicContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  barRow: {
    flexDirection: 'row',
    marginBottom: 40,
    justifyContent: 'space-between',
  },
  barContainer: {
    flex: 1,
    marginHorizontal: 0,
  },
  lyricsInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    padding: 6,
    marginBottom: 4,
    minHeight: 30,
    fontSize: 11,
    textAlign: 'center',
    color: '#333',
  },
  chordBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 0,
    padding: 4,
    marginBottom: 4,
    minHeight: 24,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000',
  },
  lyricsBox: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 0,
    padding: 6,
    marginBottom: 8,
    minHeight: 30,
    justifyContent: 'center',
  },
  lyricsText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  measureBox: {
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 0,
    padding: 8,
    backgroundColor: '#fff',
    minHeight: 80,
    position: 'relative',
  },
  barNumber: {
    position: 'absolute',
    top: 2,
    left: 4,
    fontSize: 9,
    color: '#999',
    fontWeight: 'bold',
  },
  staffLines: {
    marginTop: 16,
    height: 40,
    justifyContent: 'space-between',
  },
  staffLine: {
    height: 1,
    backgroundColor: '#333',
    width: '100%',
  },
  chordInput: {
    position: 'absolute',
    top: 20,
    left: '50%',
    transform: [{ translateX: -20 }],
    backgroundColor: '#fff',
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    minWidth: 40,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chordSymbol: {
    position: 'absolute',
    top: 24,
    left: '50%',
    transform: [{ translateX: -15 }],
    backgroundColor: '#fff',
    paddingHorizontal: 4,
  },
  chordText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  sectionsContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  sheetSection: {
    marginBottom: 32,
  },
  sectionTitleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionType: {
    fontSize: 10,
    color: '#999',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  chordBar: {
    backgroundColor: '#fff8dc',
    borderWidth: 2,
    borderColor: '#ffd700',
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
  },
  chordsLineContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chordBoxInline: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 3,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 40,
    alignItems: 'center',
  },
  chordNameInline: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  lyricsSection: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#6200ee',
    marginBottom: 12,
  },
  lyricLineText: {
    fontSize: 14,
    lineHeight: 20,
    marginVertical: 4,
  },
  emptyPlaceholder: {
    fontSize: 12,
    color: '#ccc',
    fontStyle: 'italic',
  },
  emptyComposition: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
  },
  segmented: {
    margin: 16,
  },
  card: {
    margin: 12,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    marginTop: 8,
  },
  settingsContent: {
    gap: 12,
  },
  settingsInput: {
    marginVertical: 4,
  },
  timeSignatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeSignatureInput: {
    flex: 1,
  },
  timeSignatureSeparator: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  settingsNote: {
    color: '#666',
    marginTop: 8,
  },
  placeholder: {
    marginTop: 8,
    color: '#666',
  },
  beatChordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  beatChordBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  beatChordText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  tooltipChordDiagram: {
    width: 50,
    height: 65,
    padding: 3,
    backgroundColor: '#fff',
    borderRadius: 0,
  },
  tooltipChordContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chordDialog: {
    maxHeight: '90%',
    minHeight: 600,
    maxWidth: 600,
    width: '90%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chordDialogContent: {
    flexDirection: 'row',
    gap: 12,
    maxHeight: 500,
    padding: 12,
  },
  leftPanel: {
    width: 200,
    display: 'flex',
    flexDirection: 'column',
  },
  rightPanel: {
    width: 260,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    width: '100%',
  },
  emptyPreviewText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  rightPanelButtons: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 8,
  },
  selectButton: {
    paddingVertical: 4,
  },
  cancelButton: {
    paddingVertical: 4,
  },
  chordSearchInput: {
    marginVertical: 0,
    marginBottom: 8,
    paddingVertical: 0,
  },
  chordListContainer: {
    marginVertical: 12,
    maxHeight: 300,
  },
  chordOption: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    margin: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 120,
  },
  chordOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginTop: 4,
  },
  chordDiagramContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginVertical: 0,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    width: '100%',
    alignItems: 'center',
  },
  chordName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  commonNotes: {
    fontSize: 10,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 14,
  },
  diagramWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fretLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
    marginRight: 8,
    width: 30,
    textAlign: 'right',
  },
  diagramContent: {
    alignItems: 'center',
  },
  indicatorsRow: {
    flexDirection: 'row',
    marginBottom: 8,
    justifyContent: 'center',
  },
  stringIndicator: {
    width: 40,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  openCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: 'transparent',
  },
  mutedXContainer: {
    width: 20,
    height: 20,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mutedXLine1: {
    position: 'absolute',
    width: 20,
    height: 2.5,
    backgroundColor: '#000',
    transform: [{ rotate: '45deg' }],
  },
  mutedXLine2: {
    position: 'absolute',
    width: 20,
    height: 2.5,
    backgroundColor: '#000',
    transform: [{ rotate: '-45deg' }],
  },
  gridContainer: {
    backgroundColor: '#fff',
    position: 'relative',
  },
  nutLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: '#000',
    zIndex: 10,
  },
  fretRow: {
    flexDirection: 'row',
    height: 50,
    position: 'relative',
  },
  fretCell: {
    width: 40,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  stringLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 2,
    backgroundColor: '#333',
    transform: [{ translateX: -1 }],
  },
  fretLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#333',
  },
  fingerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#000',
    zIndex: 5,
  },
  selectedChordDisplay: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  chordListLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  chordThumbnail: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  miniChordGrid: {
    width: 80,
    height: 80,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 4,
    justifyContent: 'center',
  },
  chordOptionSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
    borderWidth: 2,
  },
  chordDropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    maxHeight: 250,
    backgroundColor: '#fff',
    marginVertical: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  chordListbox: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    flex: 1,
    backgroundColor: '#fff',
    marginVertical: 0,
    overflow: 'hidden',
  },
  listboxItem: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  listboxItemSelected: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  listboxItemText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  listboxItemTextSelected: {
    color: '#1976d2',
    fontWeight: '700',
  },
  fingeeringNotesContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    padding: 12,
    marginTop: 0,
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
    width: '100%',
  },
  fingeeringNotesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1976d2',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fingeeringNotesText: {
    fontSize: 11,
    color: '#333',
    lineHeight: 16,
    fontStyle: 'italic',
  },
});