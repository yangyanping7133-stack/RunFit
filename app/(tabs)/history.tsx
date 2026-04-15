import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { getAllWorkouts, getWorkoutsByDate, searchWorkouts, deleteWorkout, Workout } from '../database';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  if (h > 0) return `${h}小时${m}分钟`;
  return `${m}分${s}秒`;
}
function formatDistance(m: number | null): string {
  if (!m) return '-';
  return m < 1000 ? `${m.toFixed(0)}米` : `${(m / 1000).toFixed(2)}公里`;
}
const typeLabels: Record<string, string> = {
  running: '🏃 跑步', walking: '🚶 走路', cycling: '🚴 骑行', strength: '💪 力量', other: '❓ 其他',
};

function GroupHeader({ date }: { date: string }) {
  const d = new Date(date);
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  let label = date;
  if (date === today) label = '今天';
  else if (date === yesterday) label = '昨天';
  else label = `${d.getMonth() + 1}月${d.getDate()}日`;
  return (
    <View style={styles.groupHeader}>
      <Text style={styles.groupHeaderText}>{label}</Text>
    </View>
  );
}

export default function HistoryScreen() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [searchDate, setSearchDate] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const data = await getAllWorkouts();
    setWorkouts(data);
    setLoading(false);
  }

  async function handleDateSearch() {
    if (!searchDate.trim()) { loadAll(); return; }
    const iso = searchDate.trim();
    // Support YYYY-MM-DD or MM-DD
    const datePattern = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso
      : /^\d{2}-\d{2}$/.test(iso) ? `${new Date().getFullYear()}-${iso}` : iso;
    const results = await getWorkoutsByDate(datePattern);
    setWorkouts(results);
    setSearchKeyword('');
  }

  async function handleKeywordSearch() {
    if (!searchKeyword.trim()) { loadAll(); return; }
    const results = await searchWorkouts(searchKeyword.trim());
    setWorkouts(results);
    setSearchDate('');
  }

  function handleDelete(workout: Workout) {
    Alert.alert('删除确认', `删除 ${typeLabels[workout.type] || workout.type} 记录？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive', onPress: async () => {
          await deleteWorkout(workout.id);
          loadAll();
        },
      },
    ]);
  }

  // Group workouts by date
  const grouped: { date: string; items: Workout[] }[] = [];
  workouts.forEach((w) => {
    const last = grouped[grouped.length - 1];
    if (last && last.date === w.date) last.items.push(w);
    else grouped.push({ date: w.date, items: [w] });
  });

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.dateInput}
          placeholder="日期 如 2026-04-16"
          value={searchDate}
          onChangeText={setSearchDate}
          onSubmitEditing={handleDateSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleDateSearch}>
          <Text style={styles.searchBtnText}>查日期</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.keywordInput}
          placeholder="搜索备注/类型"
          value={searchKeyword}
          onChangeText={setSearchKeyword}
          onSubmitEditing={handleKeywordSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleKeywordSearch}>
          <Text style={styles.searchBtnText}>搜索</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearBtn} onPress={loadAll}>
          <Text style={styles.clearBtnText}>全部</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.emptyText}>加载中...</Text>
      ) : workouts.length === 0 ? (
        <Text style={styles.emptyText}>暂无记录</Text>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(item) => item.date}
          renderItem={({ item: group }) => (
            <View>
              <GroupHeader date={group.date} />
              {group.items.map((w) => (
                <TouchableOpacity key={w.id} style={styles.workoutCard} onLongPress={() => handleDelete(w)}>
                  <View style={styles.cardTop}>
                    <Text style={styles.typeLabel}>{typeLabels[w.type] || w.type}</Text>
                    <Text style={styles.timeText}>{w.startTime.split('T')[1].substring(0, 5)}</Text>
                  </View>
                  <View style={styles.cardStats}>
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{formatDuration(w.duration)}</Text>
                      <Text style={styles.statLabel}>时长</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{formatDistance(w.distance)}</Text>
                      <Text style={styles.statLabel}>距离</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{w.calories}</Text>
                      <Text style={styles.statLabel}>千卡</Text>
                    </View>
                    {w.steps != null && (
                      <View style={styles.stat}>
                        <Text style={styles.statValue}>{w.steps}</Text>
                        <Text style={styles.statLabel}>步数</Text>
                      </View>
                    )}
                  </View>
                  {w.notes && <Text style={styles.notes}>备注：{w.notes}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 12 },
  searchBar: { flexDirection: 'row', marginBottom: 8, gap: 8 },
  dateInput: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  keywordInput: { flex: 2, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  searchBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  clearBtn: { backgroundColor: '#999', paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center' },
  clearBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  groupHeader: { paddingVertical: 8, paddingHorizontal: 4 },
  groupHeaderText: { fontSize: 14, fontWeight: 'bold', color: '#666' },
  workoutCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  typeLabel: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  timeText: { fontSize: 13, color: '#999' },
  cardStats: { flexDirection: 'row', gap: 20 },
  stat: {},
  statValue: { fontSize: 16, fontWeight: '600', color: '#4CAF50' },
  statLabel: { fontSize: 11, color: '#999', marginTop: 1 },
  notes: { fontSize: 12, color: '#999', marginTop: 8, fontStyle: 'italic' },
  emptyText: { textAlign: 'center', color: '#999', paddingVertical: 40, fontSize: 14 },
});
