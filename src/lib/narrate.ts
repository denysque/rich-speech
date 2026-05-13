import { ASSOC_SEEDS } from '@/lib/assoc';

/* ============ Seed pool ============ */
// Существительные берём из словаря ассоциаций — они уже отобраны как
// конкретные и образные.
export const NARRATE_NOUNS: readonly string[] = ASSOC_SEEDS;

/* ============ Adjectives ============ */
// ~60 «универсальных» прилагательных в мужском роде. Они работают с
// большинством существительных и не уносят промт в абсурд.
export const NARRATE_ADJECTIVES: readonly string[] = [
  // цвет
  'красный', 'синий', 'жёлтый', 'чёрный', 'белый', 'зелёный', 'рыжий', 'серый', 'золотой', 'серебряный',
  // температура
  'горячий', 'холодный', 'тёплый', 'ледяной', 'кипящий',
  // тактильное / состояние
  'мокрый', 'сухой', 'шершавый', 'гладкий', 'мягкий', 'твёрдый', 'тяжёлый',
  // возраст / время существования
  'старый', 'древний', 'забытый', 'потерянный', 'новый', 'седой',
  // размер
  'огромный', 'крошечный', 'бесконечный', 'гигантский',
  // настроение / атмосфера
  'грустный', 'странный', 'тихий', 'шумный', 'безмолвный', 'счастливый', 'мрачный', 'спокойный',
  // вкус
  'сладкий', 'кислый', 'горький', 'солёный', 'пряный',
  // магия / фантазия
  'священный', 'проклятый', 'волшебный', 'призрачный', 'заколдованный',
  // время года / суток
  'ночной', 'утренний', 'вечерний', 'зимний', 'летний', 'осенний',
  // свет
  'сияющий', 'тёмный', 'светлый',
] as const;

/* ============ Gender heuristic + adj inflection ============ */
type Gender = 'm' | 'f' | 'n' | 'pl';

// Исключения для русских существительных, где окончание не выдаёт род
// очевидно (главным образом на -ь и pluralia tantum).
const GENDER_OVERRIDES: Record<string, Gender> = {
  'часы': 'pl',
  'дверь': 'f',
  'площадь': 'f',
  'лошадь': 'f',
  'тетрадь': 'f',
  'ночь': 'f',
};

function inferGender(noun: string): Gender {
  const w = noun.toLowerCase();
  if (GENDER_OVERRIDES[w]) return GENDER_OVERRIDES[w];
  if (/[оеё]$/.test(w)) return 'n';
  if (/[аяь]$/.test(w)) return 'f';
  if (/[ыи]$/.test(w)) return 'pl'; // эвристика для pluralia tantum
  return 'm';
}

/**
 * Согласует прилагательное по роду/числу. Покрывает регулярные случаи:
 * твёрдый (-ый/-ая/-ое/-ые), мягкий (-ий/-яя/-ее/-ие), шипящий+ж/ш/щ/ч/к/г/х
 * (-ий/-ая/-ое/-ие — формально hard paradigm).
 */
export function inflectAdj(adj: string, gender: Gender): string {
  if (gender === 'm') return adj;
  const m = adj.match(/^(.+?)(ый|ий|ой)$/);
  if (!m) return adj;
  const stem = m[1];
  const ending = m[2];
  const lastStem = stem[stem.length - 1] || '';
  const isHushOrVelar = /[жшщчкгх]/.test(lastStem);
  const softParadigm = ending === 'ий' && !isHushOrVelar;

  if (gender === 'f')  return stem + (softParadigm ? 'яя' : 'ая');
  if (gender === 'n')  return stem + (softParadigm ? 'ее' : 'ое');
  if (gender === 'pl') return stem + (softParadigm || isHushOrVelar ? 'ие' : 'ые');
  return adj;
}

export function composePrompt(noun: string, adj: string | null): string {
  if (!adj) return noun;
  const g = inferGender(noun);
  return `${inflectAdj(adj, g)} ${noun}`;
}

/* ============ Settings / state ============ */
export type NarrateDuration = 20 | 40 | 60;
export const NARRATE_DURATIONS: readonly NarrateDuration[] = [20, 40, 60] as const;

export type NarrateLevel = 'simple' | 'adj';
export const NARRATE_LEVELS: readonly NarrateLevel[] = ['simple', 'adj'] as const;
export const NARRATE_LEVEL_LABEL: Record<NarrateLevel, string> = {
  simple: 'Простой',
  adj:    'С прилагательным',
};

export type NarrateTier = 'warmup' | 'beginner' | 'normal' | 'master';

export interface NarrateAttempt {
  id: string;
  ts: number;
  prompt: string;
  noun: string;
  adj: string | null;
  duration: NarrateDuration;
  wordCount: number;
  transcript: string;
  tier: NarrateTier;
}

export interface NarrateGrade {
  tier: NarrateTier;
  title: string;
  subtitle: string;
  support: string;
}

export interface NarrateSettings {
  duration: NarrateDuration;
  level: NarrateLevel;
}

export const DEFAULT_NARRATE_SETTINGS: NarrateSettings = { duration: 60, level: 'simple' };

const STORAGE = {
  history:   'rich-speech:narrate:history',
  lastNouns: 'rich-speech:narrate:last-nouns',
  settings:  'rich-speech:narrate:settings',
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

export function getNarrateSettings(): NarrateSettings {
  const partial = load<Partial<NarrateSettings>>(STORAGE.settings, {});
  const duration = partial.duration;
  const validDur: NarrateDuration =
    duration === 20 || duration === 40 || duration === 60 ? duration : 60;
  const level: NarrateLevel = partial.level === 'adj' ? 'adj' : 'simple';
  return { duration: validDur, level };
}
export function setNarrateSettings(patch: Partial<NarrateSettings>) {
  const next = { ...getNarrateSettings(), ...patch };
  save(STORAGE.settings, next);
  return next;
}

export function getNarrateHistory(): NarrateAttempt[] {
  return load<NarrateAttempt[]>(STORAGE.history, []);
}
export function saveNarrateAttempt(a: NarrateAttempt) {
  const arr = getNarrateHistory();
  arr.unshift(a);
  if (arr.length > 50) arr.length = 50;
  save(STORAGE.history, arr);
}

export function getLastNouns(): string[] {
  return load<string[]>(STORAGE.lastNouns, []);
}
export function pushLastNoun(n: string) {
  const arr = getLastNouns();
  arr.push(n);
  while (arr.length > 10) arr.shift();
  save(STORAGE.lastNouns, arr);
}

/* ============ Drawing logic ============ */
export function pickNoun(lastNouns: readonly string[]): string {
  const banned = new Set(lastNouns.slice(-5));
  const pool = NARRATE_NOUNS.filter((n) => !banned.has(n));
  const src = pool.length > 0 ? pool : NARRATE_NOUNS;
  return src[Math.floor(Math.random() * src.length)];
}

export function pickAdjective(): string {
  return NARRATE_ADJECTIVES[Math.floor(Math.random() * NARRATE_ADJECTIVES.length)];
}

/* ============ Grading ============ */
// Пороги по темпу в словах в минуту. Нормальная связная речь — 100-150 wpm.
export function gradeNarrate(wordCount: number, duration: NarrateDuration): NarrateGrade {
  const rate = duration > 0 ? (wordCount / duration) * 60 : 0;
  if (rate >= 100) return {
    tier: 'master', title: 'Мастер', subtitle: 'Свободная речь',
    support: 'Темп профессионального оратора. Связки между мыслями работают сами, без зацепок. С такой беглостью на сцене ты получаешь время думать о смысле, а не о словах.',
  };
  if (rate >= 60) return {
    tier: 'normal', title: 'Норм', subtitle: 'Уверенный поток',
    support: 'Хороший темп — звучит как обычный разговор. На сцене этого хватает для большинства форматов. Тренируй сюжетные арки: завязка → событие → переломный момент.',
  };
  if (rate >= 30) return {
    tier: 'beginner', title: 'Начальный', subtitle: 'Речь идёт, но с паузами',
    support: 'Мозг ищет слова — это нормально. Не редактируй на ходу: пусть история уходит куда уходит. Главное — не останавливаться. Перфекционизм глушит беглость.',
  };
  return {
    tier: 'warmup', title: 'Разогрев', subtitle: 'Тяжело начинать',
    support: 'Самый сложный момент — первые 5 секунд. Попробуй: "Жил-был ..." или "Однажды ..." как стартовая опора. Дальше история сама себя ведёт.',
  };
}
