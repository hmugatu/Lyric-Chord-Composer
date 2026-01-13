import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Searchbar } from 'react-native-paper';

export default function LibraryScreen() {
  const [searchQuery, setSearchQuery] = React.useState('');

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search chords"
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      <ScrollView style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">Chord Library</Text>
            <Text variant="bodyMedium" style={styles.placeholder}>
              Common chords and progressions coming soon...
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">Saved Progressions</Text>
            <Text variant="bodyMedium" style={styles.placeholder}>
              Your saved chord progressions will appear here...
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">Templates</Text>
            <Text variant="bodyMedium" style={styles.placeholder}>
              Song templates coming soon...
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchbar: {
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
});
