# PRISM — Offline Facial Recognition and Liveness Detection

PRISM (Photometric & Radiometric Identity via Structural Mesh) is a fully offline facial recognition and liveness detection system built in React Native. It is designed for field personnel authentication in zero-network environments and is intended for integration into the Datalake 3.0 application.

## Overview

PRISM authenticates field personnel using on-device AI inference. No internet connection is required for recognition or liveness detection. When connectivity is restored, attendance logs are automatically synced to a remote server and purged from local storage.

## Requirements

- Node.js v18 or above
- Expo CLI
- Android device running Android 8.0 or above with minimum 3GB RAM
- EAS CLI (for building the standalone APK)
- An Expo account (free) at expo.dev

## Setup Instructions

### 1. Clone the repository

```
git clone https://github.com/MKN-Sai-Varun/PRISM.git
cd PRISM
```

### 2. Install dependencies

```
npm install
```

### 3. Start the development server

```
npx expo start --dev-client
```

Open the PRISM dev build on your Android device and scan the QR code shown in the terminal. The dev build APK must be installed first — download it from the Expo dashboard after running the development build.

### 4. Build a standalone APK

To build a fully standalone APK that requires no server:

```
eas build --platform android --profile preview
```

This produces a distributable APK that runs entirely on the device with no external dependencies.

## Project Structure

```
PRISM/
├── App.js                      Entry point and screen router
├── assets/
│   └── models/
│       ├── blaze_face_short_range.tflite   Face detection model (224 KB)
│       ├── mobilefacenet.tflite            Face embedding model (5.1 MB)
│       └── face_landmarker.task            Face mesh model (3.7 MB)
├── src/
│   ├── screens/
│   │   ├── HomeScreen.tsx      Dashboard with enroll, verify, logs, sync
│   │   ├── EnrollScreen.tsx    Face enrollment with 3-capture averaging
│   │   ├── VerifyScreen.tsx    Identity verification with liveness challenge
│   │   └── LogsScreen.tsx      Attendance log viewer with sync status
│   ├── ml/
│   │   ├── faceDetector.ts     BlazeFace TFLite wrapper
│   │   ├── faceEmbedding.ts    MobileFaceNet TFLite wrapper
│   │   ├── fusionMatcher.ts    ABM dual-channel fusion matcher
│   │   ├── livenessDetector.ts Passive and active liveness detection
│   │   ├── geometricRatios.ts  12-dimensional geometric identity vector
│   │   └── clahe.ts            CLAHE lighting normalisation
│   ├── db/
│   │   └── sqlite.ts           SQLite database (users + attendance tables)
│   ├── sync/
│   │   └── awsSync.ts          Network-aware sync and purge mechanism
│   ├── store/
│   │   └── appStore.ts         Zustand global state
│   └── utils/
│       └── colors.ts           Colour palette
```

## How to Use

### Enrolling a Person

1. Tap "Enroll New Person" on the home screen.
2. Enter the person's full name and employee ID.
3. Tap the camera button three times to capture three face samples.
4. The app detects a face in each capture, generates a 192-dimensional embedding, and stores the average of the three embeddings in the local SQLite database.

### Verifying Identity

1. Tap "Verify Identity" on the home screen.
2. The app presents a random liveness challenge (blink, smile, or turn head).
3. Complete the challenge within the 3-second countdown.
4. The app captures a photo after the challenge, checks passive and active liveness, runs face detection, generates an embedding, and matches it against all enrolled users.
5. A match above 0.75 cosine similarity is accepted as verified.
6. The attendance record is logged to SQLite.

### Syncing Logs

Sync happens automatically when the device reconnects to the internet. Manual sync is available via the "Sync Logs" button on the home screen. Only metadata is synced — no face images or raw biometric embeddings are ever transmitted.

## Dependencies

All dependencies are open-source and require no additional licences.

| Package | Purpose |
|---|---|
| react-native-fast-tflite | TFLite inference engine |
| expo-camera | Camera capture |
| expo-sqlite | Local encrypted storage |
| expo-image-manipulator | Image resizing before inference |
| jpeg-js | JPEG decoding to raw pixel arrays |
| zustand | Application state management |
| @react-native-community/netinfo | Network status detection |

## Licence

This project uses only open-source components. All third-party models (BlazeFace, MobileFaceNet) are distributed under the Apache 2.0 licence.
