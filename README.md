# Lyric-Chord Composer

A cross-platform guitar music composition application for Android, iOS, and Web. Create, edit, and manage guitar compositions with chord diagrams, tablature, musical notation, and lyrics.

## Features

- Guitar chord diagrams with custom chord builder
- Interactive tablature editor
- Standard musical notation display
- Lyrics with chord positioning
- Chord progression editor
- Cross-platform support (iOS, Android, Web)

## Technology Stack

- **React Native** with **Expo** - Cross-platform mobile & web framework
- **Expo Router** - File-based navigation
- **TypeScript** - Type-safe development
- **VexFlow** - Music notation and tablature rendering
- **Tonal.js** - Music theory operations
- **Zustand** - State management
- **React Native Paper** - UI components

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- For iOS: macOS with Xcode
- For Android: Android Studio with Android SDK

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on specific platforms
npm run web       # Web browser
npm run ios       # iOS simulator (macOS only)
npm run android   # Android emulator
```

### Development

The app will automatically reload when you make changes to the code.

- Press `w` to open in web browser
- Press `i` to open in iOS simulator
- Press `a` to open in Android emulator

## Project Structure

```
Lyric-Chord-Composer/
├── app/                          # Expo Router screens
│   ├── (tabs)/                   # Tab navigation
│   │   ├── index.tsx            # Home/composition list
│   │   ├── editor.tsx           # Main editor
│   │   └── library.tsx          # Chord library
│   └── composition/[id].tsx     # Composition detail
├── src/
│   ├── components/               # React components
│   │   ├── chords/              # Chord diagram components
│   │   ├── tablature/           # Tab editor components
│   │   ├── notation/            # Staff notation components
│   │   └── lyrics/              # Lyrics editor
│   ├── models/                  # TypeScript data models
│   │   ├── Chord.ts
│   │   ├── Tablature.ts
│   │   ├── Notation.ts
│   │   ├── Lyrics.ts
│   │   └── Composition.ts
│   ├── store/                   # Zustand state management
│   │   └── compositionStore.ts
│   ├── services/                # Business logic
│   ├── utils/                   # Helper functions
│   └── constants/               # App constants
└── assets/                      # Images, fonts, etc.
```

## Build & Deploy

### Quick Deploy Commands

```bash
# Login to Expo (run this first)
npx eas-cli login

# Initialize EAS project
npx eas-cli init --id a32a8c02-5697-453d-8c32-22b8106bbcd1

# Build for Android (recommended to start)
npx eas-cli build --platform android

# Build for Android and submit to Google Play Store
npx eas-cli build --platform android --auto-submit
```

For detailed deployment instructions, iOS builds, troubleshooting, and app store requirements, see [BUILD_DEPLOY.md](BUILD_DEPLOY.md).

## Current Status

**Phase 1: Foundation - COMPLETED**
- ✅ Project initialized with Expo and TypeScript
- ✅ Core data models created
- ✅ Zustand store set up
- ✅ Basic navigation configured
- ✅ Initial UI screens created
- ✅ Composition export/import with .hmlcc file format
- ✅ Local caching with AsyncStorage
- ✅ Cross-platform file handling

**Next Steps (Phase 2): Chord System**
- Implement chord diagram display with SVG
- Create custom chord builder
- Build chord library with common chords
- Add chord progression editor

## Contributing

This project is under active development. Contributions are welcome!

## License

MIT License

## Repository

https://github.com/hmugatu/Lyric-Chord-Composer
