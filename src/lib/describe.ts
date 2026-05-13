export type DescribeDuration = 20 | 40 | 60;
export const DESCRIBE_DURATIONS: readonly DescribeDuration[] = [20, 40, 60] as const;

export interface DescribeAttempt {
  id: string;
  ts: number;
  paintingId: string;
  paintingTitle: string;
  paintingArtist: string;
  duration: DescribeDuration;
  description: string;
  wordCount: number;
}

export interface DescribeSettings {
  duration: DescribeDuration;
  soundOn: boolean;
}

export const DEFAULT_DESCRIBE_SETTINGS: DescribeSettings = { duration: 60, soundOn: true };

const STORAGE = {
  history:        'rich-speech:describe:history',
  lastPaintings:  'rich-speech:describe:last-paintings',
  settings:       'rich-speech:describe:settings',
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

export function getDescribeSettings(): DescribeSettings {
  const partial = load<Partial<DescribeSettings>>(STORAGE.settings, {});
  const duration = partial.duration;
  const valid: DescribeDuration = duration === 20 || duration === 40 || duration === 60 ? duration : 60;
  return { duration: valid, soundOn: partial.soundOn !== false };
}
export function setDescribeSettings(patch: Partial<DescribeSettings>) {
  const next = { ...getDescribeSettings(), ...patch };
  save(STORAGE.settings, next);
  return next;
}

export function getLastPaintings(): string[] {
  return load<string[]>(STORAGE.lastPaintings, []);
}
export function pushLastPainting(id: string) {
  const arr = getLastPaintings();
  arr.push(id);
  while (arr.length > 5) arr.shift();
  save(STORAGE.lastPaintings, arr);
}

export function getDescribeHistory(): DescribeAttempt[] {
  return load<DescribeAttempt[]>(STORAGE.history, []);
}
export function saveDescribeAttempt(a: DescribeAttempt) {
  const arr = getDescribeHistory();
  arr.unshift(a);
  if (arr.length > 50) arr.length = 50;
  save(STORAGE.history, arr);
}
