import React from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Text, Button, Card, FAB, Searchbar, Menu, IconButton, Snackbar } from 'react-native-paper';
import { useCompositionStore } from '../../src/store/compositionStore';
import { router } from 'expo-router';
import { Composition } from '../../src/models';

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState({ visible: false, message: '' });

  const compositions = useCompositionStore((state) => state.compositions);
  const createComposition = useCompositionStore((state) => state.createComposition);
  const loadComposition = useCompositionStore((state) => state.loadComposition);
  const importComposition = useCompositionStore((state) => state.importComposition);
  const importCompositions = useCompositionStore((state) => state.importCompositions);
  const exportComposition = useCompositionStore((state) => state.exportComposition);
  const exportAllCompositions = useCompositionStore((state) => state.exportAllCompositions);
  const isLoading = useCompositionStore((state) => state.isLoading);
  const isSaving = useCompositionStore((state) => state.isSaving);
  const initializeStore = useCompositionStore((state) => state.initializeStore);

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
    router.push(`/composition/${composition.id}`);
  };

  const handleImportOne = async () => {
    setMenuVisible(false);
    try {
      await importComposition();
      setSnackbar({ visible: true, message: 'Composition imported successfully!' });
    } catch (error) {
      Alert.alert('Import Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleImportMultiple = async () => {
    setMenuVisible(false);
    try {
      await importCompositions();
      setSnackbar({ visible: true, message: 'Compositions imported successfully!' });
    } catch (error) {
      Alert.alert('Import Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleExportAll = async () => {
    setMenuVisible(false);
    if (compositions.length === 0) {
      Alert.alert('No Compositions', 'There are no compositions to export.');
      return;
    }

    try {
      await exportAllCompositions();
      setSnackbar({ visible: true, message: `Exported ${compositions.length} composition(s)` });
    } catch (error) {
      Alert.alert('Export Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const filteredCompositions = compositions.filter((comp) =>
    comp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comp.artist?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderComposition = ({ item }: { item: Composition }) => (
    <Card style={styles.card} onPress={() => handleOpenComposition(item)}>
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
        <Searchbar
          placeholder="Search compositions"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="dots-vertical"
              size={24}
              onPress={() => setMenuVisible(true)}
              style={styles.menuButton}
            />
          }
        >
          <Menu.Item
            onPress={handleImportOne}
            title="Import .hmlcc file"
            leadingIcon="file-import"
          />
          <Menu.Item
            onPress={handleImportMultiple}
            title="Import multiple files"
            leadingIcon="file-import"
          />
          <Menu.Item
            onPress={handleExportAll}
            title="Export all compositions"
            leadingIcon="file-export"
            disabled={compositions.length === 0}
          />
        </Menu>
      </View>

      {isLoading || isSaving ? (
        <View style={styles.loading}>
          <Text variant="bodyMedium">
            {isLoading ? 'Loading...' : 'Exporting...'}
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
          data={filteredCompositions}
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

// Import icon for empty state
import { MaterialCommunityIcons } from '@expo/vector-icons';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  searchbar: {
    flex: 1,
    margin: 16,
    marginRight: 0,
  },
  menuButton: {
    margin: 0,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
