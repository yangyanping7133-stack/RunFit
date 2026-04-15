import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Workout {
  id: number;
  type: 'running' | 'walking' | 'cycling' | 'strength' | 'other';
  duration: number;
  distance: number | null;
  calories: number;
  date: string;
  startTime: string;
  endTime: string;
  steps: number | null;
  avgHeartRate: number | null;
  notes: string | null;
}

export interface WorkoutInsert {
  type: Workout['type'];
  duration: number;
  distance: number | null;
  calories: number;
  date: string;
  startTime: string;
  endTime: string;
  steps: number | null;
  avgHeartRate: number | null;
  notes: string | null;
}

const STORAGE_KEY = 'runfit_workouts';

async function loadAll(): Promise<Workout[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveAll(workouts: Workout[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
}

export async function insertWorkout(workout: WorkoutInsert): Promise<number> {
  const all = await loadAll();
  const newId = all.length > 0 ? Math.max(...all.map((w) => w.id)) + 1 : 1;
  const newWorkout: Workout = { ...workout, id: newId };
  all.unshift(newWorkout);
  await saveAll(all);
  return newId;
}

export async function getWorkoutsByDate(date: string): Promise<Workout[]> {
  const all = await loadAll();
  return all.filter((w) => w.date === date);
}

export async function getAllWorkouts(): Promise<Workout[]> {
  return loadAll();
}

export async function searchWorkouts(keyword: string): Promise<Workout[]> {
  const all = await loadAll();
  const kw = keyword.toLowerCase();
  return all.filter(
    (w) =>
      w.notes?.toLowerCase().includes(kw) ||
      w.type.toLowerCase().includes(kw)
  );
}

export async function getWorkoutStats(date: string): Promise<{
  totalDuration: number;
  totalDistance: number;
  totalCalories: number;
  totalSteps: number;
  workoutCount: number;
}> {
  const byDate = await getWorkoutsByDate(date);
  return {
    totalDuration: byDate.reduce((s, w) => s + w.duration, 0),
    totalDistance: byDate.reduce((s, w) => s + (w.distance ?? 0), 0),
    totalCalories: byDate.reduce((s, w) => s + w.calories, 0),
    totalSteps: byDate.reduce((s, w) => s + (w.steps ?? 0), 0),
    workoutCount: byDate.length,
  };
}

export async function deleteWorkout(id: number): Promise<void> {
  const all = await loadAll();
  await saveAll(all.filter((w) => w.id !== id));
}
