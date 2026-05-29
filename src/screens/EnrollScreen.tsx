import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors } from '../utils/colors';
import { loadFaceDetector, detectFace, FaceBox } from '../ml/faceDetector';

export default function EnrollScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [faceBox, setFaceBox] = useState<FaceBox | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const detectionInterval = useRef<any>(null);

  useEffect(() => {
    loadFaceDetector().then(() => setIsModelReady(true));
    return () => {
      if (detectionInterval.current) clearInterval(detectionInterval.current);
    };
  }, []);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  const startDetection = () => {
    if (!isModelReady) {
      Alert.alert('Please wait', 'Model is still loading...');
      return;
    }
    setIsDetecting(true);
    detectionInterval.current = setInterval(async () => {
      if (!cameraRef.current) return;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.1,
          skipProcessing: true,
        });
        if (!photo?.base64) return;

        // Decode base64 to pixel data
        const binary = atob(photo.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const box = await detectFace(bytes, photo.width, photo.height);
        setFaceBox(box);
      } catch (e) {
        console.log('Detection error:', e);
      }
    }, 500);
  };

  const stopDetection = () => {
    setIsDetecting(false);
    if (detectionInterval.current) clearInterval(detectionInterval.current);
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
            faceBox && { borderColor: colors.success },
            !faceBox && isDetecting && { borderColor: colors.warning },
          ]} />
          <Text style={styles.instruction}>
            {!isModelReady && '⏳ Loading model...'}
            {isModelReady && !isDetecting && '👆 Tap detect to start'}
            {isDetecting && faceBox && `✅ Face detected (${Math.round(faceBox.confidence * 100)}%)`}
            {isDetecting && !faceBox && '🔍 Looking for face...'}
          </Text>
        </View>
      </CameraView>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.flipButton}
          onPress={() => setFacing(f => f === 'front' ? 'back' : 'front')}
        >
          <Text style={styles.buttonText}>🔄</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureButton, isDetecting && { backgroundColor: colors.danger }]}
          onPress={isDetecting ? stopDetection : startDetection}
        >
          <Text style={styles.captureText}>{isDetecting ? '⏹' : '▶️'}</Text>
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
  instruction: {
    color: '#fff',
    marginTop: 20,
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 8,
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