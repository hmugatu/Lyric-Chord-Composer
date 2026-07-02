/**
 * Print Options Dialog Component
 * Modal for selecting print options before printing/exporting PDF
 * Improved UX with clear descriptions and better visual hierarchy
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Dialog, Portal, Button, Checkbox, RadioButton, Text, Divider } from 'react-native-paper';
import { PrintOptions } from '../services/printService';

export interface PrintDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onPrint: (options: PrintOptions) => void;
}

export const PrintDialog: React.FC<PrintDialogProps> = ({
  visible,
  onDismiss,
  onPrint,
}) => {
  const [options, setOptions] = useState<PrintOptions>({
    includeChordDiagrams: true,
    includeTablature: true,
    includeNotation: true,
    pageSize: 'letter',
    orientation: 'portrait',
  });

  const handleCheckboxChange = (key: keyof PrintOptions) => {
    setOptions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const countIncluded = [
    options.includeChordDiagrams,
    options.includeTablature,
    options.includeNotation,
  ].filter(Boolean).length;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title style={styles.title}>Print Settings</Dialog.Title>
        <Dialog.Content>
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Content Options Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>📄 What to Include</Text>
              <Text style={styles.sectionDescription}>
                Select which elements to include ({countIncluded} of 3 selected)
              </Text>
              <View style={styles.optionsGroup}>
                <View style={styles.checkboxRow}>
                  <Checkbox
                    status={options.includeChordDiagrams ? 'checked' : 'unchecked'}
                    onPress={() => handleCheckboxChange('includeChordDiagrams')}
                    color="#6200ee"
                  />
                  <View style={styles.labelContainer}>
                    <Text style={styles.checkboxLabel} onPress={() => handleCheckboxChange('includeChordDiagrams')}>
                      Chord Diagrams
                    </Text>
                    <Text style={styles.checkboxHelper}>Visual chord shapes and fingerings</Text>
                  </View>
                </View>
                <View style={styles.checkboxRow}>
                  <Checkbox
                    status={options.includeTablature ? 'checked' : 'unchecked'}
                    onPress={() => handleCheckboxChange('includeTablature')}
                    color="#6200ee"
                  />
                  <View style={styles.labelContainer}>
                    <Text style={styles.checkboxLabel} onPress={() => handleCheckboxChange('includeTablature')}>
                      Tablature
                    </Text>
                    <Text style={styles.checkboxHelper}>Guitar tab notation</Text>
                  </View>
                </View>
                <View style={styles.checkboxRow}>
                  <Checkbox
                    status={options.includeNotation ? 'checked' : 'unchecked'}
                    onPress={() => handleCheckboxChange('includeNotation')}
                    color="#6200ee"
                  />
                  <View style={styles.labelContainer}>
                    <Text style={styles.checkboxLabel} onPress={() => handleCheckboxChange('includeNotation')}>
                      Staff Notation
                    </Text>
                    <Text style={styles.checkboxHelper}>Standard music notation</Text>
                  </View>
                </View>
              </View>
            </View>

            <Divider style={styles.divider} />

            {/* Page Size Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>📏 Paper Size</Text>
              <Text style={styles.sectionDescription}>Choose your paper size</Text>
              <RadioButton.Group
                onValueChange={value => setOptions(prev => ({ ...prev, pageSize: value as 'letter' | 'a4' }))}
                value={options.pageSize}
              >
                <View style={styles.radioRow}>
                  <RadioButton value="letter" color="#6200ee" />
                  <Text style={styles.radioLabel} onPress={() => setOptions(prev => ({ ...prev, pageSize: 'letter' }))}>
                    Letter (8.5" × 11") - US Standard
                  </Text>
                </View>
                <View style={styles.radioRow}>
                  <RadioButton value="a4" color="#6200ee" />
                  <Text style={styles.radioLabel} onPress={() => setOptions(prev => ({ ...prev, pageSize: 'a4' }))}>
                    A4 (210mm × 297mm) - International
                  </Text>
                </View>
              </RadioButton.Group>
            </View>

            <Divider style={styles.divider} />

            {/* Orientation Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>🔄 Orientation</Text>
              <Text style={styles.sectionDescription}>Choose page orientation</Text>
              <RadioButton.Group
                onValueChange={value => setOptions(prev => ({ ...prev, orientation: value as 'portrait' | 'landscape' }))}
                value={options.orientation}
              >
                <View style={styles.radioRow}>
                  <RadioButton value="portrait" color="#6200ee" />
                  <Text style={styles.radioLabel} onPress={() => setOptions(prev => ({ ...prev, orientation: 'portrait' }))}>
                    Portrait (Taller)
                  </Text>
                </View>
                <View style={styles.radioRow}>
                  <RadioButton value="landscape" color="#6200ee" />
                  <Text style={styles.radioLabel} onPress={() => setOptions(prev => ({ ...prev, orientation: 'landscape' }))}>
                    Landscape (Wider)
                  </Text>
                </View>
              </RadioButton.Group>
            </View>
          </ScrollView>
        </Dialog.Content>

        <Dialog.Actions style={styles.actions}>
          <Button onPress={onDismiss} style={styles.cancelButton}>
            Cancel
          </Button>
          <Button onPress={() => onPrint(options)} mode="contained" style={styles.printButton}>
            🖨️ Print
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  scrollContent: {
    maxHeight: 400,
  },
  sectionContainer: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 12,
    color: '#555',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  optionsGroup: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#6200ee',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 10,
    paddingHorizontal: 8,
  },
  labelContainer: {
    flex: 1,
    marginLeft: 8,
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  checkboxHelper: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 8,
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
    marginLeft: 12,
    flex: 1,
  },
  divider: {
    marginVertical: 14,
    backgroundColor: '#eeeeee',
  },
  actions: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 20,
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  cancelButton: {
    minWidth: 80,
  },
  printButton: {
    minWidth: 100,
  },
});
