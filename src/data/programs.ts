import { LibraryExercise } from '../types';

// Programme haut / bas sur 4 jours, en double progression : on reste à la même
// charge en ajoutant des reps jusqu'au haut de la fourchette sur toutes les
// séries, puis on monte la charge et on repart du bas de la fourchette.
// Toutes les séries s'arrêtent à 1-2 reps de l'échec.

export type SessionKey = 'upperA' | 'lowerA' | 'upperB' | 'lowerB';

export interface ProgramSession {
  key: SessionKey;
  title: string;
  focus: string;
  exercises: LibraryExercise[];
}

const UPPER_STEP = 2.5;
const LOWER_STEP = 5;
const ISO_STEP = 1;

const ex = (
  name: string,
  sets: number,
  reps: string,
  rest: number,
  increment: number,
  execution: string
): LibraryExercise => ({
  name,
  sets,
  reps,
  rest,
  increment,
  execution,
  goalSpecificTip: 'Arrête chaque série à 1-2 reps de l\'échec. Toutes les séries en haut de la fourchette : on monte la charge.',
});

export const UPPER_LOWER_4: Record<SessionKey, ProgramSession> = {
  upperA: {
    key: 'upperA',
    title: 'Haut A',
    focus: 'Pecs, dos, épaules, bras',
    exercises: [
      ex('Développé couché barre', 3, '6-10', 150, UPPER_STEP, 'Omoplates serrées, barre au bas des pecs, pousse en gardant les pieds ancrés.'),
      ex('Rowing barre', 3, '8-12', 120, UPPER_STEP, 'Buste à 45°, dos neutre, tire la barre vers le nombril.'),
      ex('Développé militaire haltères', 3, '8-12', 120, ISO_STEP * 2, 'Assis, gainé, pousse au-dessus de la tête sans cambrer.'),
      ex('Tirage vertical', 3, '8-12', 90, UPPER_STEP, 'Tire les coudes vers les hanches, poitrine vers la barre.'),
      ex('Curl biceps haltères', 2, '10-15', 60, ISO_STEP, 'Coudes fixes, descente contrôlée.'),
      ex('Extension triceps poulie', 2, '10-15', 60, UPPER_STEP, 'Coudes collés au corps, extension complète.'),
    ],
  },
  lowerA: {
    key: 'lowerA',
    title: 'Bas A',
    focus: 'Quadriceps, ischios, mollets',
    exercises: [
      ex('Squat barre', 3, '6-10', 180, LOWER_STEP, 'Pieds largeur épaules, descends sous la parallèle si ta mobilité le permet, dos neutre.'),
      ex('Soulevé de terre roumain', 3, '8-12', 150, LOWER_STEP, 'Genoux légèrement fléchis, hanches vers l\'arrière, barre près des jambes.'),
      ex('Presse à cuisses', 3, '10-15', 120, LOWER_STEP, 'Amplitude complète, ne verrouille pas les genoux en haut.'),
      ex('Leg curl', 3, '10-15', 90, UPPER_STEP, 'Contrôle la descente sur 2 secondes.'),
      ex('Mollets debout', 3, '10-15', 60, LOWER_STEP, 'Pause d\'une seconde en bas, monte haut.'),
    ],
  },
  upperB: {
    key: 'upperB',
    title: 'Haut B',
    focus: 'Pecs hauts, dos, épaules',
    exercises: [
      ex('Développé incliné haltères', 3, '8-12', 120, ISO_STEP * 2, 'Banc à 30°, descends les haltères à hauteur de poitrine.'),
      ex('Tractions', 3, '6-10', 150, UPPER_STEP, 'Prise un peu plus large que les épaules, menton au-dessus de la barre. Ajoute du lest quand c\'est facile.'),
      ex('Rowing haltère un bras', 3, '8-12', 90, ISO_STEP * 2, 'Genou sur le banc, tire l\'haltère vers la hanche.'),
      ex('Élévations latérales', 3, '12-20', 60, ISO_STEP, 'Monte jusqu\'aux épaules, coudes légèrement fléchis.'),
      ex('Dips', 3, '8-12', 90, UPPER_STEP, 'Buste penché pour les pecs, descends jusqu\'à 90° au coude.'),
    ],
  },
  lowerB: {
    key: 'lowerB',
    title: 'Bas B',
    focus: 'Chaîne arrière, fessiers, mollets',
    exercises: [
      ex('Soulevé de terre', 3, '5-8', 180, LOWER_STEP, 'Barre au-dessus du milieu du pied, dos neutre, pousse le sol.'),
      ex('Fentes bulgares', 3, '8-12', 120, ISO_STEP * 2, 'Pied arrière sur le banc, descends droit, genou avant stable.'),
      ex('Hip thrust', 3, '8-12', 120, LOWER_STEP, 'Haut du dos sur le banc, serre les fessiers en haut.'),
      ex('Leg extension', 3, '10-15', 60, UPPER_STEP, 'Pause d\'une seconde en haut.'),
      ex('Mollets assis', 3, '12-20', 60, LOWER_STEP, 'Amplitude complète, pause en bas.'),
    ],
  },
};

// Jour de la semaine (0 = dimanche, comme Date.getDay) → séance.
export type ProgramDays = Record<SessionKey, number>;

export const DEFAULT_PROGRAM_DAYS: ProgramDays = {
  upperA: 1, // lundi
  lowerA: 3, // mercredi
  upperB: 4, // jeudi (ou vendredi)
  lowerB: 6, // samedi
};

export const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export const sessionForDay = (day: number, days: ProgramDays): ProgramSession | null => {
  const key = (Object.keys(days) as SessionKey[]).find((k) => days[k] === day);
  return key ? UPPER_LOWER_4[key] : null;
};

export const nextSession = (from: number, days: ProgramDays): { session: ProgramSession; day: number } | null => {
  for (let i = 1; i <= 7; i++) {
    const d = (from + i) % 7;
    const s = sessionForDay(d, days);
    if (s) return { session: s, day: d };
  }
  return null;
};
