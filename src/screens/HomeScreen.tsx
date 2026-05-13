import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QUOTES, getDailyQuoteIdx, pickRandomQuoteIdx } from '@/lib/quotes';
import { computeStreak, pluralDays, type StreakInfo } from '@/lib/streak';
import { getSettings, setSettings } from '@/lib/storage';
import { THEME_LABEL, type Theme } from '@/lib/constants';

const THEME_CYCLE: Theme[] = ['auto', 'light', 'dark'];

function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'light') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v1.5M12 19.5V21M4.22 4.22l1.06 1.06M18.72 18.72l1.06 1.06M3 12h1.5M19.5 12H21M4.22 19.78l1.06-1.06M18.72 5.28l1.06-1.06" />
      </svg>
    );
  }
  if (theme === 'dark') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20.5 14.2A8 8 0 0 1 9.8 3.5a8 8 0 1 0 10.7 10.7Z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

interface Section {
  to: string;
  num: string;
  label: string;
  hint: string;
  ready: boolean;
}

const SECTIONS: Section[] = [
  { to: '/warmup',   num: '00', label: 'Разминка',       hint: 'Гимнастика речи перед основными упражнениями', ready: true  },
  { to: '/describe', num: '01', label: 'Описание',       hint: 'Опиши шедевр живописи — композиция, цвет, эмоция', ready: true  },
  { to: '/narrate',  num: '02', label: 'Повествование',  hint: 'Расскажи историю про слово — простой или с прилагательным', ready: true  },
  { to: '/reason',   num: '03', label: 'Рассуждение',    hint: 'Отстаивай позицию по спорному тезису — с обязательным аргументом или без', ready: true  },
];

export default function HomeScreen() {
  const [quoteIdx, setQuoteIdx] = useState<number>(() => getDailyQuoteIdx());
  const quote = QUOTES[quoteIdx];
  const refreshQuote = () => setQuoteIdx((prev) => pickRandomQuoteIdx(prev));

  // Серия — считаем после монтирования (localStorage есть только на клиенте).
  const [streak, setStreak] = useState<StreakInfo>({ current: 0, todayDone: false, totalAttempts: 0, totalDays: 0 });
  useEffect(() => { setStreak(computeStreak()); }, []);

  const [theme, setThemeState] = useState<Theme>('auto');
  useEffect(() => { setThemeState(getSettings().theme); }, []);
  const cycleTheme = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];
    setSettings({ theme: next });
    applyTheme(next);
    setThemeState(next);
  };

  const streakStatus =
    streak.current === 0
      ? 'Тренируйся хотя бы раз в день — серия пойдёт.'
      : streak.todayDone
        ? 'Сегодня тренировался. Так держать.'
        : 'Не сорви сегодня — иначе серия обнулится.';
  const streakMod =
    streak.current === 0 ? 'streak-empty' : streak.todayDone ? 'streak-active' : 'streak-warn';

  return (
    <div className="screen">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="icon-btn"
          type="button"
          onClick={cycleTheme}
          aria-label={`Тема: ${THEME_LABEL[theme]}. Переключить.`}
          title={`Тема: ${THEME_LABEL[theme]}`}
        >
          <ThemeIcon theme={theme} />
        </button>
      </div>

      <header className="title-block">
        <h1>Rich Speech</h1>
        <p>Тренажёр устной речи</p>
      </header>

      <div className="hero">
        Шесть упражнений на разные жанры устной речи — от беглости и ассоциаций до
        связного повествования и аргументации. Цель — <strong>не идеально, а беглее</strong>.
        Все упражнения распознают речь автоматически, считают темп и дают грейд.
      </div>

      <section className={`streak-badge ${streakMod}`} aria-label="Серия дней подряд">
        <div className="streak-num">{streak.current}</div>
        <div className="streak-meta">
          <div className="streak-label">
            {streak.current === 0 ? 'Серия' : `${pluralDays(streak.current)} подряд`}
          </div>
          <div className="streak-status">{streakStatus}</div>
        </div>
      </section>

      <section className="instructions-block">
        <div className="heading">Как пользоваться</div>
        <ol>
          <li>Начни с <strong>разминки</strong> — она запускает речевой аппарат на 1–2 минуты.</li>
          <li>Выбери основной раздел — описание, повествование или рассуждение.</li>
          <li>Настрой уровень и длительность (20 / 40 / 60 секунд) — жми «Начать».</li>
          <li>Говори вслух в микрофон — на результате увидишь темп слов в минуту и грейд.</li>
        </ol>
      </section>

      <nav className="pos-list">
        {SECTIONS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="pos-item"
            style={{ textDecoration: 'none' }}
            aria-disabled={!s.ready || undefined}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div className="label">
                <span style={{ color: 'var(--accent)', marginRight: 14, fontFamily: 'var(--font-sans)', fontSize: 12, letterSpacing: '0.10em', fontWeight: 700 }}>
                  {s.num}
                </span>
                {s.label}
              </div>
              <div className="hint">{s.ready ? s.hint : 'В разработке'}</div>
            </div>
            <span aria-hidden style={{ fontSize: 22, color: s.ready ? 'var(--accent)' : 'var(--text-dim)', fontFamily: 'var(--font-serif)' }}>
              →
            </span>
          </Link>
        ))}
      </nav>

      <section className="quote-block">
        <div className="heading">
          <span>Цитата дня</span>
          <button type="button" className="refresh" onClick={refreshQuote} aria-label="Другая цитата">
            ↻
          </button>
        </div>
        <blockquote>«{quote.text}»</blockquote>
        <div className="attribution">{quote.author}</div>
      </section>

      <div className="grow" />

      <footer className="footer-promo has-brand">
        <img className="brand-mark" src="/logo-tb.png" alt="" aria-hidden />
        <a href="https://t.me/tellychko" target="_blank" rel="noopener" aria-label="Telegram автора">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M21.945 4.36L18.79 19.21c-.24 1.05-.86 1.31-1.74.81l-4.81-3.55-2.32 2.23c-.26.26-.47.47-.96.47l.34-4.86 8.84-7.99c.39-.34-.08-.53-.6-.19L7.62 12.99 2.82 11.5c-1.04-.32-1.06-1.04.22-1.54l18.74-7.22c.87-.32 1.63.2 1.36 1.62z"/>
          </svg>
          <span>by @tellychko</span>
        </a>
      </footer>
    </div>
  );
}
