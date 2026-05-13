import topicsData from '@/data/topics.json';

/* ============ Topic pool ============ */
export const REASON_TOPICS: readonly string[] = topicsData as string[];

/* ============ Argument types (для «сложного» режима) ============ */
export type ArgId = 'fact' | 'quote' | 'analogy' | 'experience' | 'cause-effect';

export interface ArgType {
  id: ArgId;
  label: string;        // короткая метка
  hint: string;         // одна строка-определение
  example: string;      // пример формы аргумента
}

export const ARG_TYPES: ArgType[] = [
  {
    id: 'fact',
    label: 'Факт',
    hint: 'Проверяемое утверждение о реальности',
    example: '«По данным X, доля удалённых сотрудников в 2025 году выросла на 40%».',
  },
  {
    id: 'quote',
    label: 'Цитата',
    hint: 'Слова авторитетного источника — реальные или придуманные на ходу',
    example: '«Как сказал Чехов, краткость — сестра таланта».',
  },
  {
    id: 'analogy',
    label: 'Аналогия',
    hint: 'Параллель с известной ситуацией из другой области',
    example: '«Это как чинить самолёт в воздухе — что-то получится, но риск выше».',
  },
  {
    id: 'experience',
    label: 'Личный опыт',
    hint: 'Пример из жизни — твоей или знакомого',
    example: '«В моём прошлом проекте мы пробовали такой подход и …».',
  },
  {
    id: 'cause-effect',
    label: 'Причина-следствие',
    hint: 'Логическая связка: X происходит, потому что Y',
    example: '«Если поднять цену вдвое, спрос сократится — потому что …».',
  },
];

/* ============ Settings / state ============ */
export type ReasonDuration = 20 | 40 | 60;
export const REASON_DURATIONS: readonly ReasonDuration[] = [20, 40, 60] as const;

export type ReasonLevel = 'free' | 'argument';
export const REASON_LEVELS: readonly ReasonLevel[] = ['free', 'argument'] as const;
export const REASON_LEVEL_LABEL: Record<ReasonLevel, string> = {
  free:     'Свободное',
  argument: 'С аргументом',
};

export type ReasonTier = 'warmup' | 'beginner' | 'normal' | 'master';

export interface ReasonAttempt {
  id: string;
  ts: number;
  topic: string;
  argRequired: ArgId | null;
  duration: ReasonDuration;
  wordCount: number;
  transcript: string;
  tier: ReasonTier;
}

export interface ReasonGrade {
  tier: ReasonTier;
  title: string;
  subtitle: string;
  support: string;
}

export interface ReasonSettings {
  duration: ReasonDuration;
  level: ReasonLevel;
}

export const DEFAULT_REASON_SETTINGS: ReasonSettings = { duration: 60, level: 'free' };

const STORAGE = {
  history:    'rich-speech:reason:history',
  lastTopics: 'rich-speech:reason:last-topics',
  settings:   'rich-speech:reason:settings',
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

export function getReasonSettings(): ReasonSettings {
  const partial = load<Partial<ReasonSettings>>(STORAGE.settings, {});
  const duration = partial.duration;
  const validDur: ReasonDuration =
    duration === 20 || duration === 40 || duration === 60 ? duration : 60;
  const level: ReasonLevel = partial.level === 'argument' ? 'argument' : 'free';
  return { duration: validDur, level };
}
export function setReasonSettings(patch: Partial<ReasonSettings>) {
  const next = { ...getReasonSettings(), ...patch };
  save(STORAGE.settings, next);
  return next;
}

export function getReasonHistory(): ReasonAttempt[] {
  return load<ReasonAttempt[]>(STORAGE.history, []);
}
export function saveReasonAttempt(a: ReasonAttempt) {
  const arr = getReasonHistory();
  arr.unshift(a);
  if (arr.length > 50) arr.length = 50;
  save(STORAGE.history, arr);
}

export function getLastTopics(): string[] {
  return load<string[]>(STORAGE.lastTopics, []);
}
export function pushLastTopic(t: string) {
  const arr = getLastTopics();
  arr.push(t);
  while (arr.length > 10) arr.shift();
  save(STORAGE.lastTopics, arr);
}

/* ============ Drawing ============ */
export function pickTopic(lastTopics: readonly string[]): string {
  const banned = new Set(lastTopics.slice(-5));
  const pool = REASON_TOPICS.filter((t) => !banned.has(t));
  const src = pool.length > 0 ? pool : REASON_TOPICS;
  return src[Math.floor(Math.random() * src.length)];
}

export function pickArgType(): ArgType {
  return ARG_TYPES[Math.floor(Math.random() * ARG_TYPES.length)];
}

/* ============ Grading ============ */
// Те же пороги, что и в «Повествовании» — это связная речь с тем же темпом.
export function gradeReason(wordCount: number, duration: ReasonDuration): ReasonGrade {
  const rate = duration > 0 ? (wordCount / duration) * 60 : 0;
  if (rate >= 100) return {
    tier: 'master', title: 'Мастер', subtitle: 'Аргумент держится',
    support: 'Темп оратора. Аргументация выстраивается на ходу — это редкий уровень. На сцене с такой беглостью ты слышишь себя и можешь корректировать линию рассуждения в реальном времени.',
  };
  if (rate >= 60) return {
    tier: 'normal', title: 'Норм', subtitle: 'Логика прослеживается',
    support: 'Уверенная аргументация без долгих провалов. Дальше — работай над структурой: тезис в начале, контраргумент в середине, возврат к тезису в конце.',
  };
  if (rate >= 30) return {
    tier: 'beginner', title: 'Начальный', subtitle: 'Мысль ищет слова',
    support: 'Аргументы появляются, но прерывистые. Совет — не редактируй на ходу. Пусть первая мысль будет несовершенной; вторая попытка обычно сильнее первой.',
  };
  return {
    tier: 'warmup', title: 'Разогрев', subtitle: 'Сложно начать',
    support: 'Рассуждение — самый трудный жанр устной речи. Опора в первые секунды: «Я считаю, что …, и вот три причины». Структура снимает половину тревоги.',
  };
}
