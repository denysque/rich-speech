import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  NARRATE_DURATIONS, NARRATE_LEVELS, NARRATE_LEVEL_LABEL, DEFAULT_NARRATE_SETTINGS,
  composePrompt, gradeNarrate,
  getNarrateHistory, getNarrateSettings, setNarrateSettings,
  getLastNouns, pushLastNoun, saveNarrateAttempt,
  pickNoun, pickAdjective,
  type NarrateAttempt, type NarrateDuration, type NarrateGrade, type NarrateLevel, type NarrateSettings,
} from '@/lib/narrate';
import { createTimer, type Timer, playEndBeep, vibrate } from '@/lib/timer';
import { createTranscriptRecognizer, ensureMicPermission, getSR, type Recognizer } from '@/lib/recognizer';
import { formatDurationSec, pluralWords, countWords, formatRelativeDate } from '@/lib/format';

type Screen = 'home' | 'draw' | 'timer' | 'result';

export default function NarrateTrainer() {
  const [screen, setScreen] = useState<Screen>('home');
  const [settings, setSettingsState] = useState<NarrateSettings>(DEFAULT_NARRATE_SETTINGS);
  const [history, setHistory] = useState<NarrateAttempt[]>([]);

  const [noun, setNoun] = useState<string>('');
  const [adj, setAdj] = useState<string | null>(null);

  const [remainingSec, setRemainingSec] = useState<number>(60);
  const [warn, setWarn] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceMode, setVoiceMode] = useState(false);

  const [resultAttempt, setResultAttempt] = useState<NarrateAttempt | null>(null);

  const timerRef = useRef<Timer | null>(null);
  const recognizerRef = useRef<Recognizer | null>(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    setSettingsState(getNarrateSettings());
    setHistory(getNarrateHistory());
  }, []);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  const drawPrompt = useCallback(() => {
    const last = getLastNouns();
    const n = pickNoun(last);
    setNoun(n);
    setAdj(settings.level === 'adj' ? pickAdjective() : null);
    setTranscript('');
    setScreen('draw');
  }, [settings.level]);

  const reroll = useCallback(() => {
    const last = [...getLastNouns(), noun];
    const n = pickNoun(last);
    setNoun(n);
    setAdj(settings.level === 'adj' ? pickAdjective() : null);
  }, [noun, settings.level]);

  const finishAttempt = useCallback(
    (viaStop: boolean) => {
      if (timerRef.current) { timerRef.current.stop(); timerRef.current = null; }
      recognizerRef.current?.stop();
      recognizerRef.current = null;
      setWarn(false);

      if (!viaStop) {
        playEndBeep();
        vibrate(180);
      }
      const text = transcriptRef.current.trim();
      const prompt = composePrompt(noun, adj);
      const wc = countWords(text);
      const tier = gradeNarrate(wc, settings.duration).tier;
      const att: NarrateAttempt = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'n_' + Date.now(),
        ts: Date.now(),
        prompt,
        noun,
        adj,
        duration: settings.duration,
        wordCount: wc,
        transcript: text,
        tier,
      };
      saveNarrateAttempt(att);
      setHistory(getNarrateHistory());
      setResultAttempt(att);
      setScreen('result');
    },
    [noun, adj, settings.duration],
  );

  const startTimer = useCallback(async () => {
    pushLastNoun(noun);
    setTranscript('');
    setRemainingSec(settings.duration);
    setWarn(false);
    setVoiceMode(false);
    setScreen('timer');

    // Распознавание речи
    if (getSR()) {
      const ok = await ensureMicPermission();
      if (ok) {
        const rec = createTranscriptRecognizer((t) => setTranscript(t));
        if (rec) {
          recognizerRef.current = rec;
          if (rec.start()) setVoiceMode(true);
        }
      }
    }

    const t = createTimer(
      settings.duration * 1000,
      (remainingMs) => {
        const sec = Math.ceil(remainingMs / 1000);
        setRemainingSec(sec);
        setWarn(remainingMs <= 10000 && remainingMs > 0);
      },
      () => finishAttempt(false),
    );
    t.start();
    timerRef.current = t;
  }, [noun, settings.duration, finishAttempt]);

  const resetSession = useCallback(() => {
    if (timerRef.current) { timerRef.current.stop(); timerRef.current = null; }
    recognizerRef.current?.stop();
    recognizerRef.current = null;
    setWarn(false);
    setTranscript('');
    setNoun('');
    setAdj(null);
    setScreen('home');
    setResultAttempt(null);
  }, []);

  const handleResetClick = () => {
    if (screen === 'timer') {
      if (!confirm('Прервать рассказ? Прогресс не сохранится.')) return;
    }
    resetSession();
  };

  const changeDuration = (d: NarrateDuration) => {
    setSettingsState(setNarrateSettings({ duration: d }));
  };

  const changeLevel = (l: NarrateLevel) => {
    setSettingsState(setNarrateSettings({ level: l }));
  };

  const showResetBtn = screen === 'draw' || screen === 'timer';
  const prompt = composePrompt(noun, adj);

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
              fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
              fontWeight: 700, color: 'var(--text-muted)', textDecoration: 'none',
              alignSelf: 'flex-start',
            }}
          >
            ← Главная
          </Link>

          <header className="title-block">
            <h1>Повествование</h1>
            <p>Тренажёр / 02 · История</p>
          </header>

          <div className="hero">
            Выпадает существительное — за <strong>{formatDurationSec(settings.duration)}</strong> расскажи историю про него.
            На сложном уровне добавляется прилагательное и промт оживает: «<strong>кислый дождь</strong>», «<strong>забытый ключ</strong>», «<strong>проклятая лошадь</strong>». Главное — не останавливайся.
          </div>

          <div className="step-label" style={{ marginTop: 4 }}>
            <span className="step-num">1</span>
            <span>Уровень</span>
          </div>
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            {NARRATE_LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                className={settings.level === l ? 'active' : ''}
                onClick={() => changeLevel(l)}
              >
                {NARRATE_LEVEL_LABEL[l]}
              </button>
            ))}
          </div>

          <div className="step-label" style={{ marginTop: 4 }}>
            <span className="step-num">2</span>
            <span>Длительность</span>
          </div>
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            {NARRATE_DURATIONS.map((d) => (
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

          <button className="btn btn-primary btn-block" type="button" onClick={drawPrompt}>Начать</button>

          {history.length > 0 && (
            <div className="history-block">
              <div className="history-title">История</div>
              {history.slice(0, 5).map((a) => (
                <div key={a.id} className="history-item">
                  <span>
                    <strong>{a.wordCount}</strong>{' '}
                    {pluralWords(a.wordCount)} · {a.prompt} · {formatDurationSec(a.duration)}
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

      {/* DRAW */}
      {screen === 'draw' && (
        <section className="screen">
          <div className="draw-pos">тема · {settings.duration}&nbsp;секунд</div>
          <div className="letter-stage">
            <div
              className="letter-big"
              style={{
                fontSize: adj ? 'clamp(36px, 11vw, 80px)' : 'clamp(48px, 14vw, 96px)',
                lineHeight: 1.05,
                textIndent: 0,
              }}
            >
              {prompt}
            </div>
            <div className="draw-hint">не редактируй на ходу</div>
          </div>
          <div className="draw-context">
            <strong>Совет</strong> · сюжет важнее точных слов. Завязка → событие → переломный момент.
            Можно начинать с «жил-был…» или «однажды…».
          </div>
          <div className="btn-row">
            <button className="btn" type="button" onClick={reroll}>Перебросить</button>
            <button className="btn btn-primary" type="button" onClick={startTimer}>Поехали</button>
          </div>
        </section>
      )}

      {/* TIMER */}
      {screen === 'timer' && (
        <section className="screen">
          <div className="timer-meta">
            <span><span className="letter">{prompt}</span></span>
            <span>{formatDurationSec(settings.duration)}</span>
          </div>
          <div className="timer-stage" style={{ gap: 16 }}>
            <div className={'timer-digits' + (warn ? ' warn' : '')} style={{ fontSize: '22vh' }}>
              {remainingSec}
            </div>
            <div className="description-area" style={{ minHeight: '12vh', maxHeight: '22vh', overflowY: 'auto' }} aria-live="polite">
              {transcript || (
                <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>
                  {voiceMode ? 'распознаётся речь…' : 'голос недоступен — рассказывай вслух, текст не запишется'}
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-block" type="button" onClick={() => finishAttempt(true)}>Стоп</button>
        </section>
      )}

      {/* RESULT */}
      {screen === 'result' && resultAttempt && (
        <ResultView
          attempt={resultAttempt}
          onHome={() => { resetSession(); }}
          onAgain={() => { resetSession(); drawPrompt(); }}
        />
      )}
    </>
  );
}

function ResultView({
  attempt, onHome, onAgain,
}: {
  attempt: NarrateAttempt;
  onHome: () => void;
  onAgain: () => void;
}) {
  const grade: NarrateGrade = gradeNarrate(attempt.wordCount, attempt.duration);
  const wpm = attempt.wordCount > 0 ? Math.round((attempt.wordCount / attempt.duration) * 60) : 0;

  return (
    <section className="screen">
      <div className="count-head">
        <div>результат · {attempt.prompt}</div>
        <h2>Итог</h2>
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

      <div className="result-stage" style={{ padding: '16px 0' }}>
        <div className={`result-tier tier-${grade.tier}`}>{grade.title}</div>
        <div className="result-subtitle">{grade.subtitle}</div>
        <div className="result-support">{grade.support}</div>
      </div>

      {attempt.transcript && (
        <>
          <div className="step-label">Что было сказано</div>
          <div className="result-text">{attempt.transcript}</div>
        </>
      )}

      <div className="grow" />

      <div className="btn-row">
        <button className="btn" type="button" onClick={onHome}>На главную</button>
        <button className="btn btn-primary" type="button" onClick={onAgain}>Ещё раз</button>
      </div>
    </section>
  );
}
