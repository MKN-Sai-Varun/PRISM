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
import {
  AttendancePeriod,
  filterLogsByPeriod,
  sortLogsNewestFirst,
} from '../utils/attendance';
import { getUnsyncedLogs } from '../db/sqlite';
import { useAppStore } from '../store/appStore';

export default function LogsScreen({ navigation }: any) {
  const { attendanceLogs } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [period, setPeriod] = useState<AttendancePeriod>('day');

  const loadLogs = async () => {
    setRefreshing(true);
    await getUnsyncedLogs(); // ensure db is initialised
    const filteredLogs = filterLogsByPeriod(attendanceLogs, period);
    setLogs(sortLogsNewestFirst(filteredLogs));
    setRefreshing(false);
  };

  useEffect(() => {
    loadLogs();
  }, [attendanceLogs, period]);

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
        <Text style={styles.count}>{logs.length} {period}</Text>
      </View>

      <View style={styles.filterRow}>
        {(['day', 'week', 'month'] as AttendancePeriod[]).map((item) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.filterChip,
              period === item && styles.filterChipActive,
            ]}
            onPress={() => setPeriod(item)}
          >
            <Text
              style={[
                styles.filterChipText,
                period === item && styles.filterChipTextActive,
              ]}
            >
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {logs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No attendance logs for this {period}</Text>
          <Text style={styles.emptySubtext}>Verify someone to see {period}-based logs here</Text>
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
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#fff',
  },
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