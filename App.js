import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAppStore } from './src/store/appStore';
import { initDB, getAllAttendanceLogs } from './src/db/sqlite';
import HomeScreen from './src/screens/HomeScreen';
import EnrollScreen from './src/screens/EnrollScreen';
import VerifyScreen from './src/screens/VerifyScreen';
import LogsScreen from './src/screens/LogsScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const setOnline = useAppStore((s) => s.setOnline);
  const setAttendanceLogs = useAppStore((s) => s.setAttendanceLogs);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      await initDB();
      const logs = await getAllAttendanceLogs();
      if (!mounted) return;
      setAttendanceLogs(logs.map((log) => ({
        id: log.id,
        userId: log.user_id,
        userName: log.user_name,
        timestamp: log.timestamp,
        confidence: log.confidence,
        channel: log.channel,
        synced: log.synced,
      })));
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const navigate = (screen) => setCurrentScreen(screen);
  const goBack = () => setCurrentScreen('Home');

  const navigation = { navigate, goBack };

  return (
    <View style={styles.container}>
      {currentScreen === 'Home' && <HomeScreen navigation={navigation} />}
      {currentScreen === 'Enroll' && <EnrollScreen navigation={navigation} />}
      {currentScreen === 'Verify' && <VerifyScreen navigation={navigation} />}
      {currentScreen === 'Logs' && <LogsScreen navigation={navigation} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});