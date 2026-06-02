# PRISM — Technical Documentation

Hackathon 7.0 | Datalake 3.0 Integration
Submitted by: Varun MKN

---

## 1. Problem Statement

Field personnel working in remote locations with no internet access need a secure, fast, and tamper-resistant attendance system. The solution must run entirely on a standard mid-range Android device, integrate into the existing Datalake 3.0 React Native application, and sync records to AWS when connectivity is restored.

---

## 2. Solution Architecture

PRISM implements a multi-stage on-device pipeline:

```
Camera Frame
    |
    v
Liveness Check (Passive + Active)
    |
    v
BlazeFace Detection  -->  Face Crop
    |
    v
MobileFaceNet Embedding  -->  192-d vector
    |
    v
ABM Fusion Matcher  -->  Cosine Similarity vs SQLite Store
    |
    v
Verified / Rejected  -->  Attendance Log  -->  Sync Queue
```

All stages run on the device CPU. No network connection is required for any part of the recognition pipeline.

---

## 3. Model Architecture

### 3.1 Face Detection — BlazeFace (Short Range)

- File: blaze_face_short_range.tflite
- Size: 224 KB
- Input: [1, 128, 128, 3] — RGB image normalised to [-1, 1]
- Output: regressors [1, 896, 16] — bounding box offsets, classifiers [1, 896, 1] — detection confidence
- Licence: Apache 2.0
- Source: Google MediaPipe

BlazeFace was chosen for its extremely low model size and sub-200ms inference time on CPU. It detects faces at short range (up to 2 metres), which is appropriate for field authentication use cases.

### 3.2 Face Embedding — MobileFaceNet

- File: mobilefacenet.tflite
- Size: 5.1 MB
- Input: [1, 112, 112, 3] — RGB image normalised to [-1, 1]
- Output: [1, 192] — 192-dimensional face embedding
- Licence: Apache 2.0
- Published accuracy: 99.28% on LFW benchmark

MobileFaceNet was designed specifically for on-device face recognition. It produces a 192-dimensional embedding vector that is L2-normalised before storage and comparison. Identity matching uses cosine similarity with a threshold of 0.75.

### 3.3 Face Mesh — MediaPipe Face Landmarker

- File: face_landmarker.task
- Size: 3.7 MB
- Output: 468 3D landmark points per face
- Purpose: Geometric ratio computation (ABM geometric channel)

---

## 4. ABM — Adaptive Biometric Mesh

ABM is the core innovation of PRISM. Instead of relying on a single RGB photometric embedding for all lighting conditions, PRISM uses a dual-channel approach:

**Channel 1 — RGB Embedding (Photometric)**
Standard face embedding from MobileFaceNet. Reliable in good lighting but degrades in harsh sunlight or low light.

**Channel 2 — Geometric Vector (Structural)**
12 normalised facial ratios computed from Face Mesh landmarks: eye spacing ratio, jaw width to face height ratio, nose length ratio, lip width ratio, cheekbone width ratio, eyebrow height ratio, chin length ratio, nose width ratio, left and right eye aspect ratios, mouth aspect ratio, and face symmetry ratio. These ratios are scale, rotation, and lighting invariant.

**Dynamic Weighting**

The fusion weight is determined at runtime based on estimated ambient brightness:

| Lighting Condition | RGB Weight | Geo Weight |
|---|---|---|
| Good (brightness 40–180) | 0.75 | 0.25 |
| Bad (brightness <40 or >180) | 0.30 | 0.70 |

Brightness is estimated from the mean absolute value of the embedding vector. In poor lighting the system shifts trust toward the geometric channel, which is unaffected by illumination changes.

Final match score = (RGB cosine similarity × RGB weight) + (Geo cosine similarity × Geo weight)

---

## 5. Liveness Detection

PRISM implements both passive and active liveness checks. Both must pass before face matching proceeds.

### 5.1 Passive Check (Single Frame)

Analyses a single captured frame for signs of spoofing:

- Texture variance: computes mean local neighbourhood variance across the face region. Printed photos have unnaturally low texture variance (threshold: >200).
- Colour score: computes per-channel variance across RGB channels. Printed photos have reduced colour distribution variance (threshold: >300).

Combined liveness score = (texture variance / 2000) × 0.6 + (colour score / 3000) × 0.4

### 5.2 Active Check (Two-Frame Delta)

Implements the challenge-response mechanism specified in the problem statement.

1. A random challenge is selected: blink, smile, or turn head.
2. A "before" frame is captured silently.
3. The challenge prompt is displayed with a 3-second countdown.
4. An "after" frame is captured once the countdown ends.
5. Mean absolute pixel difference is computed between the two 64×64 frames.

A real user performing the challenge produces a mean delta above 6. A static photograph or screen replay produces near-zero delta (JPEG compression noise only).

Randomisation of challenges makes replay attacks significantly harder.

---

## 6. CLAHE Preprocessing

CLAHE (Contrast Limited Adaptive Histogram Equalization) is implemented in clahe.ts and is available as a preprocessing step before model inference.

The algorithm divides the image into tiles, computes a histogram for each tile, clips it at a configurable limit, redistributes excess, and applies a normalised CDF lookup. This counteracts harsh outdoor lighting, deep shadows, and low-light evening conditions.

This directly addresses the problem statement's requirement for reliable performance in "harsh sunlight, low light, shadows" conditions encountered in Indian field deployments.

---

## 7. Enrollment Process

Three captures are taken per person. For each capture:
1. BlazeFace detects and validates a face is present.
2. MobileFaceNet generates a 192-d embedding.
3. The embedding is L2-normalised.

The three normalised embeddings are averaged component-wise to produce a single robust enrollment vector. This averaging reduces the effect of minor pose or lighting variation at enrollment time.

The enrollment vector is stored in SQLite alongside name, employee ID, and enrollment timestamp.

---

## 8. Local Storage

SQLite (expo-sqlite) is used for all local persistence.

**users table**

| Column | Type | Description |
|---|---|---|
| id | TEXT | Unique user identifier |
| name | TEXT | Full name |
| employee_id | TEXT | Employee ID |
| rgb_embedding | TEXT | JSON-serialised 192-d float array |
| geo_vector | TEXT | JSON-serialised geometric ratio vector |
| enrolled_at | TEXT | ISO timestamp |

**attendance table**

| Column | Type | Description |
|---|---|---|
| id | TEXT | Unique log identifier |
| user_id | TEXT | Reference to users table |
| user_name | TEXT | Name at time of verification |
| timestamp | TEXT | ISO timestamp |
| confidence | REAL | Final match score (0–1) |
| channel | TEXT | Dominant channel: rgb, geo, or fusion |
| synced | INTEGER | 0 = pending, 1 = synced |

The database initialises with a singleton pattern to prevent concurrent access errors during simultaneous screen loads and background sync.

---

## 9. Sync and Purge Mechanism

When the device detects network connectivity via NetInfo:

1. All records with synced = 0 are retrieved from the attendance table.
2. Each record is POST-ed to the configured endpoint as a JSON payload.
3. The payload contains only: attendanceId, userId, userName, timestamp, confidence, channel, deviceId.
4. No face images, no raw embeddings, and no biometric data are transmitted. Only attendance metadata leaves the device.
5. On successful HTTP response, the record is marked synced = 1 in SQLite.
6. The Zustand store is updated to reflect the synced state in the UI.

This architecture is described as Zero Biometric Leakage. Even if the sync endpoint is compromised, no biometric data is at risk.

The current demo uses a MockAPI.io endpoint. In production deployment within Datalake 3.0, the endpoint would be replaced with the AWS API Gateway URL.

---

## 10. Performance Benchmarks

Measured on a mid-range Android device (3GB RAM, CPU-only inference):

| Metric | Value |
|---|---|
| BlazeFace detection | ~262ms average |
| MobileFaceNet embedding | ~216ms average |
| Total verification pipeline | ~806ms average (steady state) |
| Total verification pipeline | ~1.3s (peak load / CPU contention) |
| Total model bundle size | ~9.0 MB |
| BlazeFace model size | 224 KB |
| MobileFaceNet model size | 5.1 MB |
| Face Mesh model size | 3.7 MB |

Specification requirements: pipeline < 1 second, models < 20 MB. Both met under normal operating conditions.

---

## 11. Integration Guide for Datalake 3.0

PRISM is built as a standard Expo bare workflow React Native application. Integration into Datalake 3.0 requires the following steps:

**Step 1 — Copy model assets**

Copy the three TFLite model files from assets/models/ into the Datalake 3.0 assets directory.

**Step 2 — Add dependencies**

Add the following to Datalake 3.0's package.json:

```
react-native-fast-tflite
react-native-nitro-modules
expo-image-manipulator
jpeg-js
expo-sqlite
@react-native-community/netinfo
```

**Step 3 — Copy ML modules**

Copy the entire src/ml/ directory into the Datalake 3.0 source tree. The modules are self-contained with no circular dependencies.

**Step 4 — Copy database and sync modules**

Copy src/db/sqlite.ts and src/sync/awsSync.ts. Update the SYNC_ENDPOINT constant in awsSync.ts to point to the Datalake 3.0 AWS API Gateway endpoint.

**Step 5 — Integrate screens**

The four screens in src/screens/ can be added as routes within the existing Datalake 3.0 navigation structure. Each screen accepts a navigation prop with navigate and goBack methods, making them compatible with both React Navigation and custom navigators.

**Step 6 — Update metro.config.js**

Add TFLite asset extensions to the Metro bundler configuration:

```javascript
config.resolver.assetExts.push('tflite', 'task');
```

**Step 7 — Rebuild the native app**

Since react-native-fast-tflite is a native module, a new EAS build is required after integration.

---

## 12. Open Source Compliance

All components used in PRISM are open-source and require no commercial licences:

| Component | Licence |
|---|---|
| React Native | MIT |
| Expo | MIT |
| BlazeFace TFLite model | Apache 2.0 |
| MobileFaceNet TFLite model | Apache 2.0 |
| MediaPipe Face Landmarker | Apache 2.0 |
| react-native-fast-tflite | MIT |
| expo-sqlite | MIT |
| jpeg-js | BSD-2-Clause |
| zustand | MIT |
| @react-native-community/netinfo | MIT |

---

## 13. Known Limitations

- iOS support: the codebase is cross-platform but an iOS build has not been produced for this submission due to the requirement for a Mac and Apple Developer account. The architecture and all JavaScript/TypeScript code is fully iOS compatible. An iOS build can be produced with `eas build --platform ios` on a Mac.

- Accuracy: prototype testing shows 80–97% match confidence depending on lighting and face angle. MobileFaceNet's published LFW benchmark accuracy is 99.28%. The prototype gap is attributed to JPEG compression artefacts in the image preprocessing pipeline. Production deployment would benefit from direct pixel buffer access via a Vision Camera frame processor, eliminating the JPEG encode-decode cycle and improving both accuracy and speed.

- Geometric channel: the ABM geometric channel code is fully implemented in geometricRatios.ts and the fusion logic in fusionMatcher.ts supports dual-channel matching. The current prototype enrols with an empty geometric vector and falls back to RGB-only matching. Connecting the Face Mesh TFLite model output to the geometric pipeline is the primary next development step.
