import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  REASON_DURATIONS, REASON_LEVELS, REASON_LEVEL_LABEL, DEFAULT_REASON_SETTINGS,
  ARG_TYPES,
  gradeReason, getReasonHistory, getReasonSettings, setReasonSettings,
  getLastTopics, pushLastTopic, saveReasonAttempt,
  pickTopic, pickArgType,
  type ArgType, type ReasonAttempt, type ReasonDuration, type ReasonGrade, type ReasonLevel, type ReasonSettings,
} from '@/lib/reason';
import { createTimer, type Timer, playEndBeep, vibrate } from '@/lib/timer';
import { createTranscriptRecognizer, ensureMicPermission, getSR, type Recognizer } from '@/lib/recognizer';
import { formatDurationSec, pluralWords, countWords, formatRelativeDate } from '@/lib/format';

type Screen = 'home' | 'draw' | 'timer' | 'result';

export default function ReasonTrainer() {
  const [screen, setScreen] = useState<Screen>('home');
  const [settings, setSettingsState] = useState<ReasonSettings>(DEFAULT_REASON_SETTINGS);
  const [history, setHistory] = useState<ReasonAttempt[]>([]);

  const [topic, setTopic] = useState<string>('');
  const [argReq, setArgReq] = useState<ArgType | null>(null);

  const [remainingSec, setRemainingSec] = useState<number>(60);
  const [warn, setWarn] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceMode, setVoiceMode] = useState(false);

  const [resultAttempt, setResultAttempt] = useState<ReasonAttempt | null>(null);

  const timerRef = useRef<Timer | null>(null);
  const recognizerRef = useRef<Recognizer | null>(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    setSettingsState(getReasonSettings());
    setHistory(getReasonHistory());
  }, []);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  const drawTopic = useCallback(() => {
    const last = getLastTopics();
    const t = pickTopic(last);
    setTopic(t);
    setArgReq(settings.level === 'argument' ? pickArgType() : null);
    setTranscript('');
    setScreen('draw');
  }, [settings.level]);

  const reroll = useCallback(() => {
    const last = [...getLastTopics(), topic];
    const t = pickTopic(last);
    setTopic(t);
    if (settings.level === 'argument') setArgReq(pickArgType());
  }, [topic, settings.level]);

  const finishAttempt = useCallback(
    (viaStop: boolean) => {
      if (timerRef.current) { timerRef.current.stop(); timerRef.current = null; }
      recognizerRef.current?.stop();
      recognizerRef.current = null;
      setWarn(false);

      if (!viaStop) { playEndBeep(); vibrate(180); }
      const text = transcriptRef.current.trim();
      const wc = countWords(text);
      const tier = gradeReason(wc, settings.duration).tier;
      const att: ReasonAttempt = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'r_' + Date.now(),
        ts: Date.now(),
        topic,
        argRequired: argReq?.id || null,
        duration: settings.duration,
        wordCount: wc,
        transcript: text,
        tier,
      };
      saveReasonAttempt(att);
      setHistory(getReasonHistory());
      setResultAttempt(att);
      setScreen('result');
    },
    [topic, argReq, settings.duration],
  );

  const startTimer = useCallback(async () => {
    pushLastTopic(topic);
    setTranscript('');
    setRemainingSec(settings.duration);
    setWarn(false);
    setVoiceMode(false);
    setScreen('timer');

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
  }, [topic, settings.duration, finishAttempt]);

  const resetSession = useCallback(() => {
    if (timerRef.current) { timerRef.current.stop(); timerRef.current = null; }
    recognizerRef.current?.stop();
    recognizerRef.current = null;
    setWarn(false);
    setTranscript('');
    setTopic('');
    setArgReq(null);
    setScreen('home');
    setResultAttempt(null);
  }, []);

  const handleResetClick = () => {
    if (screen === 'timer') {
      if (!confirm('Прервать рассуждение? Прогресс не сохранится.')) return;
    }
    resetSession();
  };

  const changeDuration = (d: ReasonDuration) => {
    setSettingsState(setReasonSettings({ duration: d }));
  };
  const changeLevel = (l: ReasonLevel) => {
    setSettingsState(setReasonSettings({ level: l }));
  };

  const showResetBtn = screen === 'draw' || screen === 'timer';

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
            <h1>Рассуждение</h1>
            <p>Тренажёр / 03 · Аргументация</p>
          </header>

          <div className="hero">
            Выпадает спорный тезис — за <strong>{formatDurationSec(settings.duration)}</strong> отстаивай позицию.
            На сложном уровне даётся обязательный тип аргумента (факт, цитата, аналогия, опыт,
            причинно-следственная связь) — самый плотный режим для тренировки беглой полемики.
          </div>

          <details className="theory-details">
            <summary>Структура рассуждения</summary>
            <div className="theory-body">
              <p>
                Рассуждение строится по схеме: <strong>тезис → аргументы → вывод</strong>.
                Контраргумент усиливает позицию, а не размывает её.
              </p>

              <h4>Тезис</h4>
              <p>
                Спорное утверждение, которое можно подтвердить или опровергнуть.
                Если у фразы нет двух защищаемых сторон — это факт, а не тезис.
              </p>

              <h4>Виды аргументов</h4>
              <ul>
                <li><strong>Факт</strong> — проверяемое утверждение о реальности.</li>
                <li><strong>Статистика</strong> — числовая закономерность, отсылающая к источнику.</li>
                <li><strong>Цитата</strong> — слова авторитета: учёного, писателя, эксперта.</li>
                <li><strong>Аналогия</strong> — параллель с известной ситуацией из другой области.</li>
                <li><strong>Причинно-следственная связь</strong> — «X происходит, потому что Y».</li>
                <li><strong>Личный опыт</strong> — пример из жизни. Слабее факта, но эмоционально сильнее.</li>
              </ul>

              <h4>Контраргумент</h4>
              <p>
                Признать, почему оппонент может думать иначе — и опровергнуть. Это звучит сильнее, чем
                игнорирование чужой позиции.
              </p>

              <h4>Вывод</h4>
              <p>
                Возвращение к тезису, усиленному аргументацией. Не «и в заключение хочу сказать…»,
                а ещё одна формулировка тезиса — теперь с весом всего сказанного позади.
              </p>
            </div>
          </details>

          <div className="step-label" style={{ marginTop: 4 }}>
            <span className="step-num">1</span>
            <span>Уровень</span>
          </div>
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            {REASON_LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                className={settings.level === l ? 'active' : ''}
                onClick={() => changeLevel(l)}
              >
                {REASON_LEVEL_LABEL[l]}
              </button>
            ))}
          </div>

          <div className="step-label" style={{ marginTop: 4 }}>
            <span className="step-num">2</span>
            <span>Длительность</span>
          </div>
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            {REASON_DURATIONS.map((d) => (
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

          <button className="btn btn-primary btn-block" type="button" onClick={drawTopic}>Начать</button>

          {history.length > 0 && (
            <div className="history-block">
              <div className="history-title">История</div>
              {history.slice(0, 5).map((a) => {
                const arg = a.argRequired ? ARG_TYPES.find(t => t.id === a.argRequired) : null;
                return (
                  <div key={a.id} className="history-item">
                    <span>
                      <strong>{a.wordCount}</strong>{' '}
                      {pluralWords(a.wordCount)} · {a.topic.length > 40 ? a.topic.slice(0, 40) + '…' : a.topic}
                      {arg && <> · {arg.label}</>}
                    </span>
                    <span className="date">{formatRelativeDate(a.ts)}</span>
                  </div>
                );
              })}
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
          <div className="draw-pos">тезис · {settings.duration}&nbsp;секунд</div>
          <div className="letter-stage" style={{ gap: 14 }}>
            <div
              className="letter-big"
              style={{
                fontSize: 'clamp(22px, 5.5vw, 38px)',
                lineHeight: 1.2,
                textIndent: 0,
                textAlign: 'left',
                fontWeight: 500,
              }}
            >
              {topic}
            </div>
          </div>

          {argReq && (
            <div className="arg-card">
              <div className="arg-label">Обязательно приведи · {argReq.label}</div>
              <div className="arg-name">{argReq.label}</div>
              <div className="arg-hint">{argReq.hint}</div>
              <div className="arg-example">{argReq.example}</div>
            </div>
          )}

          <div className="draw-context">
            <strong>Структура</strong> · тезис в начале, два-три аргумента, признать контраргумент,
            вернуться к тезису. Не редактируй формулировки на ходу.
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
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span className="letter" style={{ fontSize: 14 }}>{topic}</span>
            </span>
            <span style={{ flexShrink: 0, marginLeft: 12 }}>{formatDurationSec(settings.duration)}</span>
          </div>
          {argReq && (
            <div style={{
              fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase',
              fontWeight: 700, color: 'var(--accent)', marginTop: -10,
            }}>
              приведи {argReq.label.toLowerCase()}
            </div>
          )}
          <div className="timer-stage" style={{ gap: 16 }}>
            <div className={'timer-digits' + (warn ? ' warn' : '')} style={{ fontSize: '22vh' }}>
              {remainingSec}
            </div>
            <div className="description-area" style={{ minHeight: '12vh', maxHeight: '22vh', overflowY: 'auto' }} aria-live="polite">
              {transcript || (
                <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>
                  {voiceMode ? 'распознаётся речь…' : 'голос недоступен — рассуждай вслух, текст не запишется'}
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
          onHome={() => resetSession()}
          onAgain={() => { resetSession(); drawTopic(); }}
        />
      )}
    </>
  );
}

function ResultView({
  attempt, onHome, onAgain,
}: {
  attempt: ReasonAttempt;
  onHome: () => void;
  onAgain: () => void;
}) {
  const grade: ReasonGrade = gradeReason(attempt.wordCount, attempt.duration);
  const wpm = attempt.wordCount > 0 ? Math.round((attempt.wordCount / attempt.duration) * 60) : 0;
  const arg = attempt.argRequired ? ARG_TYPES.find(t => t.id === attempt.argRequired) : null;

  return (
    <section className="screen">
      <div className="count-head">
        <div>результат · {attempt.topic.length > 50 ? attempt.topic.slice(0, 50) + '…' : attempt.topic}</div>
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

      {arg && (
        <div style={{
          fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
          fontWeight: 700, color: 'var(--text-muted)',
        }}>
          Требовался аргумент: <span style={{ color: 'var(--accent)' }}>{arg.label}</span>
        </div>
      )}

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
