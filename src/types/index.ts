export interface Set {
  id: string;
  reps: number;
  weight: number; // kg
  completed: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  sets: Set[];
}

export interface Workout {
  id: string;
  name: string;
  date: string; // ISO
  duration: number; // seconds
  exercises: Exercise[];
}
