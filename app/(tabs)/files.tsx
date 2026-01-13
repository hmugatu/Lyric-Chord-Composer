import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, FlatList } from 'react-native';
import { Text, Button, Card, ActivityIndicator, Dialog, Portal, Divider } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCompositionStore } from '../../src/store/compositionStore';
import { CompositionStorageService } from '../../src/services/compositionService';

export default function FilesScreen() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [showProviderDialog, setShowProviderDialog] = React.useState(false);
  const compositions = useCompositionStore((state) => state.compositions);
  const addComposition = useCompositionStore((state) => state.addComposition);
  const setCurrentComposition = useCompositionStore((state) => state.setCurrentComposition);
  const storageService = new CompositionStorageService();

  // Refresh compositions when tab is focused
  useFocusEffect(
    useCallback(() => {
      // Update if needed when returning to this tab
    }, [])
  );

  const handleOpenFromDesktop = async () => {
    try {
      setIsLoading(true);
      await storageService.setProvider('local');
      const result = await storageService.importComposition();
      addComposition(result.composition);
      setCurrentComposition(result.composition.id);
      Alert.alert('Success', 'Composition loaded');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenFromGoogleDrive = async () => {
    try {
      setIsLoading(true);
      await storageService.setProvider('google-drive');
      const results = await storageService.importCompositions();
      if (results.length > 0) {
        const composition = results[0].composition;
        addComposition(composition);
        setCurrentComposition(composition.id);
        Alert.alert('Success', 'Composition loaded from Google Drive');
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load from Google Drive');
    } finally {
      setIsLoading(false);
      setShowProviderDialog(false);
    }
  };

  const handleOpenFromOneDrive = async () => {
    try {
      setIsLoading(true);
      await storageService.setProvider('onedrive');
      const results = await storageService.importCompositions();
      if (results.length > 0) {
        const composition = results[0].composition;
        addComposition(composition);
        setCurrentComposition(composition.id);
        Alert.alert('Success', 'Composition loaded from OneDrive');
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load from OneDrive');
    } finally {
      setIsLoading(false);
      setShowProviderDialog(false);
    }
  };

  const handleSelectComposition = (id: string) => {
    setCurrentComposition(id);
  };

  const isEmpty = compositions.length === 0;

  return (
    <View style={styles.container}>
      {isEmpty ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="file-music" size={64} color="#ccc" />
          <Text variant="headlineSmall" style={styles.emptyTitle}>
            No Files
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Create a new composition in the Editor tab or open a file below
          </Text>

          <View style={styles.buttonGroup}>
            <Button mode="contained" onPress={() => handleOpenFromDesktop()} style={styles.button}>
              Open from Desktop
            </Button>
            <Button mode="outlined" onPress={() => setShowProviderDialog(true)} style={styles.button}>
              Open from Cloud
            </Button>
          </View>

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator animating={true} />
            </View>
          )}
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.header}>
            <Text variant="titleMedium">Compositions</Text>
            <Text variant="bodySmall" style={styles.count}>
              {compositions.length} file{compositions.length !== 1 ? 's' : ''}
            </Text>
          </View>

          <FlatList
            data={compositions}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Card style={styles.fileCard} onPress={() => handleSelectComposition(item.id)}>
                <Card.Content>
                  <View style={styles.fileHeader}>
                    <View style={styles.fileInfo}>
                      <Text variant="titleSmall" numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.artist && (
                        <Text variant="bodySmall" style={styles.artist} numberOfLines={1}>
                          {item.artist}
                        </Text>
                      )}
                      <Text variant="bodySmall" style={styles.meta}>
                        {item.sections.length} section{item.sections.length !== 1 ? 's' : ''} • {item.globalSettings.tempo} BPM
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
                  </View>
                </Card.Content>
              </Card>
            )}
            ItemSeparatorComponent={() => <Divider style={styles.divider} />}
          />

          <View style={styles.footer}>
            <Button 
              mode="outlined" 
              onPress={() => setShowProviderDialog(true)}
              style={styles.addButton}
            >
              Add from Cloud
            </Button>
          </View>
        </ScrollView>
      )}

      <Portal>
        <Dialog visible={showProviderDialog} onDismiss={() => setShowProviderDialog(false)}>
          <Dialog.Title>Open File From</Dialog.Title>
          <Dialog.Content>
            <View style={styles.dialogContent}>
              <Button mode="outlined" onPress={handleOpenFromDesktop} disabled={isLoading}>
                Desktop
              </Button>
              <Button mode="outlined" onPress={handleOpenFromGoogleDrive} disabled={isLoading}>
                Google Drive
              </Button>
              <Button mode="outlined" onPress={handleOpenFromOneDrive} disabled={isLoading}>
                OneDrive
              </Button>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowProviderDialog(false)}>Cancel</Button>
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
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  count: {
    color: '#999',
    marginTop: 4,
  },
  fileCard: {
    marginVertical: 8,
  },
  fileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
    marginRight: 12,
  },
  artist: {
    color: '#999',
    marginTop: 4,
  },
  meta: {
    color: '#bbb',
    marginTop: 4,
  },
  divider: {
    marginVertical: 0,
  },
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  addButton: {
    minWidth: 200,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    marginTop: 16,
    color: '#333',
  },
  emptyText: {
    marginTop: 8,
    marginBottom: 24,
    color: '#999',
    textAlign: 'center',
  },
  buttonGroup: {
    gap: 12,
    width: '100%',
    maxWidth: 300,
  },
  button: {
    width: '100%',
  },
  loadingContainer: {
    marginTop: 24,
  },
  dialogContent: {
    gap: 8,
  },
});
