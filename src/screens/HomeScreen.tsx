import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Alert,
} from 'react-native';
import { colors } from '../utils/colors';
import { filterTodayLogs } from '../utils/attendance';
import { useAppStore } from '../store/appStore';
import { syncAttendance, startAutoSync } from '../sync/awsSync';

export default function HomeScreen({ navigation }: any) {
  const { enrolledUsers, attendanceLogs, isOnline } = useAppStore();
  const todayLogs = filterTodayLogs(attendanceLogs);

  const hasSynced = useRef(false);

  useEffect(() => {
    const unsub = startAutoSync((result) => {
      if (hasSynced.current) return;
      hasSynced.current = true;
      Alert.alert(
        result.success ? '✅ Auto Sync Complete' : '❌ Auto Sync Failed',
        result.message
      );
      setTimeout(() => { hasSynced.current = false; }, 5000);
    });
    return () => unsub();
  }, []);

  const handleSync = async () => {
    Alert.alert('Syncing...', 'Please wait');
    const result = await syncAttendance();
    Alert.alert(
      result.success ? '✅ Sync Complete' : '❌ Sync Failed',
      result.message
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.dark} />

      <View style={styles.header}>
        <Text style={styles.title}>PRISM</Text>
        <Text style={styles.subtitle}>Adaptive Biometric Mesh • Offline Auth</Text>
        <View style={[styles.badge, { backgroundColor: isOnline ? colors.success : colors.danger }]}>
          <Text style={styles.badgeText}>{isOnline ? '🟢 Online' : '🔴 Offline'}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{enrolledUsers.length}</Text>
          <Text style={styles.statLabel}>Enrolled</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{todayLogs.length}</Text>
          <Text style={styles.statLabel}>Logs Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {todayLogs.filter((l) => !l.synced).length}
          </Text>
          <Text style={styles.statLabel}>Unsynced</Text>
        </View>
      </View>

      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('Enroll')}
        >
          <Text style={styles.buttonText}>➕ Enroll New Person</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.success }]}
          onPress={() => navigation.navigate('Verify')}
        >
          <Text style={styles.buttonText}>✅ Verify Identity</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.surfaceLight }]}
          onPress={() => navigation.navigate('Logs')}
        >
          <Text style={styles.buttonText}>📋 Attendance Logs</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.warning }]}
          onPress={handleSync}
        >
          <Text style={styles.buttonText}>🔄 Sync Logs</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>
        All processing on-device • No internet required
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 30 },
  title: { fontSize: 36, fontWeight: '800', color: colors.text, letterSpacing: 6 },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  badge: { marginTop: 14, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 20,
    marginBottom: 36,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  statNumber: { fontSize: 30, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  buttonGroup: { paddingHorizontal: 24, gap: 14 },
  button: { borderRadius: 14, padding: 18, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    fontSize: 11,
    color: colors.textMuted,
  },
});