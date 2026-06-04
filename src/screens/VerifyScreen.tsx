import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors } from '../utils/colors';
import { loadFaceDetector, detectFace } from '../ml/faceDetector';
import { loadFaceEmbedding, getEmbedding } from '../ml/faceEmbedding';
import { runFusionMatch } from '../ml/fusionMatcher';
import { getAllUsers, logAttendance, initDB } from '../db/sqlite';
import { useAppStore } from '../store/appStore';
import {
  checkLiveness,
  checkActiveLiveness,
  randomChallenge,
  challengePrompt,
  LivenessChallenge,
} from '../ml/livenessDetector';

export default function VerifyScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [isModelReady, setIsModelReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'challenge' | 'scanning' | 'matched' | 'failed'>('idle');
  const [resultName, setResultName] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [challenge, setChallenge] = useState<LivenessChallenge>('blink');
  const [challengeCountdown, setChallengeCountdown] = useState(3);
  const beforePhotoUri = useRef<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const addLog = useAppStore((s) => s.addLog);

  useEffect(() => {
    initDB();
    const timeout = setTimeout(() => {
      if (!isModelReady) Alert.alert('Model Load Timeout', 'Models failed to load. Please restart the app.');
    }, 15000);
    Promise.all([loadFaceDetector(), loadFaceEmbedding()])
      .then(() => { clearTimeout(timeout); setIsModelReady(true); })
      .catch(e => { clearTimeout(timeout); Alert.alert('Model Error', e.message); });
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  // Step 1 — Start challenge: take "before" photo, show prompt, wait, take "after" photo
  const startChallenge = async () => {
    if (!isModelReady) {
      Alert.alert('Please wait', 'Models are still loading...');
      return;
    }
    if (!cameraRef.current) return;

    const newChallenge = randomChallenge();
    setChallenge(newChallenge);
    setStatus('challenge');
    setChallengeCountdown(3);

    // Wait a beat before capturing the "before" frame so the camera is ready
    await new Promise(r => setTimeout(r, 500));

    try {
      const before = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        skipProcessing: true,
      });
      beforePhotoUri.current = before?.uri ?? null;
    } catch {
      beforePhotoUri.current = null;
    }

    // Give the camera time to reset before the countdown
    await new Promise(r => setTimeout(r, 500));

    // Countdown 3 → 2 → 1 while user performs the action
    for (let i = 2; i >= 1; i--) {
      await new Promise(r => setTimeout(r, 1000));
      setChallengeCountdown(i);
    }
    await new Promise(r => setTimeout(r, 1000));

    // Camera needs a moment to be ready again before the "after" capture
    await new Promise(r => setTimeout(r, 400));

    await verifyFace();
  };

  // Step 2 — Full verify pipeline (runs after challenge countdown)
  const verifyFace = async () => {
    if (!cameraRef.current) return;

    setIsProcessing(true);
    setStatus('scanning');

    try {
      // Capture "after" photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });

      if (!photo?.uri) return;

      // ── Passive liveness (single frame texture check) ──────────────────
      const passiveLiveness = await checkLiveness(photo.uri);

      if (!passiveLiveness.isLive) {
        setStatus('failed');
        setResultName(`Spoof: ${passiveLiveness.reason}`);
        setIsProcessing(false);
        return;
      }

      // ── Active liveness (before vs after frame delta) ───────────────────
      if (beforePhotoUri.current) {
        const activeLiveness = await checkActiveLiveness(
          beforePhotoUri.current,
          photo.uri,
        );

        if (!activeLiveness.isLive) {
          setStatus('failed');
          setResultName('No motion detected — spoof suspected');
          setIsProcessing(false);
          return;
        }
      }

      // ── Face detection ──────────────────────────────────────────────────
      const box = await detectFace(photo.uri, photo.width, photo.height);
      if (!box) {
        setStatus('failed');
        setResultName('No face detected');
        setIsProcessing(false);
        return;
      }

      // ── Embedding ───────────────────────────────────────────────────────
      const embedding = await getEmbedding(photo.uri);
      if (!embedding) {
        setStatus('failed');
        setResultName('Embedding failed');
        setIsProcessing(false);
        return;
      }

      // ── Fusion match ────────────────────────────────────────────────────
      const users = await getAllUsers();
      if (users.length === 0) {
        Alert.alert('No users enrolled', 'Please enroll someone first');
        setStatus('idle');
        setIsProcessing(false);
        return;
      }

      const result = runFusionMatch(embedding, users);
      setConfidence(result.confidence);

      if (result.matched && result.userName && result.userId) {
        setStatus('matched');
        setResultName(result.userName);

        const logId = `log_${Date.now()}`;
        await logAttendance(logId, result.userId, result.userName, result.confidence, result.channel);
        addLog({
          id: logId,
          userId: result.userId,
          userName: result.userName,
          timestamp: new Date().toISOString(),
          confidence: result.confidence,
          channel: result.channel,
          synced: false,
        });
      } else {
        setStatus('failed');
        setResultName(`Unknown (${Math.round(result.confidence * 100)}%)`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setStatus('idle');
    } finally {
      setIsProcessing(false);
      beforePhotoUri.current = null;
    }
  };

  const reset = () => {
    setStatus('idle');
    setResultName('');
    setConfidence(0);
    beforePhotoUri.current = null;
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera permission required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
      />
      <View style={styles.overlay}>
          <View style={[
            styles.faceBox,
            status === 'matched'  && { borderColor: colors.success },
            status === 'failed'   && { borderColor: colors.danger },
            status === 'scanning' && { borderColor: colors.warning },
          ]} />

          <View style={styles.statusBadge}>
            {status === 'idle' && (
              <Text style={styles.statusText}>
                {isModelReady ? '👤 Position your face' : '⏳ Loading models...'}
              </Text>
            )}
            {status === 'challenge' && (
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.statusText, { color: colors.warning, fontSize: 18 }]}>
                  {challengePrompt(challenge)}
                </Text>
                <Text style={[styles.statusText, { fontSize: 32, marginTop: 8 }]}>
                  {challengeCountdown}
                </Text>
              </View>
            )}
            {status === 'scanning' && (
              <Text style={styles.statusText}>🔍 Scanning...</Text>
            )}
            {status === 'matched' && (
              <Text style={[styles.statusText, { color: colors.success }]}>
                ✅ {resultName}{'\n'}
                <Text style={styles.confidenceText}>
                  {Math.round(confidence * 100)}% confidence
                </Text>
              </Text>
            )}
            {status === 'failed' && (
              <Text style={[styles.statusText, { color: colors.danger }]}>
                ❌ {resultName}
              </Text>
            )}
          </View>
        </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.flipButton}
          onPress={() => setFacing(f => f === 'front' ? 'back' : 'front')}
        >
          <Text style={styles.buttonText}>🔄</Text>
        </TouchableOpacity>

        {status === 'idle' || status === 'scanning' || status === 'challenge' ? (
          <TouchableOpacity
            style={[styles.scanButton, (isProcessing || status === 'challenge') && { backgroundColor: colors.warning }]}
            onPress={startChallenge}
            disabled={isProcessing || status === 'challenge' || status === 'scanning'}
          >
            {isProcessing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.scanText}>🔍</Text>
            }
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.scanButton, { backgroundColor: colors.surfaceLight }]}
            onPress={reset}
          >
            <Text style={styles.scanText}>🔄</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.flipButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>← Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceBox: {
    width: 250,
    height: 300,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  statusBadge: {
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  confidenceText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.dark,
    width: '100%',
  },
  flipButton: {
    padding: 12,
    backgroundColor: colors.surfaceLight,
    borderRadius: 10,
  },
  scanButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanText: {
    fontSize: 30,
  },
  button: {
    marginTop: 20,
    padding: 14,
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  text: {
    color: colors.text,
    fontSize: 16,
  },
});