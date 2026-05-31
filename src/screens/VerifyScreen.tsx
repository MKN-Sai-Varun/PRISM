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
import { checkLiveness } from '../ml/livenessDetector';

export default function VerifyScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [isModelReady, setIsModelReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'matched' | 'failed'>('idle');
  const [resultName, setResultName] = useState('');
  const [confidence, setConfidence] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  const addLog = useAppStore((s) => s.addLog);

  useEffect(() => {
    initDB();
    Promise.all([loadFaceDetector(), loadFaceEmbedding()]).then(() => {
      setIsModelReady(true);
    });
  }, []);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  const verifyFace = async () => {
    if (!isModelReady) {
      Alert.alert('Please wait', 'Models are still loading...');
      return;
    }
    if (!cameraRef.current) return;

    setIsProcessing(true);
    setStatus('scanning');

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (!photo?.uri) return;

      // Detect face
      const box = await detectFace(photo.uri, photo.width, photo.height);
      if (!box) {
        setStatus('failed');
        setResultName('No face detected');
        setIsProcessing(false);
        return;
      }
      // Check liveness first
      const { checkLiveness } = await import('../ml/livenessDetector');
      const liveness = await checkLiveness(photo.uri);
      console.log('Liveness result:', liveness);

      if (!liveness.isLive) {
        setStatus('failed');
        setResultName(`Spoof detected: ${liveness.reason}`);
        setIsProcessing(false);
        return;
      }
      // Get embedding
      const embedding = await getEmbedding(photo.uri);
      if (!embedding) {
        setStatus('failed');
        setResultName('Embedding failed');
        setIsProcessing(false);
        return;
      }

      // Load all enrolled users
      const users = await getAllUsers();
      if (users.length === 0) {
        Alert.alert('No users enrolled', 'Please enroll someone first');
        setStatus('idle');
        setIsProcessing(false);
        return;
      }

      // Run fusion match
      const result = runFusionMatch(embedding, users);

      setConfidence(result.confidence);

      if (result.matched && result.userName && result.userId) {
        setStatus('matched');
        setResultName(result.userName);

        // Log attendance
        const logId = `log_${Date.now()}`;
        await logAttendance(
          logId,
          result.userId,
          result.userName,
          result.confidence,
          result.channel
        );

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
    }
  };

  const reset = () => {
    setStatus('idle');
    setResultName('');
    setConfidence(0);
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
      >
        <View style={styles.overlay}>
          <View style={[
            styles.faceBox,
            status === 'matched' && { borderColor: colors.success },
            status === 'failed' && { borderColor: colors.danger },
            status === 'scanning' && { borderColor: colors.warning },
          ]} />

          <View style={styles.statusBadge}>
            {status === 'idle' && (
              <Text style={styles.statusText}>
                {isModelReady ? '👤 Position your face' : '⏳ Loading models...'}
              </Text>
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
      </CameraView>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.flipButton}
          onPress={() => setFacing(f => f === 'front' ? 'back' : 'front')}
        >
          <Text style={styles.buttonText}>🔄</Text>
        </TouchableOpacity>

        {status === 'idle' || status === 'scanning' ? (
          <TouchableOpacity
            style={[styles.scanButton, isProcessing && { backgroundColor: colors.warning }]}
            onPress={verifyFace}
            disabled={isProcessing}
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
    flex: 1,
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