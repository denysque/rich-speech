import { Link } from 'react-router-dom';

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
  return (
    <div className="screen">
      <header className="title-block">
        <h1>Rich Speech</h1>
        <p>Тренажёр устной речи</p>
      </header>

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
