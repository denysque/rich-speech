import quotesData from '@/data/quotes.json';

export interface Quote {
  text: string;
  author: string;
}

export const QUOTES: Quote[] = quotesData as Quote[];

/** День года 1..366 — детерминированный индекс цитаты дня. */
function dayOfYear(d = new Date()): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start;
  return Math.floor(diff / 86400000);
}

export function getDailyQuoteIdx(): number {
  return dayOfYear() % QUOTES.length;
}

export function getDailyQuote(): Quote {
  return QUOTES[getDailyQuoteIdx()];
}

export function pickRandomQuoteIdx(excludeIdx?: number): number {
  if (QUOTES.length <= 1) return 0;
  let i = Math.floor(Math.random() * QUOTES.length);
  if (excludeIdx !== undefined && i === excludeIdx) {
    i = (i + 1) % QUOTES.length;
  }
  return i;
}
