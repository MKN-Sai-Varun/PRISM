/**
 * modelLoader.ts
 *
 * In standalone (preview/production) builds, Expo bundles assets under
 * an internal URI scheme that react-native-fast-tflite cannot open directly.
 * This module copies each model to the app's cache directory on first run
 * and returns a file:// URI that the native TFLite loader can open.
 */

import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

async function getModelUri(assetModule: number): Promise<string> {
  // Load the asset to resolve its localUri
  const [asset] = await Asset.loadAsync(assetModule);

  if (asset.localUri) {
    return asset.localUri;
  }

  // localUri is null in standalone builds — download to cache manually
  const destUri = FileSystem.cacheDirectory + asset.name + '.' + asset.type;

  const info = await FileSystem.getInfoAsync(destUri);
  if (!info.exists) {
    await FileSystem.downloadAsync(asset.uri, destUri);
  }

  return destUri;
}

export async function getBlazeFaceUri(): Promise<string> {
  return getModelUri(require('../../assets/models/blaze_face_short_range.tflite'));
}

export async function getMobileFaceNetUri(): Promise<string> {
  return getModelUri(require('../../assets/models/mobilefacenet.tflite'));
}
