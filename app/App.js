import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList,
  Vibration, Platform
} from 'react-native';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const API_URL = 'http://65.109.8.35:3333';
const DEVICE_ID = 'fasi-phone';
const POLL_INTERVAL = 15000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

export default function App() {
  const [alarms, setAlarms] = useState([]);
  const [ringing, setRinging] = useState(null);
  const [connected, setConnected] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Starting...');
  const soundRef = useRef(null);
  const intervalRef = useRef(null);
  const ringingRef = useRef(null);
  const scheduledIds = useRef(new Set()); // track which alarms we've scheduled locally

  useEffect(() => { ringingRef.current = ringing; }, [ringing]);

  useEffect(() => {
    init();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      deactivateKeepAwake();
      stopAlarmSound();
    };
  }, []);

  // Listen for notification taps — trigger alarm UI
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data;
      if (data && data.alarmId) {
        // Alarm notification fired — trigger ringing
        triggerAlarm({ id: data.alarmId, label: data.label, time: data.time });
      }
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data && data.alarmId) {
        triggerAlarm({ id: data.alarmId, label: data.label, time: data.time });
      }
    });
    return () => { sub.remove(); responseSub.remove(); };
  }, []);

  async function init() {
    await setupAudio();
    await setupNotifications();
    await registerDevice();
    startPolling();
    try { await activateKeepAwakeAsync(); } catch(e) {}
  }

  async function setupAudio() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
    } catch (e) {}
  }

  async function setupNotifications() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alarms', {
        name: 'Alarms',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500, 200, 500],
        sound: 'alarm.wav',
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      setStatusMsg('⚠️ Notification permission denied!');
    }
  }

  async function registerDevice() {
    try {
      const res = await fetch(`${API_URL}/api/device/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: DEVICE_ID, name: "Fasi's Phone" }),
      });
      if (res.ok) {
        setConnected(true);
        setStatusMsg('Connected ✓');
      } else {
        setStatusMsg(`Register failed: ${res.status}`);
      }
    } catch (e) {
      setConnected(false);
      setStatusMsg(`Offline: ${e.message}`);
    }
  }

  function startPolling() {
    pollAlarms();
    intervalRef.current = setInterval(pollAlarms, POLL_INTERVAL);
  }

  async function pollAlarms() {
    try {
      const res = await fetch(`${API_URL}/api/alarms?deviceId=${DEVICE_ID}`);
      const data = await res.json();
      const pending = data.alarms.filter(a => !a.dismissed);
      setAlarms(pending);
      setConnected(true);

      // Schedule local notifications for future alarms
      for (const alarm of pending) {
        if (!scheduledIds.current.has(alarm.id)) {
          const alarmTime = new Date(alarm.time);
          const now = new Date();
          const secondsUntil = Math.floor((alarmTime - now) / 1000);
          
          if (secondsUntil > 0) {
            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: `🔔 ALARM — ${alarm.label}`,
                  body: `It's time! ${alarm.label}`,
                  sound: 'alarm.wav',
                  priority: 'max',
                  channelId: 'alarms',
                  data: { alarmId: alarm.id, label: alarm.label, time: alarm.time },
                },
                trigger: { type: 'date', date: alarmTime.getTime(), channelId: 'alarms' },
              });
              scheduledIds.current.add(alarm.id);
              console.log(`Scheduled local notification for "${alarm.label}" in ${secondsUntil}s`);
            } catch (e) {
              console.log('Schedule error:', e.message);
            }
          }
        }
      }

      // Check for currently ringing alarms (already past time)
      const ringRes = await fetch(`${API_URL}/api/alarms/ring?deviceId=${DEVICE_ID}`);
      const ringData = await ringRes.json();
      const activeAlarm = ringData.alarms.find(a => !a.dismissed);
      if (activeAlarm && (!ringingRef.current || ringingRef.current.id !== activeAlarm.id)) {
        triggerAlarm(activeAlarm);
      }
    } catch (e) {
      // Silent fail — don't mark offline on temporary network blip
    }
  }

  async function triggerAlarm(alarm) {
    setRinging(alarm);
    Vibration.vibrate([0, 1000, 500, 1000, 500, 1000], true);
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('./assets/alarm.wav'),
        { isLooping: true, volume: 1.0, shouldPlay: true }
      );
      soundRef.current = sound;
    } catch (e) {}
  }

  async function stopAlarmSound() {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch (e) {}
  }

  async function dismissAlarm(alarm) {
    Vibration.cancel();
    await stopAlarmSound();
    setRinging(null);
    try {
      await fetch(`${API_URL}/api/alarm/${alarm.id}/dismiss`, { method: 'POST' });
      setAlarms(prev => prev.filter(a => a.id !== alarm.id));
    } catch (e) {}
  }

  async function snoozeAlarm(alarm) {
    Vibration.cancel();
    await stopAlarmSound();
    setRinging(null);
    const snoozeTime = new Date(Date.now() + 5 * 60 * 1000);
    try {
      await fetch(`${API_URL}/api/alarm/${alarm.id}/dismiss`, { method: 'POST' });
      await fetch(`${API_URL}/api/alarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time: snoozeTime.toISOString(),
          label: `${alarm.label} (snoozed)`,
          deviceId: DEVICE_ID,
        }),
      });
      scheduledIds.current.delete(alarm.id); // allow re-scheduling
    } catch (e) {}
  }

  function formatTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function getTimeUntil(isoString) {
    const diff = new Date(isoString) - new Date();
    if (diff <= 0) return 'Now!';
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `in ${hrs}h ${mins % 60}m`;
    return `in ${mins}m`;
  }

  if (ringing) {
    return (
      <View style={styles.ringingContainer}>
        <Text style={styles.ringingEmoji}>🔔</Text>
        <Text style={styles.ringingLabel}>{ringing.label}</Text>
        <Text style={styles.ringingTime}>{formatTime(ringing.time)}</Text>
        <TouchableOpacity style={styles.snoozeButton} onPress={() => snoozeAlarm(ringing)}>
          <Text style={styles.snoozeText}>SNOOZE (5 min)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dismissButton} onPress={() => dismissAlarm(ringing)}>
          <Text style={styles.dismissText}>DISMISS</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔔 RingMe</Text>
        <View style={[styles.statusDot, { backgroundColor: connected ? '#4CAF50' : '#f44336' }]} />
        <Text style={styles.statusText}>{statusMsg}</Text>
      </View>
      <Text style={styles.subtitle}>Chotay sets alarms for you. Just ask! 🎯</Text>

      {alarms.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>😴</Text>
          <Text style={styles.emptyText}>No pending alarms</Text>
          <Text style={styles.emptySubtext}>Tell Chotay "wake me up at 2pm" and it'll show up here</Text>
        </View>
      ) : (
        <FlatList
          data={alarms}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.alarmCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.alarmTime}>{formatTime(item.time)}</Text>
                <Text style={styles.alarmLabel}>{item.label}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.alarmCountdown}>{getTimeUntil(item.time)}</Text>
                <TouchableOpacity onPress={async () => {
                  await fetch(`${API_URL}/api/alarm/${item.id}`, { method: 'DELETE' });
                  setAlarms(prev => prev.filter(a => a.id !== item.id));
                }}>
                  <Text style={styles.deleteBtn}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginRight: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 5 },
  statusText: { color: '#888', fontSize: 12, flex: 1 },
  subtitle: { color: '#888', fontSize: 16, marginBottom: 30 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyEmoji: { fontSize: 60, marginBottom: 20 },
  emptyText: { color: '#fff', fontSize: 22, fontWeight: '600' },
  emptySubtext: { color: '#666', fontSize: 14, textAlign: 'center', marginTop: 10, paddingHorizontal: 40 },
  alarmCard: { backgroundColor: '#16213e', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alarmTime: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  alarmLabel: { color: '#888', fontSize: 14, marginTop: 4 },
  alarmCountdown: { color: '#4CAF50', fontSize: 14, fontWeight: '600' },
  deleteBtn: { color: '#f44336', fontSize: 18, marginTop: 6, paddingHorizontal: 8 },
  ringingContainer: { flex: 1, backgroundColor: '#b71c1c', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  ringingEmoji: { fontSize: 80, marginBottom: 20 },
  ringingLabel: { color: '#fff', fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  ringingTime: { color: '#ffcdd2', fontSize: 20, marginBottom: 40 },
  snoozeButton: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 30, marginBottom: 15, width: '100%', alignItems: 'center' },
  snoozeText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  dismissButton: { backgroundColor: '#fff', paddingHorizontal: 50, paddingVertical: 18, borderRadius: 30, width: '100%', alignItems: 'center' },
  dismissText: { color: '#b71c1c', fontSize: 20, fontWeight: 'bold' },
});
