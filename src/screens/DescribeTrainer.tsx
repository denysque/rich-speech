import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { pickPainting, type Painting } from '@/lib/paintings';
import {
  DESCRIBE_DURATIONS, DEFAULT_DESCRIBE_SETTINGS,
  getDescribeHistory, getDescribeSettings, setDescribeSettings,
  getLastPaintings, pushLastPainting, saveDescribeAttempt,
  type DescribeAttempt, type DescribeDuration, type DescribeSettings,
} from '@/lib/describe';
import { createTimer, type Timer, playEndBeep, vibrate } from '@/lib/timer';
import { formatDurationSec, pluralWords, countWords, formatRelativeDate } from '@/lib/format';

type Screen = 'home' | 'painting' | 'timer' | 'result';

export default function DescribeTrainer() {
  const [screen, setScreen] = useState<Screen>('home');
  const [settings, setSettingsState] = useState<DescribeSettings>(DEFAULT_DESCRIBE_SETTINGS);
  const [history, setHistory] = useState<DescribeAttempt[]>([]);

  const [painting, setPainting] = useState<Painting | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [rerollUsed, setRerollUsed] = useState(false);

  const [remainingSec, setRemainingSec] = useState<number>(60);
  const [warn, setWarn] = useState(false);
  const [description, setDescription] = useState('');

  const [resultAttempt, setResultAttempt] = useState<DescribeAttempt | null>(null);

  const timerRef = useRef<Timer | null>(null);

  useEffect(() => {
    setSettingsState(getDescribeSettings());
    setHistory(getDescribeHistory());
  }, []);

  const drawPainting = useCallback(() => {
    setRerollUsed(false);
    setImgLoaded(false);
    setDescription('');
    const p = pickPainting(getLastPaintings());
    setPainting(p);
    pushLastPainting(p.id);
    setScreen('painting');
  }, []);

  const handleReroll = useCallback(() => {
    if (rerollUsed) return;
    setRerollUsed(true);
    setImgLoaded(false);
    const p = pickPainting(getLastPaintings());
    setPainting(p);
    pushLastPainting(p.id);
  }, [rerollUsed]);

  const finishAttempt = useCallback(
    (viaStop: boolean) => {
      if (timerRef.current) { timerRef.current.stop(); timerRef.current = null; }
      setWarn(false);
      if (!viaStop) {
        if (settings.soundOn) playEndBeep();
        vibrate(200);
      }
      if (!painting) { setScreen('home'); return; }
      const desc = description.trim();
      const a: DescribeAttempt = {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : 'a_' + Date.now(),
        ts: Date.now(),
        paintingId: painting.id,
        paintingTitle: painting.title,
        paintingArtist: painting.artist,
        duration: settings.duration,
        description: desc,
        wordCount: countWords(desc),
      };
      saveDescribeAttempt(a);
      setHistory(getDescribeHistory());
      setResultAttempt(a);
      setScreen('result');
    },
    [painting, description, settings.duration, settings.soundOn],
  );

  const startTimer = useCallback(() => {
    if (!painting) return;
    setScreen('timer');
    setRemainingSec(settings.duration);
    setWarn(false);
    setDescription('');

    const t = createTimer(
      settings.duration * 1000,
      (remainingMs) => {
        setRemainingSec(Math.ceil(remainingMs / 1000));
        setWarn(remainingMs <= 10000 && remainingMs > 0);
      },
      () => finishAttempt(false),
    );
    t.start();
    timerRef.current = t;
  }, [painting, settings.duration, finishAttempt]);

  const resetSession = useCallback(() => {
    if (timerRef.current) { timerRef.current.stop(); timerRef.current = null; }
    setWarn(false);
    setDescription('');
    setPainting(null);
    setRerollUsed(false);
    setScreen('home');
  }, []);

  const handleResetClick = () => {
    if (screen === 'timer') {
      if (!confirm('Прервать описание? Прогресс не сохранится.')) return;
    }
    resetSession();
  };

  const changeDuration = (d: DescribeDuration) => {
    setSettingsState(setDescribeSettings({ duration: d }));
  };

  const showResetBtn = screen === 'painting' || screen === 'timer';

  return (
    <>
      {showResetBtn && (
        <button className="reset-btn" type="button" aria-label="Прервать и вернуться" onClick={handleResetClick}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      )}

      {/* HOME */}
      {screen === 'home' && (
        <section className="screen">
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
            <h1>Опиши</h1>
            <p>Тренажёр / 01 · Описание</p>
          </header>

          <div className="hero">
            Выпадает шедевр живописи — у тебя <strong>{formatDurationSec(settings.duration)}</strong>, чтобы рассказать,
            что ты видишь. Композиция, цвет, эмоция, сюжет, детали. Описание — самый прямой способ
            растянуть словарный запас и говорить дольше связно.
          </div>

          <div className="step-label" style={{ marginTop: 4 }}>
            <span className="step-num">1</span>
            <span>Длительность</span>
          </div>
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            {DESCRIBE_DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                className={settings.duration === d ? 'active' : ''}
                onClick={() => changeDuration(d)}
              >
                {d} с
              </button>
            ))}
          </div>

          <button className="btn btn-primary btn-block" type="button" onClick={drawPainting}>Начать</button>

          {history.length > 0 && (
            <div className="history-block">
              <div className="history-title">История</div>
              {history.slice(0, 5).map((a) => (
                <div key={a.id} className="history-item">
                  <span>
                    <strong>{a.wordCount}</strong>{' '}
                    {pluralWords(a.wordCount)} · {a.paintingTitle} · {formatDurationSec(a.duration)}
                  </span>
                  <span className="date">{formatRelativeDate(a.ts)}</span>
                </div>
              ))}
            </div>
          )}

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
        </section>
      )}

      {/* PAINTING preview */}
      {screen === 'painting' && painting && (
        <section className="screen">
          <div className="painting-stage">
            {!imgLoaded && (
              <div className="painting-loader">
                <span className="spin" /><span>загружаю</span>
              </div>
            )}
            <div className="painting-frame" style={{ display: imgLoaded ? 'flex' : 'none' }}>
              <img
                src={painting.url}
                alt={`${painting.title} — ${painting.artist}`}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgLoaded(true)}
              />
            </div>
            <div className="painting-meta">
              <h2 className="title">{painting.title}</h2>
              <div className="artist">{painting.artist}</div>
              <div className="year">{painting.year}</div>
            </div>
          </div>
          <div className="btn-row">
            <button className="btn" type="button" disabled={rerollUsed} onClick={handleReroll}>Перебросить</button>
            <button className="btn btn-primary" type="button" onClick={startTimer}>Описать · {settings.duration}с</button>
          </div>
        </section>
      )}

      {/* TIMER */}
      {screen === 'timer' && painting && (
        <section className="screen">
          <div className="timer-meta">
            <span><span className="letter">{painting.title}</span></span>
            <span>{painting.artist}</span>
          </div>
          <div className="timer-thumb">
            <img src={painting.url} alt="" />
          </div>
          <div className={'timer-digits' + (warn ? ' warn' : '')} style={{ fontSize: '22vh' }}>
            {remainingSec}
          </div>
          <textarea
            className="description-area"
            placeholder="Описывай вслух — а если хочешь, дублируй здесь. Композиция, цвет, эмоция, детали."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            autoFocus
          />
          <div className="description-hint">текст сохранится в попытке · главное — говорить вслух</div>
          <button className="btn btn-block" type="button" onClick={() => finishAttempt(true)}>Стоп</button>
        </section>
      )}

      {/* RESULT */}
      {screen === 'result' && resultAttempt && (
        <ResultView
          attempt={resultAttempt}
          onHome={() => setScreen('home')}
          onAgain={drawPainting}
        />
      )}
    </>
  );
}

/* ============ Result subscreen ============ */
function ResultView({
  attempt, onHome, onAgain,
}: {
  attempt: DescribeAttempt;
  onHome: () => void;
  onAgain: () => void;
}) {
  const wpm = attempt.wordCount > 0 ? Math.round((attempt.wordCount / attempt.duration) * 60) : 0;

  return (
    <section className="screen">
      <div className="count-head">
        <div>результат · {attempt.paintingArtist}</div>
        <h2>{attempt.paintingTitle}</h2>
      </div>

      <div className="result-stats">
        <div className="result-stat">
          <div className="num">{attempt.wordCount}</div>
          <div className="lbl">{pluralWords(attempt.wordCount)}</div>
        </div>
        <div className="result-stat">
          <div className="num">{attempt.duration}</div>
          <div className="lbl">секунд</div>
        </div>
        <div className="result-stat">
          <div className="num">{wpm}</div>
          <div className="lbl">слов/мин</div>
        </div>
      </div>

      <div className="step-label">Что было записано</div>
      {attempt.description ? (
        <div className="result-text">{attempt.description}</div>
      ) : (
        <div className="result-text empty">Ничего не записал — это нормально, ты тренировал устную речь.</div>
      )}

      <div className="grow" />

      <div className="btn-row">
        <button className="btn" type="button" onClick={onHome}>На главную</button>
        <button className="btn btn-primary" type="button" onClick={onAgain}>Ещё раз</button>
      </div>
    </section>
  );
}
