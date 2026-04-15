import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { insertWorkout } from '../database';

type WorkoutType = 'running' | 'walking' | 'cycling' | 'strength' | 'other';

const typeLabels: Record<WorkoutType, string> = {
  running: '🏃 跑步',
  walking: '🚶 走路',
  cycling: '🚴 骑行',
  strength: '💪 力量训练',
  other: '❓ 其他',
};

const metValues: Record<WorkoutType, number> = {
  running: 9.8, walking: 3.8, cycling: 7.5, strength: 4.0, other: 4.0,
};

export default function RecordScreen() {
  const router = useRouter();
  const [workoutType, setWorkoutType] = useState<WorkoutType>('running');
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState('');
  const [steps, setSteps] = useState('');
  const [notes, setNotes] = useState('');

  const startTimeRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startRecording() {
    startTimeRef.current = new Date().toISOString();
    setIsRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((n) => n + 1), 1000);
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsRecording(false);
    if (!startTimeRef.current) return;

    const distMeters = distance ? Math.round(parseFloat(distance) * 1000) : 0;
    const stepCount = steps ? parseInt(steps, 10) : 0;
    const met = metValues[workoutType];
    const cals = Math.round(met * 70 * (elapsed / 3600));
    const endTime = new Date().toISOString();
    const date = startTimeRef.current.split('T')[0];

    insertWorkout({
      type: workoutType,
      duration: elapsed,
      distance: distMeters || null,
      calories: cals,
      date,
      startTime: startTimeRef.current,
      endTime,
      steps: stepCount || null,
      avgHeartRate: null,
      notes: notes || null,
    }).then(() => {
      Alert.alert('保存成功', `${formatElapsed(elapsed)} / ${distance || '0'}公里 / ${cals}千卡`, [
        { text: '查看历史', onPress: () => router.push('/history') },
        { text: '确定', onPress: () => { setDistance(''); setSteps(''); setNotes(''); } },
      ]);
    }).catch((err) => Alert.alert('保存失败', String(err)));

    startTimeRef.current = null;
  }

  function formatElapsed(s: number): string {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {!isRecording && (
        <View style={styles.typeSection}>
          <Text style={styles.label}>选择运动类型</Text>
          <View style={styles.typeGrid}>
            {(Object.keys(typeLabels) as WorkoutType[]).map((t) => (
              <TouchableOpacity key={t} style={[styles.typeButton, workoutType === t && styles.typeButtonActive]} onPress={() => setWorkoutType(t)}>
                <Text style={[styles.typeButtonText, workoutType === t && styles.typeButtonTextActive]}>{typeLabels[t]}</Text>
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
      </View>

      {isRecording && (
        <View style={styles.inputSection}>
          <TextInput style={styles.input} placeholder="运动距离（公里）" keyboardType="decimal-pad" value={distance} onChangeText={setDistance} />
          <TextInput style={styles.input} placeholder="步数（可选）" keyboardType="number-pad" value={steps} onChangeText={setSteps} />
        </View>
      )}

      {!isRecording && (
        <>
          <TextInput style={styles.notesInput} placeholder="备注（可选）" value={notes} onChangeText={setNotes} multiline />
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
          <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
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
  mainStat: { alignItems: 'center' },
  mainStatValue: { fontSize: 52, fontWeight: 'bold', color: '#4CAF50', fontVariant: ['tabular-nums'] },
  mainStatLabel: { fontSize: 14, color: '#999', marginTop: 4 },
  inputSection: { gap: 10, marginBottom: 16 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15 },
  notesInput: { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 16, minHeight: 60, textAlignVertical: 'top' },
  startBtn: { backgroundColor: '#4CAF50', paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginBottom: 20 },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  recordingControls: { alignItems: 'center', marginTop: 10 },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  recordingDot: { color: '#f44336', fontSize: 20, marginRight: 8 },
  recordingText: { color: '#f44336', fontSize: 16, fontWeight: 'bold' },
  stopBtn: { backgroundColor: '#f44336', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 30 },
  stopBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
