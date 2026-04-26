# Kirka Client Features

## Core Features

### Custom Script Loading
- Automatically loads external JavaScript files from a designated scripts directory
- Error handling for failed script loads

### Client Menu and Keybinds
- Configurable menu keybind with visual reminder in lobby
- Dynamic keybind reminder updates when settings change

## Lobby Enhancements

### Lobby News System
- Displays customizable news cards (general, promotional, event, alert categories)
- Includes images, badges (NEW/LIVE), and clickable links
- Fetches news data from remote repository

### Custom Discord Button
- Replaces social button with a branded Discord invite button

### Keybind Reminder
- Shows current menu keybind at bottom of lobby

## UI Customization Features

### Display Options
- Persistent crosshair: Option to keep crosshair always visible
- Permanent tablist: Always-visible scoreboard with team labels (RED/BLUE)
- Hide chat completely
- Hide kill text
- Hide entire interface

### Visual Effects
- Adjust interface opacity
- Scale interface bounds (0.8x, 0.9x, 1x)
- Skip loading screens
- Custom hitmarkers: Replace default hitmarker with custom image
- Custom kill icons: Replace kill icons with custom images
- Rave mode: Animated hue rotation effect
- Disable UI animations: Remove all transitions and animations

## Player Customization System

### Name Styling
- Gradient names with rotation angles and color stops
- Optional animated gradient effects

### Badge System
- Discord linked badge
- Booster badge
- Custom badge images (supports local file paths or URLs)

## In-Game Features

### Statistics
- Real-time kill/death ratio display

### Interface Controls
- Toggle spectate button visibility
- Apply customizations to tab and ESC menu player lists

## Profile Page Enhancements
- Displays player customizations (gradient names, badges) on profile pages
- Shows Discord linked and booster badges

## Servers Page Features

### Map Display
- Replaces server list backgrounds with custom map images
- Fetches map images from remote repository

### Navigation
- Shift-click usernames to navigate to profiles

## Friends List Features

### Management
- Search and filter friends by username or ID
- Deny all friend requests with confirmation
- Shift-click friend status to copy game link to clipboard

### Display
- Applies badge and gradient customizations to friend list

## Theme System

### Styling Options
- External CSS support: Load custom CSS from URLs
- Custom CSS editor for advanced styling
- Dynamic theme updates without page reload

## Notification System
- Custom styled notifications for client events
- IPC-based notification handling

## Settings Synchronization
- Listens for settings change events
- Real-time UI updates based on setting changes
- Persistent settings via IPC

## Element Observation
- DOM mutation monitoring utility
- Dynamic content loading detection

## Console Management
- Preserves original console methods
- Resets console on URL changes
