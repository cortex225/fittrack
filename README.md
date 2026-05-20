# JL Fit 💪

App mobile fitness & nutrition tout-en-un (Expo 54 + React Native + TypeScript).

## Features

- **Coach Dashboard** : objectif (sèche / maintien / masse), suivi calories + macros + eau, sélecteur de date, conseil IA quotidien.
- **Programme hebdomadaire** : split push / pull / legs / full body avec base d'exercices et tutos.
- **Live Workout** : timer global, séries pesées, rest timer auto, suivi XP.
- **Nutrition** :
  - Scan IA d'un repas via photo (caméra ou galerie) avec analyse macros automatique.
  - Chef IA — génère 3 recettes adaptées au goal, ingrédients disponibles et difficulté.
  - Saisie manuelle, favoris, historique par catégorie.
- **Coach Chat IA** : conversation avec Coach JL-AI (Gemini), contextualisé par profil + objectif.
- **Stats** : pesée + courbe d'évolution 10 dernières mesures, total séances / séries / volume, historique workouts.
- **Gamification** : XP (+25 repas, +50 pesée, +250 séance, +5 verre d'eau), 7 niveaux (Novice → Légende), pop-up de level up.
- **Retour haptique** sur toutes les actions clés.
- **Réglages** : clé API Gemini stockée chiffrée (SecureStore), profil édition complète, reset total.

## Setup

```bash
npm install --legacy-peer-deps
npm start
```

L'app fonctionne **hors-ligne** : toutes les features qui ne sont pas IA marchent sans clé. Pour activer Coach IA / Scan photo / Chef IA, va dans **Réglages → Clé API Gemini** et colle une clé obtenue sur [Google AI Studio](https://aistudio.google.com/app/apikey).

## Stack

| Layer | Tech |
|-------|------|
| Framework | Expo SDK 54 (new arch) |
| Nav | React Navigation 7 (tabs + native stack) |
| Storage | AsyncStorage + SecureStore (clé API) |
| Caméra | expo-camera + expo-image-picker |
| Feedback | expo-haptics |
| IA | @google/genai (Gemini 2.0 Flash) |

## Identité store

- iOS bundle : `com.jlgouaho.jlfit`
- Android package : `com.jlgouaho.jlfit`
- Permissions : caméra, galerie photos.

## Build production

```bash
# iOS
npx eas build --platform ios

# Android
npx eas build --platform android
```

## Auteur

Jean-Luc Gouaho — [jlgouaho.com](https://jlgouaho.com)
