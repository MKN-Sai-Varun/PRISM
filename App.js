import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import NetInfo from '@react-native-community/netinfo';
import { useAppStore } from './src/store/appStore';
import { colors } from './src/utils/colors';
import HomeScreen from './src/screens/HomeScreen';
import EnrollScreen from './src/screens/EnrollScreen';
import VerifyScreen from './src/screens/VerifyScreen';
import LogsScreen from './src/screens/LogsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const setOnline = useAppStore((s) => s.setOnline);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    });
    return () => unsub();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.dark },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Enroll" component={EnrollScreen} options={{ title: 'Enroll Person' }} />
        <Stack.Screen name="Verify" component={VerifyScreen} options={{ title: 'Verify Identity' }} />
        <Stack.Screen name="Logs" component={LogsScreen} options={{ title: 'Attendance Logs' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}