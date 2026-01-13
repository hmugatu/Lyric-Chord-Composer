import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Button, Card, FAB, Searchbar } from 'react-native-paper';
import { useCompositionStore } from '../../src/store/compositionStore';
import { router } from 'expo-router';
import { Composition } from '../../src/models';

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const compositions = useCompositionStore((state) => state.compositions);
  const createComposition = useCompositionStore((state) => state.createComposition);
  const loadComposition = useCompositionStore((state) => state.loadComposition);

  const handleCreateNew = () => {
    const title = `New Composition ${compositions.length + 1}`;
    createComposition(title);
    router.push('/editor');
  };

  const handleOpenComposition = (composition: Composition) => {
    loadComposition(composition.id);
    router.push(`/composition/${composition.id}`);
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
      <Searchbar
        placeholder="Search compositions"
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      {compositions.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="music-note-outline" size={64} color="#ccc" />
          <Text variant="titleMedium" style={styles.emptyText}>
            No compositions yet
          </Text>
          <Text variant="bodyMedium" style={styles.emptySubtext}>
            Create your first composition to get started
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
  searchbar: {
    margin: 16,
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
