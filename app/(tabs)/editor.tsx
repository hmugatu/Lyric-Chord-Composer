import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Card, SegmentedButtons } from 'react-native-paper';
import { useCompositionStore } from '../../src/store/compositionStore';

type EditorView = 'chords' | 'tabs' | 'notation' | 'lyrics';

export default function EditorScreen() {
  const [currentView, setCurrentView] = React.useState<EditorView>('chords');
  const currentComposition = useCompositionStore((state) => state.currentComposition);

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
        <Text variant="headlineSmall">{currentComposition.title}</Text>
        {currentComposition.artist && (
          <Text variant="bodyMedium">{currentComposition.artist}</Text>
        )}
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
});
