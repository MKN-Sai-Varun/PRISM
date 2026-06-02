import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { colors } from '../utils/colors';
import { getAllUsers, getUnsyncedLogs } from '../db/sqlite';
import { useAppStore } from '../store/appStore';

export default function LogsScreen({ navigation }: any) {
  const { attendanceLogs } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  const loadLogs = async () => {
    setRefreshing(true);
    // Merge store logs with unsynced db logs
    const unsynced = await getUnsyncedLogs();
    const merged = [...attendanceLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    setLogs(merged);
    setRefreshing(false);
  };

  useEffect(() => {
    loadLogs();
  }, [attendanceLogs]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const renderLog = ({ item }: any) => (
    <View style={styles.logCard}>
      <View style={styles.logLeft}>
        <View style={[
          styles.avatar,
          { backgroundColor: item.synced ? colors.success + '33' : colors.warning + '33' }
        ]}>
          <Text style={styles.avatarText}>
            {item.userName?.charAt(0).toUpperCase() ?? '?'}
          </Text>
        </View>
      </View>
      <View style={styles.logMiddle}>
        <Text style={styles.logName}>{item.userName}</Text>
        <Text style={styles.logMeta}>
          {formatDate(item.timestamp)} • {formatTime(item.timestamp)}
        </Text>
        <Text style={styles.logChannel}>
          Channel: {item.channel.toUpperCase()} • {Math.round(item.confidence * 100)}%
        </Text>
      </View>
      <View style={styles.logRight}>
        <View style={[
          styles.syncBadge,
          { backgroundColor: item.synced ? colors.success : colors.warning }
        ]}>
          <Text style={styles.syncText}>
            {item.synced ? '✓ Synced' : '⏳ Pending'}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.dark} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Attendance Logs</Text>
        <Text style={styles.count}>{logs.length} records</Text>
      </View>

      {logs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No attendance logs yet</Text>
          <Text style={styles.emptySubtext}>Verify someone to see logs here</Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={renderLog}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={loadLogs}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { color: colors.primary, fontSize: 16 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  count: { color: colors.textMuted, fontSize: 13 },
  list: { padding: 16, gap: 12 },
  logCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logLeft: {},
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: colors.text },
  logMiddle: { flex: 1 },
  logName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  logMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  logChannel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  logRight: {},
  syncBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  syncText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyIcon: { fontSize: 60 },
  emptyText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptySubtext: { color: colors.textMuted, fontSize: 14 },
});