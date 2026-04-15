import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';

export interface LogEntry {
  id: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

const MAX_LOGS = 200;
let logEntries: LogEntry[] = [];
let nextId = 0;
const listeners: ((entry: LogEntry) => void)[] = [];

export function addLog(level: LogEntry['level'], message: string) {
  const entry: LogEntry = {
    id: nextId++,
    level,
    message,
    timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
  };
  logEntries = [entry, ...logEntries].slice(0, MAX_LOGS);
  listeners.forEach((fn) => fn(entry));
}

export function subscribeLogs(fn: (entry: LogEntry) => void): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

// Catch unhandled promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event: any) => {
    addLog('error', `[UnhandledPromise] ${event.reason}`);
  });
}

const levelColor: Record<string, string> = {
  info: '#4CAF50',
  warn: '#FF9800',
  error: '#f44336',
};

export default function DebugConsole() {
  const [visible, setVisible] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([...logEntries]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const unsub = subscribeLogs((entry) => {
      setEntries((prev) => [entry, ...prev].slice(0, MAX_LOGS));
    });
    return unsub;
  }, []);

  const filtered = filter
    ? entries.filter((e) => e.message.toLowerCase().includes(filter.toLowerCase()))
    : entries;

  return (
    <>
      {/* Floating bug button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>🪲</Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>调试面板</Text>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Text style={styles.closeBtn}>✕ 关闭</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.filterInput}
            placeholder="过滤日志..."
            value={filter}
            onChangeText={setFilter}
            placeholderTextColor="#999"
          />

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => { logEntries = []; setEntries([]); }}
            >
              <Text style={styles.clearBtnText}>清空</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.logList} inverted showsVerticalScrollIndicator={false}>
            {filtered.length === 0 ? (
              <Text style={styles.emptyText}>暂无日志（打开页面后操作）</Text>
            ) : (
              filtered.map((entry) => (
                <View key={entry.id} style={styles.logRow}>
                  <Text style={[styles.logTs, { color: levelColor[entry.level] }]}>
                    {entry.timestamp}
                  </Text>
                  <Text style={[styles.logLevel, { color: levelColor[entry.level] }]}>
                    {entry.level.toUpperCase()}
                  </Text>
                  <Text style={styles.logMsg} numberOfLines={3}>{entry.message}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    zIndex: 999,
  },
  fabText: { fontSize: 22 },
  modal: { flex: 1, backgroundColor: '#1a1a1a', paddingTop: 48 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  closeBtn: { color: '#4CAF50', fontSize: 15 },
  filterInput: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    borderRadius: 8,
    margin: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  actions: { flexDirection: 'row', paddingHorizontal: 12, gap: 10, marginBottom: 8 },
  clearBtn: { backgroundColor: '#f44336', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6 },
  clearBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  logList: { flex: 1, paddingHorizontal: 12 },
  logRow: { flexDirection: 'row', paddingVertical: 4, alignItems: 'flex-start', gap: 6 },
  logTs: { fontSize: 10, fontVariant: ['tabular-nums'], minWidth: 52 },
  logLevel: { fontSize: 10, fontWeight: 'bold', minWidth: 44 },
  logMsg: { fontSize: 12, color: '#ddd', flex: 1 },
  emptyText: { color: '#666', textAlign: 'center', paddingVertical: 32, fontSize: 13 },
});
