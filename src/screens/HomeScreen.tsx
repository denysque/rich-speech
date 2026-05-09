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
  { to: '/describe', num: '01', label: 'Описание',       hint: 'Опиши предмет, человека или место за минуту',  ready: false },
  { to: '/narrate',  num: '02', label: 'Повествование',  hint: 'Расскажи историю — что было, что стало',        ready: false },
  { to: '/reason',   num: '03', label: 'Рассуждение',    hint: 'Объясни, докажи, обоснуй позицию',              ready: false },
];

export default function HomeScreen() {
  return (
    <div className="screen">
      <header className="title-block">
        <h1>Rich Speech</h1>
        <p>Тренажёры устной речи</p>
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

      <footer className="footer-promo">
        <div>made by Denis Telychko · 2026</div>
      </footer>
    </div>
  );
}
