/**
 * Sync & Purge Mechanism
 *
 * On network restore, syncs pending attendance records to the AWS endpoint.
 * Only metadata is transmitted — no face images or raw biometric data ever
 * leave the device (Zero Biometric Leakage architecture).
 */

import NetInfo from '@react-native-community/netinfo';
import { getUnsyncedLogs, markSynced } from '../db/sqlite';

// Demo endpoint (replace with production AWS API Gateway URL)
const SYNC_ENDPOINT = 'https://6a1c13928858a003817b832d.mockapi.io/attendance';

export interface SyncResult {
  success: boolean;
  synced:  number;
  failed:  number;
  message: string;
}

export async function syncAttendance(): Promise<SyncResult> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    return { success: false, synced: 0, failed: 0, message: 'No network connection' };
  }

  try {
    const unsyncedLogs = await getUnsyncedLogs();
    if (unsyncedLogs.length === 0) {
      return { success: true, synced: 0, failed: 0, message: 'Nothing to sync' };
    }

    const syncedIds: string[] = [];
    const failedIds: string[] = [];

    for (const log of unsyncedLogs) {
      try {
        const response = await fetch(SYNC_ENDPOINT, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            attendanceId: log.id,
            userId:       log.user_id,
            userName:     log.user_name,
            timestamp:    log.timestamp,
            confidence:   log.confidence,
            channel:      log.channel,
            deviceId:     'PRISM_DEVICE_001',
          }),
        });
        response.ok ? syncedIds.push(log.id) : failedIds.push(log.id);
      } catch {
        failedIds.push(log.id);
      }
    }

    if (syncedIds.length > 0) {
      await markSynced(syncedIds);
      const { useAppStore } = await import('../store/appStore');
      useAppStore.getState().markLogsSynced(syncedIds);
    }

    return {
      success: failedIds.length === 0,
      synced:  syncedIds.length,
      failed:  failedIds.length,
      message: `Synced ${syncedIds.length}, Failed ${failedIds.length}`,
    };
  } catch (e: any) {
    return { success: false, synced: 0, failed: 0, message: e.message };
  }
}

export function startAutoSync(onSync: (result: SyncResult) => void): () => void {
  return NetInfo.addEventListener(async (state) => {
    if (state.isConnected) {
      const result = await syncAttendance();
      onSync(result);
    }
  });
}
