import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { useCompositionStore } from '../../src/store/compositionStore';

export default function CompositionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentComposition = useCompositionStore((state) => state.currentComposition);
  const loadComposition = useCompositionStore((state) => state.loadComposition);

  React.useEffect(() => {
    if (id) {
      loadComposition(id);
    }
  }, [id]);

  if (!currentComposition) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const handleEdit = () => {
    router.push('/editor');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium">{currentComposition.title}</Text>
        {currentComposition.artist && (
          <Text variant="titleMedium">{currentComposition.artist}</Text>
        )}
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Details</Text>
          <View style={styles.detail}>
            <Text variant="bodyMedium">Key: {currentComposition.globalSettings.key}</Text>
          </View>
          <View style={styles.detail}>
            <Text variant="bodyMedium">Tempo: {currentComposition.globalSettings.tempo} BPM</Text>
          </View>
          <View style={styles.detail}>
            <Text variant="bodyMedium">
              Time Signature: {currentComposition.globalSettings.timeSignature.beats}/
              {currentComposition.globalSettings.timeSignature.beatValue}
            </Text>
          </View>
          <View style={styles.detail}>
            <Text variant="bodyMedium">
              Tuning: {currentComposition.globalSettings.tuning.name}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Sections</Text>
          {currentComposition.sections.length === 0 ? (
            <Text variant="bodyMedium" style={styles.placeholder}>
              No sections yet
            </Text>
          ) : (
            currentComposition.sections.map((section) => (
              <View key={section.id} style={styles.section}>
                <Text variant="bodyLarge">
                  {section.label || section.type}
                </Text>
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      <Button mode="contained" onPress={handleEdit} style={styles.editButton}>
        Edit Composition
      </Button>
    </ScrollView>
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
  card: {
    margin: 16,
  },
  detail: {
    marginTop: 8,
  },
  section: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  placeholder: {
    marginTop: 8,
    color: '#666',
  },
  editButton: {
    margin: 16,
  },
});
