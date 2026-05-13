import paintingsData from '@/data/paintings.json';

export interface PaintingRaw {
  id: string;
  title: string;
  artist: string;
  year: string;
  file: string;   // имя файла на Wikimedia Commons
}

export interface Painting extends PaintingRaw {
  url: string;       // полный URL для <img>, через Special:FilePath (стабильный redirect)
  thumbUrl: string;  // уменьшенный для превью
}

const PAINTINGS_RAW = paintingsData as PaintingRaw[];

function buildUrl(file: string, width: number) {
  // Special:FilePath возвращает 302 на актуальный upload.wikimedia.org URL —
  // выдержит будущие переименования и не требует поддерживать список вручную.
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
}

export const PAINTINGS: Painting[] = PAINTINGS_RAW.map((p) => ({
  ...p,
  url:      buildUrl(p.file, 1280),
  thumbUrl: buildUrl(p.file, 480),
}));

export function pickPainting(lastIds: readonly string[]): Painting {
  const blocked = new Set(lastIds || []);
  const pool = PAINTINGS.filter((p) => !blocked.has(p.id));
  const arr = pool.length ? pool : PAINTINGS;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function findPainting(id: string): Painting | undefined {
  return PAINTINGS.find((p) => p.id === id);
}
