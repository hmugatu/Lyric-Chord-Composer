/**
 * Print Options Dialog Component
 * Modal for selecting print options before printing/exporting PDF
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Dialog, Portal, Button, Checkbox, RadioButton, Text, Divider } from 'react-native-paper';
import { PrintOptions } from '../services/printService';

export interface PrintDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onPrint: (options: PrintOptions) => void;
  onExportPdf: (options: PrintOptions) => void;
}

export const PrintDialog: React.FC<PrintDialogProps> = ({
  visible,
  onDismiss,
  onPrint,
  onExportPdf,
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

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title style={styles.title}>Print Options</Dialog.Title>
        <Dialog.Content>
          {/* Content Options */}
          <Text style={styles.sectionTitle}>Include in Print</Text>
          <View style={styles.checkboxRow}>
            <Checkbox
              status={options.includeChordDiagrams ? 'checked' : 'unchecked'}
              onPress={() => handleCheckboxChange('includeChordDiagrams')}
            />
            <Text style={styles.checkboxLabel} onPress={() => handleCheckboxChange('includeChordDiagrams')}>
              Chord Diagrams
            </Text>
          </View>
          <View style={styles.checkboxRow}>
            <Checkbox
              status={options.includeTablature ? 'checked' : 'unchecked'}
              onPress={() => handleCheckboxChange('includeTablature')}
            />
            <Text style={styles.checkboxLabel} onPress={() => handleCheckboxChange('includeTablature')}>
              Tablature
            </Text>
          </View>
          <View style={styles.checkboxRow}>
            <Checkbox
              status={options.includeNotation ? 'checked' : 'unchecked'}
              onPress={() => handleCheckboxChange('includeNotation')}
            />
            <Text style={styles.checkboxLabel} onPress={() => handleCheckboxChange('includeNotation')}>
              Staff Notation
            </Text>
          </View>

          <Divider style={styles.divider} />

          {/* Page Size */}
          <Text style={styles.sectionTitle}>Page Size</Text>
          <RadioButton.Group
            onValueChange={value => setOptions(prev => ({ ...prev, pageSize: value as 'letter' | 'a4' }))}
            value={options.pageSize}
          >
            <View style={styles.radioRow}>
              <RadioButton value="letter" />
              <Text style={styles.radioLabel} onPress={() => setOptions(prev => ({ ...prev, pageSize: 'letter' }))}>
                Letter (8.5" x 11")
              </Text>
            </View>
            <View style={styles.radioRow}>
              <RadioButton value="a4" />
              <Text style={styles.radioLabel} onPress={() => setOptions(prev => ({ ...prev, pageSize: 'a4' }))}>
                A4 (210mm x 297mm)
              </Text>
            </View>
          </RadioButton.Group>

          <Divider style={styles.divider} />

          {/* Orientation */}
          <Text style={styles.sectionTitle}>Orientation</Text>
          <RadioButton.Group
            onValueChange={value => setOptions(prev => ({ ...prev, orientation: value as 'portrait' | 'landscape' }))}
            value={options.orientation}
          >
            <View style={styles.radioRow}>
              <RadioButton value="portrait" />
              <Text style={styles.radioLabel} onPress={() => setOptions(prev => ({ ...prev, orientation: 'portrait' }))}>
                Portrait
              </Text>
            </View>
            <View style={styles.radioRow}>
              <RadioButton value="landscape" />
              <Text style={styles.radioLabel} onPress={() => setOptions(prev => ({ ...prev, orientation: 'landscape' }))}>
                Landscape
              </Text>
            </View>
          </RadioButton.Group>
        </Dialog.Content>

        <Dialog.Actions style={styles.actions}>
          <Button onPress={onDismiss} textColor="#666">
            Cancel
          </Button>
          <Button onPress={() => onExportPdf(options)} mode="outlined" style={styles.exportButton}>
            Export PDF
          </Button>
          <Button onPress={() => onPrint(options)} mode="contained">
            Print
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  disabledText: {
    color: '#999',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  radioLabel: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  divider: {
    marginVertical: 12,
  },
  actions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  exportButton: {
    marginRight: 8,
  },
});
