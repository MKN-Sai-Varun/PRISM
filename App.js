import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAppStore } from './src/store/appStore';
import HomeScreen from './src/screens/HomeScreen';
import EnrollScreen from './src/screens/EnrollScreen';
import VerifyScreen from './src/screens/VerifyScreen';
import LogsScreen from './src/screens/LogsScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const setOnline = useAppStore((s) => s.setOnline);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    });
    return () => unsub();
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