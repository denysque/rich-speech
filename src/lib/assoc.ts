import associationsData from '@/data/associations.json';

export const ASSOCIATIONS: Record<string, string[]> = associationsData as Record<string, string[]>;
export const ASSOC_SEEDS: readonly string[] = Object.keys(ASSOCIATIONS);

export type AssocDuration = 20 | 40 | 60;
export const ASSOC_DURATIONS: readonly AssocDuration[] = [20, 40, 60] as const;

export type AssocTier = 'warmup' | 'beginner' | 'normal' | 'master';

export interface AssocAttempt {
  id: string;
  ts: number;
  seed: string;
  duration: AssocDuration;
  count: number;
  countAuto: number | null;
  words: string[];
  tier: AssocTier;
}

export interface AssocGrade {
  tier: AssocTier;
  title: string;
  subtitle: string;
  support: string;
}

export interface AssocSettings {
  duration: AssocDuration;
}

export const DEFAULT_ASSOC_SETTINGS: AssocSettings = { duration: 60 };

const STORAGE = {
  history:   'rich-speech:assoc:history',
  lastSeeds: 'rich-speech:assoc:last-seeds',
  settings:  'rich-speech:assoc:settings',
} as const;

function isClient() { return typeof window !== 'undefined'; }
function load<T>(key: string, fallback: T): T {
  if (!isClient()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}
function save(key: string, value: unknown) {
  if (!isClient()) return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function pickSeed(lastSeeds: readonly string[]): string {
  const banned = new Set(lastSeeds.slice(-5));
  const pool = ASSOC_SEEDS.filter(s => !banned.has(s));
  const src = pool.length > 0 ? pool : ASSOC_SEEDS;
  return src[Math.floor(Math.random() * src.length)];
}

export function gradeAssoc(count: number, duration: AssocDuration): AssocGrade {
  // Нормализуем к темпу «слов в минуту», пороги: 5 / 11 / 18.
  // Ассоциации субъективно сложнее, чем слова на букву — пороги мягче.
  const rate = duration > 0 ? (count / duration) * 60 : 0;
  if (rate >= 18) return {
    tier: 'master', title: 'Мастер', subtitle: 'Поток ассоциаций',
    support: 'Образное мышление работает на полную. Со сцены такие связки делают речь живой — слушатель видит то, о чём ты говоришь.',
  };
  if (rate >= 11) return {
    tier: 'normal', title: 'Норм', subtitle: 'Хорошая плотность связей',
    support: 'Богатая сеть ассоциаций — это запас для импровизации. На сцене стресс сужает фокус; такие упражнения расширяют его обратно.',
  };
  if (rate >= 5) return {
    tier: 'beginner', title: 'Начальный', subtitle: 'Уже разогнался',
    support: 'Ассоциации текут, но пока медленно. Несколько попыток — и появятся неожиданные связки между далёкими понятиями.',
  };
  return {
    tier: 'warmup', title: 'Разогрев', subtitle: 'Мозг включается медленно',
    support: 'Это нормально — образное мышление не запускается мгновенно. Не оценивай ассоциации, говори всё, что приходит. Качество — потом.',
  };
}

export function getAssocHistory(): AssocAttempt[] {
  return load<AssocAttempt[]>(STORAGE.history, []);
}
export function saveAssocAttempt(a: AssocAttempt) {
  const arr = getAssocHistory();
  arr.unshift(a);
  if (arr.length > 50) arr.length = 50;
  save(STORAGE.history, arr);
}

export function getLastSeeds(): string[] {
  return load<string[]>(STORAGE.lastSeeds, []);
}
export function pushLastSeed(seed: string) {
  const arr = getLastSeeds();
  arr.push(seed);
  while (arr.length > 10) arr.shift();
  save(STORAGE.lastSeeds, arr);
}

export function getAssocSettings(): AssocSettings {
  const partial = load<Partial<AssocSettings>>(STORAGE.settings, {});
  const duration = partial.duration;
  if (duration === 20 || duration === 40 || duration === 60) {
    return { duration };
  }
  return DEFAULT_ASSOC_SETTINGS;
}
export function setAssocSettings(patch: Partial<AssocSettings>) {
  const next = { ...getAssocSettings(), ...patch };
  save(STORAGE.settings, next);
  return next;
}

/** Нормализуем «А́рбуз» → «арбуз», лишние пробелы, ё→е. */
export function normalizeAssoc(w: string): string {
  return w.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

/**
 * Возвращает подсказки, которые пользователь НЕ назвал. Сравниваем по
 * нормализованным формам. Подсказки сохраняем в оригинальном виде.
 */
export function findMissedHints(seed: string, userWords: readonly string[]): string[] {
  const hints = ASSOCIATIONS[seed] || [];
  const said = new Set(userWords.map(normalizeAssoc));
  return hints.filter(h => !said.has(normalizeAssoc(h)));
}
