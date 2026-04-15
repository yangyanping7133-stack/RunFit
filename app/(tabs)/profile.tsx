import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { getAllWorkouts } from '../database';

export default function ProfileScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>🏃</Text>
        </View>
        <Text style={styles.name}>RunFit 用户</Text>
        <Text style={styles.slogan}>健康生活，从运动开始</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>数据看板</Text>
        <Text style={styles.hint}>📊 未来可扩展：周/月度运动报告</Text>
        <Text style={styles.hint}>☁️ 云同步功能规划中</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>关于 RunFit</Text>
        <Text style={styles.aboutText}>RunFit 是一款本地优先的运动记录 App，</Text>
        <Text style={styles.aboutText}>数据保存在本机，随时可上云。</Text>
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>隐私说明</Text>
        <Text style={styles.aboutText}>所有运动数据仅存储在您的设备本地。</Text>
        <Text style={styles.aboutText}>云同步功能上线后，数据传输采用加密方式。</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#4CAF50', paddingVertical: 32, paddingHorizontal: 20, alignItems: 'center' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 36 },
  name: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  slogan: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  card: { backgroundColor: '#fff', margin: 16, marginBottom: 0, borderRadius: 12, padding: 16, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  hint: { fontSize: 13, color: '#888', marginBottom: 6 },
  aboutText: { fontSize: 13, color: '#666', marginBottom: 4, lineHeight: 20 },
  versionText: { fontSize: 12, color: '#bbb', marginTop: 8 },
});
