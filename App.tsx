import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============ 热量计算工具 ============
const MET_VALUES = {
  walking: 3.5,  // 走路 MET
  running: 9.8,   // 跑步 MET
};

function calculateCalories(met: number, weightKg: number, durationMinutes: number): number {
  //  Calories = MET × weight (kg) × duration (hours)
  return Math.round(met * weightKg * (durationMinutes / 60) * 1.05);
}

// ============ 类型定义 ============
type WorkoutType = 'walk' | 'run';

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
}

interface WorkoutRecord {
  id: string;
  type: WorkoutType;
  startTime: number;
  endTime: number;
  distance: number; // 米
  duration: number; // 秒
  calories: number; // 千卡
  steps: number;
  route: LocationPoint[];
  avgPace: number; // 秒/公里
}

interface WorkoutState {
  isActive: boolean;
  type: WorkoutType;
  startTime: number | null;
  duration: number; // 秒
  distance: number; // 米
  steps: number;
  currentLocation: LocationPoint | null;
  route: LocationPoint[];
  calories: number;
  pace: number; // 秒/公里
}

// ============ 默认状态 ============
const initialState: WorkoutState = {
  isActive: false,
  type: 'walk',
  startTime: null,
  duration: 0,
  distance: 0,
  steps: 0,
  currentLocation: null,
  route: [],
  calories: 0,
  pace: 0,
};

// ============ 格式化工具 ============
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)}km`;
}

function formatPace(secondsPerKm: number): string {
  if (!secondsPerKm || secondsPerKm === Infinity) return '--:--';
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.floor(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ============ 主屏幕 ============
export default function HomeScreen() {
  const [state, setState] = useState<WorkoutState>(initialState);
  const [history, setHistory] = useState<WorkoutRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [weight] = useState(70); // 默认体重 kg
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 加载历史记录
  useEffect(() => {
    loadHistory();
  }, []);

  // 清理函数
  useEffect(() => {
    return () => {
      if (locationSubscription.current) locationSubscription.current.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function loadHistory() {
    try {
      const data = await AsyncStorage.getItem('workout_history');
      if (data) setHistory(JSON.parse(data));
    } catch (e) { console.error(e); }
  }

  async function saveHistory(newRecord: WorkoutRecord) {
    const updated = [newRecord, ...history].slice(0, 50);
    setHistory(updated);
    await AsyncStorage.setItem('workout_history', JSON.stringify(updated));
  }

  // 开始运动
  async function startWorkout(type: WorkoutType) {
    // 请求权限
    const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
    if (locStatus !== 'granted') {
      Alert.alert('权限不足', '需要位置权限才能记录路线');
      return;
    }

    if (type === 'walk') {
      const { status: pedStatus } = await Pedometer.requestPermissionsAsync();
      if (pedStatus !== 'granted') {
        Alert.alert('权限不足', '需要运动权限才能计算步数');
        return;
      }
    }

    // 获取初始位置
    const initLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

    setState({
      isActive: true,
      type,
      startTime: Date.now(),
      duration: 0,
      distance: 0,
      steps: 0,
      currentLocation: {
        latitude: initLoc.coords.latitude,
        longitude: initLoc.coords.longitude,
        timestamp: initLoc.timestamp,
        accuracy: initLoc.coords.accuracy ?? undefined,
      },
      route: [{
        latitude: initLoc.coords.latitude,
        longitude: initLoc.coords.longitude,
        timestamp: initLoc.timestamp,
      }],
      calories: 0,
      pace: 0,
    });

    // 启动计时器
    timerRef.current = setInterval(() => {
      setState(prev => {
        const newDuration = prev.duration + 1;
        const met = prev.type === 'walk' ? MET_VALUES.walking : MET_VALUES.running;
        const newCalories = calculateCalories(met, weight, newDuration / 60);
        const newPace = prev.distance > 0 ? (newDuration / (prev.distance / 1000)) : 0;
        return { ...prev, duration: newDuration, calories: newCalories, pace: newPace };
      });
    }, 1000);

    // 启动位置追踪
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      (loc) => {
        const newPoint: LocationPoint = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          timestamp: loc.timestamp,
          accuracy: loc.coords.accuracy ?? undefined,
        };

        setState(prev => {
          if (!prev.isActive) return prev;

          // 计算距离
          let addedDist = 0;
          if (prev.route.length > 0) {
            const last = prev.route[prev.route.length - 1];
            addedDist = calcDistance(last.latitude, last.longitude, newPoint.latitude, newPoint.longitude);
          }

          const newDistance = prev.distance + addedDist;
          const newPace = newDistance > 0 ? (prev.duration / (newDistance / 1000)) : 0;

          return {
            ...prev,
            currentLocation: newPoint,
            route: [...prev.route, newPoint],
            distance: newDistance,
            pace: newPace,
          };
        });
      }
    );
  }

  // 停止运动
  async function stopWorkout() {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const finalState = state;
    const record: WorkoutRecord = {
      id: Date.now().toString(),
      type: finalState.type,
      startTime: finalState.startTime!,
      endTime: Date.now(),
      distance: finalState.distance,
      duration: finalState.duration,
      calories: finalState.calories,
      steps: finalState.steps,
      route: finalState.route,
      avgPace: finalState.duration > 0 && finalState.distance > 0
        ? finalState.duration / (finalState.distance / 1000) : 0,
    };

    await saveHistory(record);

    Alert.alert(
      '运动完成 🎉',
      `距离: ${formatDistance(record.distance)}\n时长: ${formatDuration(record.duration)}\n热量: ${record.calories}千卡`,
      [{ text: '确定', onPress: () => setState(initialState) }]
    );
  }

  // 删除历史记录
  async function deleteRecord(id: string) {
    const updated = history.filter(r => r.id !== id);
    setHistory(updated);
    await AsyncStorage.setItem('workout_history', JSON.stringify(updated));
  }

  // 计算两点间距离（米）
  function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ============ 渲染 ============
  if (showHistory) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.historyHeader}>
          <TouchableOpacity onPress={() => setShowHistory(false)}>
            <Text style={styles.backBtn}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.historyTitle}>运动记录</Text>
          <View style={{ width: 50 }} />
        </View>
        {history.length === 0 ? (
          <View style={styles.emptyState}><Text style={styles.emptyText}>暂无记录，开始你的第一次运动吧！</Text></View>
        ) : (
          history.map(record => (
            <View key={record.id} style={styles.historyCard}>
              <View style={styles.historyCardHeader}>
                <Text style={styles.historyType}>{record.type === 'run' ? '🏃 跑步' : '🚶 走路'}</Text>
                <TouchableOpacity onPress={() => deleteRecord(record.id)}>
                  <Text style={styles.deleteBtn}>删除</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.historyStats}>
                <View style={styles.historyStat}><Text style={styles.statValue}>{formatDistance(record.distance)}</Text><Text style={styles.statLabel}>距离</Text></View>
                <View style={styles.historyStat}><Text style={styles.statValue}>{formatDuration(record.duration)}</Text><Text style={styles.statLabel}>时长</Text></View>
                <View style={styles.historyStat}><Text style={styles.statValue}>{record.calories}</Text><Text style={styles.statLabel}>千卡</Text></View>
                <View style={styles.historyStat}><Text style={styles.statValue}>{formatPace(record.avgPace)}</Text><Text style={styles.statLabel}>配速</Text></View>
              </View>
              <Text style={styles.historyDate}>{new Date(record.startTime).toLocaleString('zh-CN')}</Text>
            </View>
          ))
        )}
      </SafeAreaView>
    );
  }

  if (state.isActive) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.activeHeader}>
          <Text style={styles.activeTitle}>{state.type === 'run' ? '🏃 跑步中' : '🚶 走路中'}</Text>
          <Text style={styles.activeTime}>{formatDuration(state.duration)}</Text>
        </View>

        {/* 地图 */}
        <View style={styles.mapContainer}>
          {state.currentLocation && (
            <MapView
              style={{ flex: 1 }}
              initialRegion={{
                latitude: state.currentLocation.latitude,
                longitude: state.currentLocation.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              showsUserLocation
              followsUserLocation
            >
              {state.route.length > 1 && (
                <Polyline
                  coordinates={state.route.map(p => ({ latitude: p.latitude, longitude: p.longitude }))}
                  strokeColor="#4CAF50"
                  strokeWidth={4}
                />
              )}
            </MapView>
          )}
        </View>

        {/* 实时数据 */}
        <View style={styles.statsContainer}>
          <View style={styles.mainStat}>
            <Text style={styles.mainStatValue}>{formatDistance(state.distance)}</Text>
            <Text style={styles.mainStatLabel}>距离</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statBoxValue}>{formatPace(state.pace)}</Text>
              <Text style={styles.statBoxLabel}>配速 /km</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statBoxValue}>{state.calories}</Text>
              <Text style={styles.statBoxLabel}>千卡</Text>
            </View>
          </View>
        </View>

        {/* 停止按钮 */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.stopBtn} onPress={stopWorkout}>
            <Text style={styles.stopBtnText}>停止运动</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 主页
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.homeHeader}>
        <Text style={styles.appTitle}>RunFit</Text>
        <Text style={styles.appSubtitle}>跑步 & 走路记录</Text>
      </View>

      <View style={styles.startContainer}>
        <Text style={styles.startPrompt}>选择一个运动开始</Text>

        <TouchableOpacity
          style={[styles.startCard, styles.walkCard]}
          onPress={() => startWorkout('walk')}
        >
          <Text style={styles.startCardEmoji}>🚶</Text>
          <Text style={styles.startCardTitle}>走路</Text>
          <Text style={styles.startCardDesc}>适合日常步行、散步</Text>
          <Text style={styles.startCardMET}>MET 3.5</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.startCard, styles.runCard]}
          onPress={() => startWorkout('run')}
        >
          <Text style={styles.startCardEmoji}>🏃</Text>
          <Text style={styles.startCardTitle}>跑步</Text>
          <Text style={styles.startCardDesc}>燃脂健身、锻炼心肺</Text>
          <Text style={styles.startCardMET}>MET 9.8</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.historyBtn} onPress={() => setShowHistory(true)}>
        <Text style={styles.historyBtnText}>📋 查看运动历史</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ============ 样式 ============
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  // 首页
  homeHeader: { alignItems: 'center', paddingVertical: 30 },
  appTitle: { fontSize: 36, fontWeight: 'bold', color: '#4CAF50' },
  appSubtitle: { fontSize: 16, color: '#888', marginTop: 5 },
  startContainer: { paddingHorizontal: 20, flex: 1 },
  startPrompt: { fontSize: 18, color: '#333', marginBottom: 15, marginLeft: 5 },
  startCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  walkCard: { borderLeftWidth: 4, borderLeftColor: '#2196F3' },
  runCard: { borderLeftWidth: 4, borderLeftColor: '#4CAF50' },
  startCardEmoji: { fontSize: 40, marginRight: 15 },
  startCardTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  startCardDesc: { fontSize: 13, color: '#888', marginTop: 3 },
  startCardMET: { fontSize: 12, color: '#aaa', marginTop: 2 },
  startCardTitleRow: { flex: 1 },
  historyBtn: {
    marginHorizontal: 20,
    marginBottom: 30,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  historyBtnText: { fontSize: 16, color: '#666' },

  // 运动中
  activeHeader: { alignItems: 'center', paddingVertical: 15, backgroundColor: '#4CAF50', paddingHorizontal: 20, paddingTop: 50 },
  activeTitle: { fontSize: 18, color: '#fff', fontWeight: '600' },
  activeTime: { fontSize: 48, fontWeight: 'bold', color: '#fff', fontVariant: ['tabular-nums'] },
  mapContainer: { flex: 1, margin: 10, borderRadius: 12, overflow: 'hidden' },
  statsContainer: { paddingHorizontal: 15, paddingVertical: 10 },
  mainStat: { alignItems: 'center', marginBottom: 10 },
  mainStatValue: { fontSize: 42, fontWeight: 'bold', color: '#333', fontVariant: ['tabular-nums'] },
  mainStatLabel: { fontSize: 14, color: '#888' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center', backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 10 },
  statBoxValue: { fontSize: 22, fontWeight: 'bold', color: '#333', fontVariant: ['tabular-nums'] },
  statBoxLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  controls: { padding: 15, paddingBottom: 30 },
  stopBtn: { backgroundColor: '#f44336', padding: 16, borderRadius: 12, alignItems: 'center' },
  stopBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // 历史
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, paddingTop: 50, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  backBtn: { fontSize: 16, color: '#4CAF50' },
  historyTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#888' },
  historyCard: { backgroundColor: '#fff', marginHorizontal: 15, marginTop: 15, borderRadius: 12, padding: 15, elevation: 1 },
  historyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  historyType: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  deleteBtn: { color: '#f44336', fontSize: 14 },
  historyStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  historyStat: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  historyDate: { fontSize: 12, color: '#aaa', textAlign: 'center' },
});
