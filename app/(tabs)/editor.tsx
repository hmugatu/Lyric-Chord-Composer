import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, Card, SegmentedButtons, ActivityIndicator, Dialog, Portal } from 'react-native-paper';
import { useCompositionStore } from '../../src/store/compositionStore';
import { CompositionStorageService } from '../../src/services/compositionService';
import { CompositionSyncManager } from '../../src/services/compositionSyncManager';

type EditorView = 'chords' | 'tabs' | 'notation' | 'lyrics';

export default function EditorScreen() {
  const [currentView, setCurrentView] = React.useState<EditorView>('chords');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const currentComposition = useCompositionStore((state) => state.currentComposition);
  const storageService = new CompositionStorageService();
  const syncManager = new CompositionSyncManager();

  const handleSaveToDesktop = async () => {
    if (!currentComposition) return;
    try {
      setIsSaving(true);
      await storageService.setProvider('local');
      await storageService.exportComposition(currentComposition);
      Alert.alert('Success', 'Composition saved to desktop');
      setShowSaveDialog(false);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToGoogleDrive = async () => {
    if (!currentComposition) return;
    try {
      setIsSaving(true);
      await storageService.setProvider('google-drive');
      const metadata = await syncManager.uploadCompositionToCloud(currentComposition, 'google-drive');
      if (metadata) {
        Alert.alert('Success', 'Composition saved to Google Drive');
      }
      setShowSaveDialog(false);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save to Google Drive');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToOneDrive = async () => {
    if (!currentComposition) return;
    try {
      setIsSaving(true);
      await storageService.setProvider('onedrive');
      const metadata = await syncManager.uploadCompositionToCloud(currentComposition, 'onedrive');
      if (metadata) {
        Alert.alert('Success', 'Composition saved to OneDrive');
      }
      setShowSaveDialog(false);
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
          <Button mode="contained" onPress={() => {}} style={styles.button}>
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
          <View>
            <Text variant="headlineSmall">{currentComposition.title}</Text>
            {currentComposition.artist && (
              <Text variant="bodyMedium">{currentComposition.artist}</Text>
            )}
          </View>
          <Button mode="contained" onPress={() => setShowSaveDialog(true)} disabled={isSaving}>
            Save
          </Button>
        </View>
      </View>

      <SegmentedButtons
        value={currentView}
        onValueChange={(value) => setCurrentView(value as EditorView)}
        buttons={[
          { value: 'chords', label: 'Chords' },
          { value: 'tabs', label: 'Tabs' },
          { value: 'notation', label: 'Notation' },
          { value: 'lyrics', label: 'Lyrics' },
        ]}
        style={styles.segmented}
      />

      <ScrollView style={styles.content}>
        {currentView === 'chords' && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">Chord Editor</Text>
              <Text variant="bodyMedium" style={styles.placeholder}>
                Chord diagram editor coming soon...
              </Text>
            </Card.Content>
          </Card>
        )}

        {currentView === 'tabs' && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">Tablature Editor</Text>
              <Text variant="bodyMedium" style={styles.placeholder}>
                Tablature editor coming soon...
              </Text>
            </Card.Content>
          </Card>
        )}

        {currentView === 'notation' && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">Musical Notation</Text>
              <Text variant="bodyMedium" style={styles.placeholder}>
                Staff notation editor coming soon...
              </Text>
            </Card.Content>
          </Card>
        )}

        {currentView === 'lyrics' && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">Lyrics Editor</Text>
              <Text variant="bodyMedium" style={styles.placeholder}>
                Lyrics editor coming soon...
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={showSaveDialog} onDismiss={() => setShowSaveDialog(false)}>
          <Dialog.Title>Save Composition To</Dialog.Title>
          <Dialog.Content>
            <View style={styles.saveDialogContent}>
              <Button
                mode="outlined"
                onPress={handleSaveToDesktop}
                disabled={isSaving}
              >
                Save to Desktop
              </Button>
              <Button
                mode="outlined"
                onPress={handleSaveToGoogleDrive}
                disabled={isSaving}
              >
                Save to Google Drive
              </Button>
              <Button
                mode="outlined"
                onPress={handleSaveToOneDrive}
                disabled={isSaving}
              >
                Save to OneDrive
              </Button>
            </View>
            {isSaving && (
              <View style={styles.savingContainer}>
                <ActivityIndicator animating={true} />
                <Text style={styles.savingText}>Saving...</Text>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowSaveDialog(false)} disabled={isSaving}>
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  segmented: {
    margin: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  placeholder: {
    marginTop: 8,
    color: '#666',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 8,
    marginBottom: 16,
    color: '#666',
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
  },
  saveDialogContent: {
    gap: 8,
  },
  savingContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  savingText: {
    marginTop: 8,
    color: '#666',
  },
});
