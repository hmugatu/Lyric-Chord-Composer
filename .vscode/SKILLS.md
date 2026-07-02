# Project Skills - PowerShell Utilities

Reusable PowerShell functions and aliases for Lyric Chord Composer development.

## Available Skills

### `Kill-ExpoServer` (alias: `kill-expo`)
Kills all running Expo and Node.js processes used by the development server.

**Usage:**
```powershell
Kill-ExpoServer
# or
kill-expo
```

**Why:** Useful for resetting the dev environment. Prevents port number increments and clears lingering processes from previous dev sessions.

### `Start-WebDev` (alias: `dev-web`)
Kills existing processes and starts a fresh web development server.

**Usage:**
```powershell
Start-WebDev
# or
dev-web
```

## Setup

### Option 1: Manual Loading (Per Session)
In any terminal in the project, run:
```powershell
. .\.vscode\skills.ps1
```

### Option 2: Auto-Load on Profile (Persistent)
Add this line to your PowerShell profile (`$PROFILE`):
```powershell
. "d:\_personal\Lyric-Chord-Composer\.vscode\init-skills.ps1"
```

Then reload your profile:
```powershell
. $PROFILE
```

## Files

- **skills.ps1** - Main skills definitions and aliases
- **init-skills.ps1** - Profile initialization script
- **README.md** - This file (skills documentation)
