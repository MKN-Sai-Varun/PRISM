# PRISM
### Adaptive Biometric Mesh — Offline-First Facial Recognition for Field Personnel

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android%208.0%2B-brightgreen?style=flat-square" />
  <img src="https://img.shields.io/badge/Framework-React%20Native%20%2F%20Expo%20SDK%2054-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/Models-TFLite%20%E2%80%94%209%20MB%20total-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/Network-100%25%20Offline-red?style=flat-square" />
  <img src="https://img.shields.io/badge/Licence-Apache%202.0%20%2F%20MIT-lightgrey?style=flat-square" />
</p>

---

## Overview

PRISM (Privacy-first Recognition and Intelligent Sync Mesh) is a fully offline biometric attendance system built for field personnel operating in remote locations — NHAI infrastructure sites, construction zones, and areas without reliable connectivity.

The core technical contribution is the **Adaptive Biometric Mesh (ABM)**: a dual-channel fusion pipeline that dynamically blends photometric face embeddings with lighting-invariant geometric facial ratios. Under harsh outdoor conditions (direct sunlight, deep shadows, abrupt exposure transitions), the ABM shifts trust toward the geometric channel to maintain accuracy where single-channel systems fail.

Everything runs on-device. No internet connection is required for enrollment, verification, or logging. When connectivity is restored, attendance metadata is automatically synced to AWS — and no biometric data is ever transmitted.

---

## Download

> **APK is not hosted in this repository** (170 MB exceeds GitHub's file size limit).

**[⬇ Download APK from Expo EAS](https://expo.dev/artifacts/eas/gZL9ZEHKTMuH2rQo1bgXyA.apk)**

Minimum requirements: Android 8.0 (API 26) or above, 3 GB RAM.

---

## How It Works

### Enrollment

1. Enter the person's full name and employee ID.
2. Capture three face samples using the front camera.
3. Each capture runs through BlazeFace (detection) → MobileFaceNet (192-d embedding) → L2 normalisation.
4. The three unit vectors are averaged into a single robust enrollment vector and stored in the local SQLite database alongside the geometric ratio vector from the Face Landmarker model.

### Verification

1. A random liveness challenge is presented: **blink**, **smile**, or **turn head**.
2. Passive liveness checks texture variance (threshold > 200) and colour distribution (threshold > 300) on a baseline frame.
3. Active liveness measures mean pixel delta between the baseline and post-challenge frames (real users exceed a delta of 6.0; static photos approach zero).
4. Both checks must pass before matching proceeds.
5. The captured face is embedded and matched against all enrolled users using the ABM fusion score. A score ≥ 0.75 is accepted as verified.
6. The attendance record is written to SQLite.

### Adaptive Biometric Mesh (ABM)

| Lighting Condition | Brightness Estimate | RGB Weight | Geometric Weight |
|---|---|---|---|
| Good (moderate) | 40 – 180 | 0.75 | 0.25 |
| Poor (over/underexposed) | < 40 or > 180 | 0.30 | 0.70 |

```
score = (cosine_rgb × w_rgb) + (cosine_geo × w_geo)
```

The geometric channel encodes 12 normalised facial ratios from 468 landmark points — inter-ocular distance, jaw width, nose dimensions, lip width, cheekbone width, eye aspect ratios, symmetry, and more. These are invariant to scale, rotation, and illumination.

### Sync

Only attendance metadata is ever transmitted:

```json
{
  "attendanceId": "...",
  "userId": "...",
  "userName": "...",
  "timestamp": "2026-01-01T09:00:00Z",
  "confidence": 0.89,
  "channel": "fusion",
  "deviceId": "..."
}
```

No face images, pixel buffers, embeddings, or biometric measurements leave the device.

---

## Performance

All measurements on a mid-range Android device (3 GB RAM, CPU-only inference):

| Metric | Value | Requirement |
|---|---|---|
| Total verification latency (steady state) | ~806 ms | < 1,000 ms ✓ |
| Total verification latency (peak / CPU contention) | ~1,300 ms | marginal |
| BlazeFace detection | ~262 ms | — |
| MobileFaceNet embedding | ~216 ms | — |
| Liveness check | ~85 ms | — |
| Total model bundle size | 9.0 MB | < 20 MB ✓ |
| Prototype match confidence (enrolled) | 85 – 95% | — |
| APK size | 170 MB | — |

> Prototype match confidence is below the MobileFaceNet LFW benchmark of 99.28% due to JPEG encode-decode artefacts in the current preprocessing pipeline. Production deployment with a Vision Camera native frame processor would eliminate this cycle and recover approximately 3–5 percentage points.

---

## Models

| Model | File | Size | Purpose | Licence |
|---|---|---|---|---|
| BlazeFace (short range) | `blaze_face_short_range.tflite` | 224 KB | Face detection, bounding box | Apache 2.0 |
| MobileFaceNet | `mobilefacenet.tflite` | 5.1 MB | 192-d face embedding | Apache 2.0 |
| MediaPipe Face Landmarker | `face_landmarker.task` | 3.7 MB | 468 3D landmarks → 12-d geometric vector | Apache 2.0 |

---

## Project Structure

```
PRISM/
├── App.js                          Entry point and screen router
├── assets/
│   └── models/
│       ├── blaze_face_short_range.tflite
│       ├── mobilefacenet.tflite
│       └── face_landmarker.task
└── src/
    ├── screens/
    │   ├── HomeScreen.tsx           Dashboard — enroll, verify, logs, sync
    │   ├── EnrollScreen.tsx         3-capture face enrollment with averaging
    │   ├── VerifyScreen.tsx         Identity verification with liveness challenge
    │   └── LogsScreen.tsx           Attendance log viewer with sync status
    ├── ml/
    │   ├── faceDetector.ts          BlazeFace TFLite wrapper
    │   ├── faceEmbedding.ts         MobileFaceNet TFLite wrapper
    │   ├── fusionMatcher.ts         ABM dual-channel fusion matcher
    │   ├── livenessDetector.ts      Passive and active liveness detection
    │   ├── geometricRatios.ts       12-dimensional geometric identity vector
    │   └── clahe.ts                 CLAHE lighting normalisation
    ├── db/
    │   └── sqlite.ts                SQLite (users + attendance tables)
    ├── sync/
    │   └── awsSync.ts               Network-aware sync and purge mechanism
    ├── store/
    │   └── appStore.ts              Zustand global state
    └── utils/
        └── colors.ts                Colour palette
```

---

## Setup

### Requirements

- Node.js v18 or above
- Expo CLI
- Android device with Android 8.0+, minimum 3 GB RAM
- EAS CLI (`npm install -g eas-cli`)
- A free [Expo account](https://expo.dev)

### Local Development

```bash
git clone https://github.com/MKN-Sai-Varun/PRISM.git
cd PRISM
npm install
npx expo start --dev-client
```

Open the Expo Go dev build on your Android device and scan the QR code shown in the terminal. The dev build APK must be installed first — download it from the Expo dashboard after running the initial development build.

### Build a Standalone APK

```bash
eas build --platform android --profile preview
```

This produces a self-contained APK with no external server dependency.

---

## Dependencies

| Package | Purpose |
|---|---|
| `react-native-fast-tflite` | TFLite inference engine |
| `expo-camera` | Camera capture |
| `expo-sqlite` | Local encrypted storage |
| `expo-image-manipulator` | Image resizing before inference |
| `jpeg-js` | JPEG decoding to raw pixel arrays |
| `zustand` | Application state management |
| `@react-native-community/netinfo` | Network status detection |

All dependencies are open-source and require no commercial licences.

---

## Integrating into Datalake 3.0

| Step | Action |
|---|---|
| 1 | Copy `assets/models/` TFLite files into the Datalake 3.0 assets directory |
| 2 | Add packages: `react-native-fast-tflite`, `react-native-nitro-modules`, `expo-image-manipulator`, `jpeg-js`, `expo-sqlite`, `expo-asset`, `expo-file-system`, `@react-native-community/netinfo` |
| 3 | Copy `src/ml/` — self-contained, no circular dependencies, no external state |
| 4 | Copy `src/db/sqlite.ts` and `src/sync/awsSync.ts`; update `SYNC_ENDPOINT` in `awsSync.ts` |
| 5 | Copy `src/screens/` — screens accept a `navigation` prop with `navigate()` and `goBack()`, compatible with React Navigation and custom navigators |
| 6 | Add `'tflite'` and `'task'` to `assetExts` in `metro.config.js` |
| 7 | Run `eas build --platform android --profile preview` — required because `react-native-fast-tflite` is a native module |

---

## Known Limitations

**iOS not built.** All JavaScript and TypeScript code is cross-platform compatible. An iOS build can be produced with `eas build --platform ios` given a macOS host and Apple Developer account.

**JPEG preprocessing artefacts.** The current pipeline encodes captured frames to JPEG for resizing, then decodes them for inference. This lossy cycle reduces embedding quality. The recommended fix is a Vision Camera native frame processor for direct pixel buffer access — expected to recover ~3–5 percentage points of match accuracy.

**Geometric channel not yet connected end-to-end.** The ABM geometric channel implementation in `geometricRatios.ts` and `fusionMatcher.ts` is complete, but the prototype enrolls with an empty geometric vector and falls back to RGB-only matching. Connecting the Face Landmarker output to the full fusion pipeline is the primary next development step.

**Liveness thresholds not field-calibrated.** Passive liveness thresholds were derived from prototype testing. Production deployment should calibrate against a representative dataset from the specific device models and outdoor conditions of the target sites.

---

## Licence

All components are open-source.

| Component | Licence |
|---|---|
| React Native | MIT |
| Expo SDK 54 | MIT |
| BlazeFace, MobileFaceNet, MediaPipe Face Landmarker | Apache 2.0 |
| react-native-fast-tflite | MIT |
| expo-sqlite, expo-image-manipulator, expo-asset, expo-file-system | MIT |
| jpeg-js | BSD-2-Clause |
| zustand | MIT |
| @react-native-community/netinfo | MIT |

---

## References

- Bazarevsky et al. (2019). *BlazeFace: Sub-millisecond Neural Face Detection on Mobile GPUs.* Google Research.
- Chen et al. (2018). *MobileFaceNets: Efficient CNNs for Accurate Real-Time Face Verification on Mobile Devices.* arXiv:1804.07573.
- Lugaresi et al. (2019). *MediaPipe: A Framework for Building Perception Pipelines.* Google Research.
- Pizer et al. (1987). *Adaptive Histogram Equalization and Its Variations.* CVGIP, 39(3), 355–368.

---

*PRISM — NHAI Hackathon 7.0 — MKN Sai Varun, KMIT Hyderabad*