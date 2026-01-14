import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6200ee',
        headerStyle: {
          backgroundColor: '#6200ee',
        },
        headerTintColor: '#fff',
        headerShown: true,
      }}
      sceneContainerStyle={{
        backgroundColor: '#fff',
      }}
      initialRouteName="index"
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Compositions',
          tabBarLabel: 'Compositions',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="music-note-plus" size={size} color={color} />
          ),
          headerTitle: 'My Compositions',
        }}
      />
      <Tabs.Screen
        name="editor"
        options={{
          title: 'Editor',
          tabBarLabel: 'Editor',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="pencil-ruler" size={size} color={color} />
          ),
          headerTitle: 'Composition Editor',
        }}
      />
    </Tabs>
  );
}
