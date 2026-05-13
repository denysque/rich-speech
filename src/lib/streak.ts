/**
 * Серия (streak) — количество подряд идущих дней, в которые пользователь
 * сделал хотя бы одну попытку в любом тренажёре. Считаем по таймстемпам
 * из всех пяти history-ключей localStorage.
 */

const HISTORY_KEYS = [
  'speech-trainer:history',     // LetterTrainer (унаследовано от родителя)
  'rich-speech:assoc:history',
  'rich-speech:describe:history',
  'rich-speech:narrate:history',
  'rich-speech:reason:history',
] as const;

export interface StreakInfo {
  current: number;       // дней подряд (с учётом «сегодня или вчера»)
  todayDone: boolean;    // тренировался ли сегодня
  totalAttempts: number; // всего попыток за всё время
  totalDays: number;     // в скольких разных днях вообще тренировался
}

function isClient() { return typeof window !== 'undefined'; }

function readAllTimestamps(): number[] {
  if (!isClient()) return [];
  const out: number[] = [];
  for (const key of HISTORY_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const arr = JSON.parse(raw) as Array<{ ts?: number }>;
      if (!Array.isArray(arr)) continue;
      for (const a of arr) {
        if (typeof a?.ts === 'number' && Number.isFinite(a.ts)) out.push(a.ts);
      }
    } catch {}
  }
  return out;
}

function dateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftDays(date: Date, by: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + by);
  return d;
}

export function computeStreak(now: Date = new Date()): StreakInfo {
  const timestamps = readAllTimestamps();
  if (timestamps.length === 0) {
    return { current: 0, todayDone: false, totalAttempts: 0, totalDays: 0 };
  }
  const days = new Set(timestamps.map(dateKey));
  const today = dateKey(now.getTime());
  const todayDone = days.has(today);

  // Старт обхода: сегодня (если есть) или вчера (если есть, но сегодня нет).
  // Если ни сегодня ни вчера — серия порвана.
  let cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  if (!todayDone) {
    cursor = shiftDays(cursor, -1);
    if (!days.has(dateKey(cursor.getTime()))) {
      return { current: 0, todayDone: false, totalAttempts: timestamps.length, totalDays: days.size };
    }
  }

  let count = 0;
  while (days.has(dateKey(cursor.getTime()))) {
    count++;
    cursor = shiftDays(cursor, -1);
  }
  return { current: count, todayDone, totalAttempts: timestamps.length, totalDays: days.size };
}

export function pluralDays(n: number): string {
  const last = n % 10, last2 = n % 100;
  if (last2 >= 11 && last2 <= 14) return 'дней';
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дня';
  return 'дней';
}
