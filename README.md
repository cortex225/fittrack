# FitTrack 💪

Une app React Native minimaliste pour tracker tes entraînements de musculation.

## Features

- 📋 Log rapide d'exercices (séries, reps, poids)
- ✅ Marquage de séries complétées
- ⏱ Timer de repos (30s / 60s / 90s / 120s)
- 📊 Historique des workouts avec volume total
- 🌙 Dark theme moderne avec accents violets
- 💾 Stockage local (AsyncStorage, zéro backend)

## Stack

- **Expo** (React Native + TypeScript)
- **React Navigation** (Bottom Tabs + Native Stack)
- **AsyncStorage** — persistance locale
- **Expo Vector Icons** — icônes Ionicons

## Installation

```bash
git clone https://github.com/cortex225/fittrack.git
cd fittrack
npm install
npx expo start
```

Scanne le QR avec **Expo Go** sur ton téléphone.

## Screens

| Screen | Description |
|--------|-------------|
| Home | Dashboard avec stats et liste des workouts |
| Workout | Logger un entraînement en temps réel |
| History | Historique détaillé avec volume total |

## Auteur

Jean-Luc Gouaho — [jlgouaho.com](https://jlgouaho.com)
