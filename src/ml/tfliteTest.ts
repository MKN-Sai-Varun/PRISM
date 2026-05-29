import { loadTensorflowModel } from 'react-native-fast-tflite';

export async function testTFLite(): Promise<string> {
  try {
    const model = await loadTensorflowModel(
      require('../../assets/models/blaze_face_short_range.tflite'),
      []
    );
    return 'TFLite working ✅ BlazeFace loaded';
  } catch (e: any) {
    return `TFLite failed ❌: ${e.message}`;
  }
}