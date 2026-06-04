import { cacheDirectory, getInfoAsync, downloadAsync } from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

async function getModelUri(assetModule: number): Promise<string> {
  const [asset] = await Asset.loadAsync(assetModule);

  console.log('Asset name:', asset.name);
  console.log('Asset localUri:', asset.localUri);
  console.log('Asset uri:', asset.uri);

  if (asset.localUri && asset.localUri.startsWith('file://')) {
    return asset.localUri;
  }

  const destUri = cacheDirectory + asset.name + '.tflite';
  console.log('Dest URI:', destUri);

  const info = await getInfoAsync(destUri);
  if (!info.exists) {
    console.log('Downloading model to cache...');
    await downloadAsync(asset.uri, destUri);
    console.log('Download complete');
  } else {
    console.log('Model already cached');
  }

  return destUri;
}

export async function getBlazeFaceUri(): Promise<string> {
  return getModelUri(require('../../assets/models/blaze_face_short_range.tflite'));
}

export async function getMobileFaceNetUri(): Promise<string> {
  return getModelUri(require('../../assets/models/mobilefacenet.tflite'));
}