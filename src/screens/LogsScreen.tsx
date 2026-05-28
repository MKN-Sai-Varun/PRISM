import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../utils/colors';

export default function LogsScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📋</Text>
      <Text style={styles.text}>Attendance Logs</Text>
      <Text style={styles.sub}>Sync mechanism coming Day 7</Text>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 48, marginBottom: 12 },
  text: { color: colors.text, fontSize: 22, fontWeight: '700' },
  sub: { color: colors.textMuted, marginTop: 8 },
  back: { color: colors.primary, marginTop: 30, fontSize: 16 },
});