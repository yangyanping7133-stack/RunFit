import * as SQLite from 'expo-sqlite';

export interface Workout {
  id: number;
  type: 'running' | 'walking' | 'cycling' | 'strength' | 'other';
  duration: number; // in seconds
  distance: number | null; // in meters, nullable for strength training
  calories: number;
  date: string; // ISO date string YYYY-MM-DD
  startTime: string; // ISO datetime
  endTime: string; // ISO datetime
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

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('runfit.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      duration INTEGER NOT NULL,
      distance REAL,
      calories INTEGER NOT NULL,
      date TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      steps INTEGER,
      avgHeartRate INTEGER,
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);
  `);
  return db;
}

export async function insertWorkout(workout: WorkoutInsert): Promise<number> {
  const database = await getDatabase();
  const result = await database.runAsync(
    `INSERT INTO workouts (type, duration, distance, calories, date, startTime, endTime, steps, avgHeartRate, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      workout.type,
      workout.duration,
      workout.distance,
      workout.calories,
      workout.date,
      workout.startTime,
      workout.endTime,
      workout.steps,
      workout.avgHeartRate,
      workout.notes,
    ]
  );
  return result.lastInsertRowId;
}

export async function getWorkoutsByDate(date: string): Promise<Workout[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Workout>(
    'SELECT * FROM workouts WHERE date = ? ORDER BY startTime DESC',
    [date]
  );
  return rows;
}

export async function getAllWorkouts(): Promise<Workout[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Workout>(
    'SELECT * FROM workouts ORDER BY date DESC, startTime DESC'
  );
  return rows;
}

export async function searchWorkouts(keyword: string): Promise<Workout[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Workout>(
    `SELECT * FROM workouts 
     WHERE notes LIKE ? OR type LIKE ?
     ORDER BY date DESC, startTime DESC`,
    [`%${keyword}%`, `%${keyword}%`]
  );
  return rows;
}

export async function getWorkoutStats(date: string): Promise<{
  totalDuration: number;
  totalDistance: number;
  totalCalories: number;
  totalSteps: number;
  workoutCount: number;
}> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    totalDuration: number;
    totalDistance: number;
    totalCalories: number;
    totalSteps: number;
    workoutCount: number;
  }>(
    `SELECT 
       COALESCE(SUM(duration), 0) as totalDuration,
       COALESCE(SUM(distance), 0) as totalDistance,
       COALESCE(SUM(calories), 0) as totalCalories,
       COALESCE(SUM(steps), 0) as totalSteps,
       COUNT(*) as workoutCount
     FROM workouts WHERE date = ?`,
    [date]
  );
  return row || { totalDuration: 0, totalDistance: 0, totalCalories: 0, totalSteps: 0, workoutCount: 0 };
}

export async function deleteWorkout(id: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM workouts WHERE id = ?', [id]);
}
