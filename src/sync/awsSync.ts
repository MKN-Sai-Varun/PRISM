/**
 * Sync & Purge Mechanism
 * Syncs attendance logs to AWS (MockAPI for demo)
 * Purges local records after successful sync
 * Zero biometric leakage — only metadata synced, never face images
 */

import NetInfo from '@react-native-community/netinfo';
import { getUnsyncedLogs, markSynced } from '../db/sqlite';

const SYNC_ENDPOINT = 'https://6a1c13928858a003817b832d.mockapi.io/attendance';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  message: string;
}

export async function syncAttendance(): Promise<SyncResult> {
  // Check network
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    return {
      success: false,
      synced: 0,
      failed: 0,
      message: 'No network connection',
    };
  }

  try {
    const unsyncedLogs = await getUnsyncedLogs();

    if (unsyncedLogs.length === 0) {
      return {
        success: true,
        synced: 0,
        failed: 0,
        message: 'Nothing to sync',
      };
    }

    console.log(`Syncing ${unsyncedLogs.length} records...`);

    const syncedIds: string[] = [];
    const failedIds: string[] = [];

    for (const log of unsyncedLogs) {
      try {
        // Only send metadata — ZERO biometric data
        const payload = {
          attendanceId: log.id,
          userId: log.user_id,
          userName: log.user_name,
          timestamp: log.timestamp,
          confidence: log.confidence,
          channel: log.channel,
          deviceId: 'PRISM_DEVICE_001',
        };

        const response = await fetch(SYNC_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          syncedIds.push(log.id);
          console.log('Synced log:', log.id);
        } else {
          failedIds.push(log.id);
          console.log('Failed to sync:', log.id, response.status);
        }
      } catch (e: any) {
        failedIds.push(log.id);
        console.log('Sync error for log:', log.id, e.message);
      }
    }

    // Mark synced records
    if (syncedIds.length > 0) {
      await markSynced(syncedIds);
      console.log(`Marked ${syncedIds.length} records as synced`);
    }

    return {
      success: failedIds.length === 0,
      synced: syncedIds.length,
      failed: failedIds.length,
      message: `Synced ${syncedIds.length}, Failed ${failedIds.length}`,
    };
  } catch (e: any) {
    console.log('Sync failed:', e.message);
    return {
      success: false,
      synced: 0,
      failed: 0,
      message: e.message,
    };
  }
}

// Auto sync when network is restored
export function startAutoSync(onSync: (result: SyncResult) => void): () => void {
  const unsub = NetInfo.addEventListener(async (state) => {
    if (state.isConnected) {
      console.log('Network restored — starting sync...');
      const result = await syncAttendance();
      onSync(result);
    }
  });

  return unsub;
}