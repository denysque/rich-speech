import { Link } from 'react-router-dom';

interface Props {
  title: string;
  subtitle: string;
  backTo: string;
}

export default function PlaceholderScreen({ title, subtitle, backTo }: Props) {
  return (
    <div className="screen">
      <Link
        to={backTo}
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
        ← Назад
      </Link>

      <header className="title-block">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>

      <div className="hero">
        <p style={{ margin: 0 }}>
          <strong>В разработке.</strong> Это упражнение появится в одном из следующих обновлений.
        </p>
      </div>

      <div className="grow" />
    </div>
  );
}
