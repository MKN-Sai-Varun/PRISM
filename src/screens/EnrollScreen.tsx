import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors } from '../utils/colors';
import { loadFaceDetector, detectFace } from '../ml/faceDetector';
import { loadFaceEmbedding, getEmbedding } from '../ml/faceEmbedding';
import { enrollUser, initDB } from '../db/sqlite';
import { useAppStore } from '../store/appStore';

export default function EnrollScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [isModelReady, setIsModelReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'details' | 'camera'>('details');
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [captureCount, setCaptureCount] = useState(0);
  const [embeddings, setEmbeddings] = useState<number[][]>([]);
  const cameraRef = useRef<CameraView>(null);
  const addUser = useAppStore((s) => s.addUser);

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

  const captureAndEmbed = async () => {
    if (!isModelReady) {
      Alert.alert('Please wait', 'Models are still loading...');
      return;
    }
    if (!cameraRef.current) return;

    setIsProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (!photo?.uri) return;

      // Detect face first
      const box = await detectFace(photo.uri, photo.width, photo.height);
      if (!box) {
        Alert.alert('No face detected', 'Please position your face clearly in the box');
        return;
      }

      // Get embedding
      const embedding = await getEmbedding(photo.uri);
      if (!embedding) {
        Alert.alert('Error', 'Could not generate face embedding');
        return;
      }

      const newEmbeddings = [...embeddings, embedding];
      setEmbeddings(newEmbeddings);
      setCaptureCount(captureCount + 1);

      if (newEmbeddings.length >= 3) {
        // Average 3 embeddings for robustness
        const avgEmbedding = newEmbeddings[0].map((_, i) =>
          newEmbeddings.reduce((sum, e) => sum + e[i], 0) / newEmbeddings.length
        );

        // Save to SQLite
        const userId = `user_${Date.now()}`;
        await enrollUser(userId, name, employeeId, avgEmbedding, []);

        // Update store
        addUser({
          id: userId,
          name,
          employeeId,
          rgbEmbedding: avgEmbedding,
          geoVector: [],
          enrolledAt: new Date().toISOString(),
        });

        Alert.alert(
          '✅ Enrolled Successfully!',
          `${name} has been enrolled with ${newEmbeddings.length} face captures.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert(
          `Capture ${newEmbeddings.length}/3`,
          `Good! ${3 - newEmbeddings.length} more capture(s) needed.`
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsProcessing(false);
    }
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

  if (step === 'details') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>👤 New Enrollment</Text>
        <Text style={styles.subtitle}>Enter personnel details</Text>

        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <TextInput
          style={styles.input}
          placeholder="Employee ID"
          placeholderTextColor={colors.textMuted}
          value={employeeId}
          onChangeText={setEmployeeId}
        />

        <TouchableOpacity
          style={[styles.button, (!name || !employeeId) && { opacity: 0.5 }]}
          disabled={!name || !employeeId}
          onPress={() => setStep('camera')}
        >
          <Text style={styles.buttonText}>Continue to Camera →</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
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
        <View style={styles.faceBox} />
        <Text style={styles.instruction}>
          {!isModelReady && '⏳ Loading models...'}
          {isModelReady && !isProcessing && `📸 Capture ${captureCount + 1}/3 — Look straight ahead`}
          {isProcessing && '⏳ Processing...'}
        </Text>
        <View style={styles.progressRow}>
          {[0, 1, 2].map(i => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i < captureCount && { backgroundColor: colors.success }
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.flipButton}
          onPress={() => setFacing(f => f === 'front' ? 'back' : 'front')}
        >
          <Text style={styles.buttonText}>🔄</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureButton, isProcessing && { backgroundColor: colors.warning }]}
          onPress={captureAndEmbed}
          disabled={isProcessing}
        >
          {isProcessing
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.captureText}>📸</Text>
          }
        </TouchableOpacity>

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
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 30,
  },
  input: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    color: colors.text,
    fontSize: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
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
  instruction: {
    color: '#fff',
    marginTop: 20,
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 8,
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  progressDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
    borderWidth: 2,
    borderColor: colors.primary,
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
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureText: {
    fontSize: 30,
  },
  button: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  backText: {
    color: colors.primary,
    marginTop: 20,
    fontSize: 16,
  },
  text: {
    color: colors.text,
    fontSize: 16,
  },
});