import { Link } from 'react-router-dom';

interface Exercise {
  to: string;
  num: string;
  label: string;
  hint: string;
  ready: boolean;
}

const EXERCISES: Exercise[] = [
  { to: '/warmup/letter', num: '01', label: 'Слова на букву',       hint: 'Минута. Назови как можно больше слов на выпавшую букву', ready: true  },
  { to: '/warmup/assoc',  num: '02', label: 'Ассоциативный ряд',    hint: 'Цепочка ассоциаций от заданного слова',                  ready: false },
];

export default function WarmupHomeScreen() {
  return (
    <div className="screen">
      <Link
        to="/"
        style={{
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontWeight: 700,
          color: 'var(--text-muted)',
          textDecoration: 'none',
          alignSelf: 'flex-start',
        }}
      >
        ← Главная
      </Link>

      <header className="title-block">
        <h1>Разминка</h1>
        <p>Гимнастика речи · 00</p>
      </header>

      <nav className="pos-list">
        {EXERCISES.map((e) => (
          <Link
            key={e.to}
            to={e.to}
            className="pos-item"
            style={{ textDecoration: 'none' }}
            aria-disabled={!e.ready || undefined}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div className="label">
                <span style={{ color: 'var(--accent)', marginRight: 14, fontFamily: 'var(--font-sans)', fontSize: 12, letterSpacing: '0.10em', fontWeight: 700 }}>
                  {e.num}
                </span>
                {e.label}
              </div>
              <div className="hint">{e.ready ? e.hint : 'В разработке'}</div>
            </div>
            <span aria-hidden style={{ fontSize: 22, color: e.ready ? 'var(--accent)' : 'var(--text-dim)', fontFamily: 'var(--font-serif)' }}>
              →
            </span>
          </Link>
        ))}
      </nav>

      <div className="grow" />
    </div>
  );
}
