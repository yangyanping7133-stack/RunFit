import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { Accuracy } from 'expo-location';
import { insertWorkout } from '../database';

type WorkoutType = 'running' | 'walking' | 'cycling' | 'strength' | 'other';

const typeLabels: Record<WorkoutType, string> = {
  running: '🏃 跑步',
  walking: '🚶 走路',
  cycling: '🚴 骑行',
  strength: '💪 力量训练',
  other: '❓ 其他',
};

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getMET(type: WorkoutType): number {
  return type === 'running' ? 9.8 : type === 'walking' ? 3.8 : type === 'cycling' ? 7.5 : 4.0;
}

export default function RecordScreen() {
  const router = useRouter();
  const [workoutType, setWorkoutType] = useState<WorkoutType>('running');
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [steps, setSteps] = useState(0);
  const [calories, setCalories] = useState(0);
  const [notes, setNotes] = useState('');

  const startTimeRef = useRef<string | null>(null);
  const locationSubRef = useRef<{ remove: () => void } | null>(null);
  const pedometerSubRef = useRef<{ remove: () => void } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const workoutTypeRef = useRef<WorkoutType>('running');

  // Keep workoutTypeRef in sync
  useEffect(() => { workoutTypeRef.current = workoutType; }, [workoutType]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      locationSubRef.current?.remove();
      pedometerSubRef.current?.remove();
    };
  }, []);

  async function startRecording() {
    try {
      // Request location permission gracefully
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Not fatal — can still record without GPS
        console.warn('Location permission denied, running without GPS');
      }

      startTimeRef.current = new Date().toISOString();
      setIsRecording(true);
      setElapsed(0);
      setDistance(0);
      setSteps(0);
      setCalories(0);

      // Timer — update every second
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          // Update calories every 10 seconds
          if (next % 10 === 0) {
            const met = getMET(workoutTypeRef.current);
            setCalories(Math.round(met * 70 * (next / 3600)));
          }
          return next;
        });
      }, 1000);

      // GPS tracking (wrapped — won't crash if permission denied)
      try {
        const { remove: locRemove } = await Location.watchPositionAsync(
          { accuracy: Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
          (loc) => {
            const { latitude, longitude } = loc.coords;
            if (lastLocationRef.current) {
              const d = haversine(
                lastLocationRef.current.latitude,
                lastLocationRef.current.longitude,
                latitude,
                longitude
              );
              setDistance((prev) => prev + d);
            }
            lastLocationRef.current = { latitude, longitude };
          }
        );
        locationSubRef.current = { remove: locRemove };
      } catch (locErr) {
        console.warn('Location tracking failed:', locErr);
      }

      // Pedometer (wrapped — will fail on HarmonyOS without GMS)
      try {
        const isAvailable = await Pedometer.isAvailableAsync();
        if (isAvailable) {
          const { remove: pedRemove } = await Pedometer.watchStepCount((result) => {
            setSteps(result.steps);
          });
          pedometerSubRef.current = { remove: pedRemove };
        }
      } catch (pedErr) {
        // Pedometer not available on this device — not fatal
        console.warn('Pedometer unavailable on this device:', pedErr);
      }
    } catch (err) {
      // Catch-all: any unexpected error during start should not white-screen
      console.error('Failed to start recording:', err);
      Alert.alert('启动失败', `无法开始记录：${String(err)}`);
      setIsRecording(false);
      startTimeRef.current = null;
    }
  }

  function stopRecording(save: boolean = true) {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    locationSubRef.current?.remove();
    locationSubRef.current = null;
    pedometerSubRef.current?.remove();
    pedometerSubRef.current = null;
    setIsRecording(false);

    if (!save || !startTimeRef.current) return;

    const endTime = new Date().toISOString();
    const date = startTimeRef.current.split('T')[0];
    const cals = Math.round(getMET(workoutTypeRef.current) * 70 * (elapsed / 3600));

    insertWorkout({
      type: workoutTypeRef.current,
      duration: elapsed,
      distance: distance || null,
      calories: cals || calories || 0,
      date,
      startTime: startTimeRef.current,
      endTime,
      steps: steps || null,
      avgHeartRate: null,
      notes: notes || null,
    })
      .then(() => {
        Alert.alert('保存成功', `记录已保存：${formatElapsed(elapsed)} / ${formatDistance(distance)}`, [
          { text: '查看历史', onPress: () => router.push('/history') },
          { text: '确定', onPress: () => setNotes('') },
        ]);
      })
      .catch((err) => {
        console.error('Failed to save workout:', err);
        Alert.alert('保存失败', String(err));
      });

    startTimeRef.current = null;
  }

  function formatElapsed(s: number): string {
    const h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60),
      sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }
  function formatDistance(m: number): string {
    return m < 1000 ? `${m.toFixed(0)}米` : `${(m / 1000).toFixed(2)}公里`;
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {!isRecording && (
        <View style={styles.typeSection}>
          <Text style={styles.label}>选择运动类型</Text>
          <View style={styles.typeGrid}>
            {(Object.keys(typeLabels) as WorkoutType[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeButton, workoutType === t && styles.typeButtonActive]}
                onPress={() => setWorkoutType(t)}
              >
                <Text style={[styles.typeButtonText, workoutType === t && styles.typeButtonTextActive]}>
                  {typeLabels[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.statsSection}>
        <View style={styles.mainStat}>
          <Text style={styles.mainStatValue}>{formatElapsed(elapsed)}</Text>
          <Text style={styles.mainStatLabel}>时长</Text>
        </View>
        <View style={styles.row}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatDistance(distance)}</Text>
            <Text style={styles.statLabel}>距离</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{steps || '-'}</Text>
            <Text style={styles.statLabel}>步数</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{calories || '-'}</Text>
            <Text style={styles.statLabel}>千卡</Text>
          </View>
        </View>
      </View>

      {!isRecording && (
        <>
          <TextInput
            style={styles.notesInput}
            placeholder="备注（可选）"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <TouchableOpacity style={styles.startBtn} onPress={startRecording}>
            <Text style={styles.startBtnText}>开始运动</Text>
          </TouchableOpacity>
        </>
      )}

      {isRecording && (
        <View style={styles.recordingControls}>
          <View style={styles.recordingIndicator}>
            <Text style={styles.recordingDot}>●</Text>
            <Text style={styles.recordingText}>记录中...</Text>
          </View>
          <TouchableOpacity style={styles.stopBtn} onPress={() => stopRecording(true)}>
            <Text style={styles.stopBtnText}>结束运动</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  typeSection: { marginBottom: 24 },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#e0e0e0' },
  typeButtonActive: { backgroundColor: '#4CAF50' },
  typeButtonText: { fontSize: 14, color: '#666' },
  typeButtonTextActive: { color: '#fff', fontWeight: 'bold' },
  statsSection: { backgroundColor: '#fff', borderRadius: 16, padding: 24, marginBottom: 16, elevation: 2 },
  mainStat: { alignItems: 'center', marginBottom: 20 },
  mainStatValue: { fontSize: 52, fontWeight: 'bold', color: '#4CAF50', fontVariant: ['tabular-nums'] },
  mainStatLabel: { fontSize: 14, color: '#999', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 2 },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  startBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  recordingControls: { alignItems: 'center', marginTop: 10 },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  recordingDot: { color: '#f44336', fontSize: 20, marginRight: 8 },
  recordingText: { color: '#f44336', fontSize: 16, fontWeight: 'bold' },
  stopBtn: { backgroundColor: '#f44336', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 30 },
  stopBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
