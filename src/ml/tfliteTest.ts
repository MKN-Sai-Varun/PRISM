import { loadFaceDetector } from './faceDetector';

export async function testTFLite(): Promise<string> {
  try {
    await loadFaceDetector();
    return 'BlazeFace loaded ✅ Ready for detection';
  } catch (e: any) {
    return `Failed ❌: ${e.message}`;
  }
}