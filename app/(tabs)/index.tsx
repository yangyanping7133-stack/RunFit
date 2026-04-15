import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { getWorkoutStats, getAllWorkouts, Workout } from '../database';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}小时${m}分钟`;
  return `${m}分钟`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters.toFixed(0)}米`;
  return `${(meters / 1000).toFixed(2)}公里`;
}

const typeLabels: Record<string, string> = {
  running: '跑步', walking: '走路', cycling: '骑行', strength: '力量', other: '其他',
};

export default function HomeScreen() {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];
  const [stats, setStats] = useState<{ totalDuration: number; totalDistance: number; totalCalories: number; totalSteps: number; workoutCount: number } | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const s = await getWorkoutStats(today);
    setStats(s);
    const all = await getAllWorkouts();
    setRecentWorkouts(all.slice(0, 3));
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeText}>今天想做什么运动？</Text>
        <TouchableOpacity style={styles.startButton} onPress={() => router.push('/record')}>
          <Text style={styles.startButtonText}>开始记录 ▶</Text>
        </TouchableOpacity>
      </View>

      {stats && (
        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>今日数据 · {today}</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.workoutCount}</Text>
              <Text style={styles.statLabel}>运动次数</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatDuration(stats.totalDuration)}</Text>
              <Text style={styles.statLabel}>总时长</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatDistance(stats.totalDistance)}</Text>
              <Text style={styles.statLabel}>总距离</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalCalories}</Text>
              <Text style={styles.statLabel}>消耗(千卡)</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.recentCard}>
        <Text style={styles.sectionTitle}>最近记录</Text>
        {recentWorkouts.length === 0 ? (
          <Text style={styles.emptyText}>暂无记录，开始你的第一次运动吧！</Text>
        ) : (
          recentWorkouts.map((w) => (
            <TouchableOpacity key={w.id} style={styles.workoutItem} onPress={() => router.push('/history')}>
              <View style={styles.workoutLeft}>
                <Text style={styles.workoutType}>{typeLabels[w.type] || w.type}</Text>
                <Text style={styles.workoutDate}>{w.date} {w.startTime.split('T')[1].substring(0, 5)}</Text>
              </View>
              <View style={styles.workoutRight}>
                <Text style={styles.workoutDuration}>{formatDuration(w.duration)}</Text>
                {w.distance != null && <Text style={styles.workoutDistance}>{formatDistance(w.distance)}</Text>}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  welcomeCard: { backgroundColor: '#4CAF50', padding: 24, borderRadius: 0 },
  welcomeText: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  startButton: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24, alignSelf: 'flex-start' },
  startButtonText: { color: '#4CAF50', fontSize: 16, fontWeight: 'bold' },
  statsCard: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statItem: { width: '50%', paddingVertical: 8 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#4CAF50' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 2 },
  recentCard: { backgroundColor: '#fff', margin: 16, marginTop: 0, padding: 16, borderRadius: 12, elevation: 2 },
  emptyText: { color: '#999', textAlign: 'center', paddingVertical: 24 },
  workoutItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  workoutLeft: {},
  workoutType: { fontSize: 15, fontWeight: '600', color: '#333' },
  workoutDate: { fontSize: 12, color: '#999', marginTop: 2 },
  workoutRight: { alignItems: 'flex-end' },
  workoutDuration: { fontSize: 14, fontWeight: '600', color: '#4CAF50' },
  workoutDistance: { fontSize: 12, color: '#999', marginTop: 2 },
});
