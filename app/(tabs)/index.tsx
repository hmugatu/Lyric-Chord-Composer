import React from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Text, Card, FAB, IconButton, Snackbar, Dialog, Portal, Button, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCompositionStore } from '../../src/store/compositionStore';
import { CompositionStorageService } from '../../src/services/compositionService';
import { router } from 'expo-router';
import { Composition } from '../../src/models';

export default function HomeScreen() {
  const [snackbar, setSnackbar] = React.useState({ visible: false, message: '' });
  const [isImporting, setIsImporting] = React.useState(false);

  const compositions = useCompositionStore((state) => state.compositions);
  const createComposition = useCompositionStore((state) => state.createComposition);
  const loadComposition = useCompositionStore((state) => state.loadComposition);
  const addComposition = useCompositionStore((state) => state.addComposition);
  const setCurrentComposition = useCompositionStore((state) => state.setCurrentComposition);
  const isLoading = useCompositionStore((state) => state.isLoading);
  const initializeStore = useCompositionStore((state) => state.initializeStore);
  const storageService = new CompositionStorageService();

  // Initialize store on mount
  React.useEffect(() => {
    initializeStore();
  }, []);

  const handleCreateNew = () => {
    const title = `New Composition ${compositions.length + 1}`;
    createComposition(title);
    router.push('/editor');
  };

  const handleOpenComposition = (composition: Composition) => {
    loadComposition(composition.id);
    router.push('/editor');
  };

  const handleImportFromLocal = async () => {
    try {
      setIsImporting(true);
      await storageService.setProvider('local');
      const result = await storageService.importComposition();
      addComposition(result.composition);
      setCurrentComposition(result.composition.id);
      setSnackbar({ visible: true, message: 'Composition imported successfully!' });
    } catch (error) {
      Alert.alert('Import Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportFromGoogleDrive = async () => {
    try {
      setIsImporting(true);
      await storageService.setProvider('google-drive');
      const results = await storageService.importCompositions();
      if (results.length > 0) {
        const composition = results[0].composition;
        addComposition(composition);
        setCurrentComposition(composition.id);
        setSnackbar({ visible: true, message: 'Composition imported from Google Drive!' });
      }
    } catch (error) {
      Alert.alert('Import Failed', error instanceof Error ? error.message : 'Failed to import from Google Drive');
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportFromOneDrive = async () => {
    try {
      setIsImporting(true);
      await storageService.setProvider('onedrive');
      const results = await storageService.importCompositions();
      if (results.length > 0) {
        const composition = results[0].composition;
        addComposition(composition);
        setCurrentComposition(composition.id);
        setSnackbar({ visible: true, message: 'Composition imported from OneDrive!' });
      }
    } catch (error) {
      Alert.alert('Import Failed', error instanceof Error ? error.message : 'Failed to import from OneDrive');
    } finally {
      setIsImporting(false);
    }
  };

  const renderComposition = ({ item }: { item: Composition }) => (
    <Card
      style={styles.card}
      onPress={() => handleOpenComposition(item)}
    >
      <Card.Content>
        <Text variant="titleLarge">{item.title}</Text>
        {item.artist && <Text variant="bodyMedium">{item.artist}</Text>}
        <Text variant="bodySmall" style={styles.date}>
          Updated: {new Date(item.updatedAt).toLocaleDateString()}
        </Text>
        <View style={styles.metadata}>
          <Text variant="bodySmall">
            {item.sections.length} section{item.sections.length !== 1 ? 's' : ''}
          </Text>
          {item.difficulty && (
            <Text variant="bodySmall" style={styles.difficulty}>
              {item.difficulty}
            </Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Text variant="headlineSmall">My Compositions</Text>
          <Text variant="bodySmall" style={styles.count}>
            {compositions.length} file{compositions.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.iconButtons}>
          <IconButton
            icon="folder-open"
            size={24}
            onPress={handleImportFromLocal}
            disabled={isImporting}
            iconColor="#6200ee"
          />
          <IconButton
            icon="google-drive"
            size={24}
            onPress={handleImportFromGoogleDrive}
            disabled={isImporting}
            iconColor="#4285F4"
          />
          <IconButton
            icon="microsoft-onedrive"
            size={24}
            onPress={handleImportFromOneDrive}
            disabled={isImporting}
            iconColor="#0078D4"
          />
        </View>
      </View>

      {isLoading || isImporting ? (
        <View style={styles.loading}>
          <ActivityIndicator animating={true} size="large" />
          <Text variant="bodyMedium" style={styles.loadingText}>
            {isLoading ? 'Loading...' : 'Importing...'}
          </Text>
        </View>
      ) : compositions.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="music-note-outline" size={64} color="#ccc" />
          <Text variant="titleMedium" style={styles.emptyText}>
            No compositions yet
          </Text>
          <Text variant="bodyMedium" style={styles.emptySubtext}>
            Create your first composition or import an existing .hmlcc file
          </Text>
        </View>
      ) : (
        <FlatList
          data={compositions}
          renderItem={renderComposition}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleCreateNew}
        label="New"
      />

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: '' })}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setSnackbar({ visible: false, message: '' }),
        }}
      >
        {snackbar.message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  titleSection: {
    flex: 1,
  },
  count: {
    color: '#999',
    marginTop: 4,
  },
  iconButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
  },
  list: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    marginBottom: 12,
  },
  date: {
    marginTop: 4,
    color: '#666',
  },
  metadata: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 16,
  },
  difficulty: {
    textTransform: 'capitalize',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    color: '#666',
  },
  emptySubtext: {
    marginTop: 8,
    color: '#999',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
