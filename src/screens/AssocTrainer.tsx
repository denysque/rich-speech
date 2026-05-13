import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ASSOC_DURATIONS, DEFAULT_ASSOC_SETTINGS,
  gradeAssoc, getAssocHistory, getAssocSettings, setAssocSettings,
  getLastSeeds, pickSeed, pushLastSeed, saveAssocAttempt,
  findMissedHints, normalizeAssoc,
  type AssocAttempt, type AssocDuration, type AssocGrade, type AssocSettings,
} from '@/lib/assoc';
import { createTimer, type Timer, playEndBeep, vibrate } from '@/lib/timer';
import { createAllRecognizer, ensureMicPermission, getSR, type Recognizer } from '@/lib/recognizer';
import { formatDurationSec, pluralWords, formatRelativeDate } from '@/lib/format';

type Screen = 'home' | 'draw' | 'timer' | 'count' | 'result';

export default function AssocTrainer() {
  const [screen, setScreen] = useState<Screen>('home');
  const [settings, setSettingsState] = useState<AssocSettings>(DEFAULT_ASSOC_SETTINGS);
  const [history, setHistory] = useState<AssocAttempt[]>([]);

  const [seed, setSeed] = useState<string>('');
  const [remainingSec, setRemainingSec] = useState<number>(60);
  const [warn, setWarn] = useState(false);

  const [matchedWords, setMatchedWords] = useState<string[]>([]);
  const [lastWord, setLastWord] = useState<string>('');
  const [voiceMode, setVoiceMode] = useState(false);

  const [excludedWords, setExcludedWords] = useState<Set<string>>(new Set());
  const [manualCount, setManualCount] = useState(0);
  const [countAuto, setCountAuto] = useState<number | null>(null);
  const [resultAttempt, setResultAttempt] = useState<AssocAttempt | null>(null);

  const [toast, setToast] = useState('');

  const timerRef = useRef<Timer | null>(null);
  const recognizerRef = useRef<Recognizer | null>(null);

  // Init
  useEffect(() => {
    setSettingsState(getAssocSettings());
    setHistory(getAssocHistory());
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  // ===== Жеребьёвка =====
  const startDraw = useCallback(() => {
    const last = getLastSeeds();
    const next = pickSeed(last);
    setSeed(next);
    setScreen('draw');
  }, []);

  const reroll = useCallback(() => {
    const last = [...getLastSeeds(), seed];
    const next = pickSeed(last);
    setSeed(next);
  }, [seed]);

  // ===== Таймер =====
  const startTimer = useCallback(async () => {
    pushLastSeed(seed);
    setMatchedWords([]);
    setLastWord('');
    setRemainingSec(settings.duration);
    setWarn(false);
    setVoiceMode(false);
    setScreen('timer');

    // Распознавание речи (если поддерживается)
    const SR = getSR();
    if (SR) {
      const ok = await ensureMicPermission();
      if (ok) {
        const seedNorm = normalizeAssoc(seed);
        const rec = createAllRecognizer(
          new Set([seedNorm]),
          (words) => {
            setMatchedWords(words);
            if (words.length > 0) setLastWord(words[words.length - 1]);
          },
        );
        if (rec) {
          recognizerRef.current = rec;
          if (rec.start()) setVoiceMode(true);
        }
      }
    }

    const tmr = createTimer(
      settings.duration * 1000,
      (remainingMs) => {
        const sec = Math.ceil(remainingMs / 1000);
        setRemainingSec(sec);
        if (sec <= 10 && !warn) setWarn(true);
      },
      () => {
        playEndBeep();
        vibrate(180);
        recognizerRef.current?.stop();
        recognizerRef.current = null;
        // Переход на экран подсчёта
        setCountAuto(matchedWordsRef.current.length);
        setManualCount(matchedWordsRef.current.length);
        setExcludedWords(new Set());
        setScreen('count');
      },
    );
    timerRef.current = tmr;
    tmr.start();
  }, [seed, settings.duration, warn]);

  // ref для актуального значения matchedWords внутри onDone (closure-issue)
  const matchedWordsRef = useRef<string[]>([]);
  useEffect(() => { matchedWordsRef.current = matchedWords; }, [matchedWords]);

  const stopEarly = useCallback(() => {
    timerRef.current?.stop();
    recognizerRef.current?.stop();
    recognizerRef.current = null;
    setCountAuto(matchedWordsRef.current.length);
    setManualCount(matchedWordsRef.current.length);
    setExcludedWords(new Set());
    setScreen('count');
  }, []);

  // ===== Подсчёт =====
  const toggleWord = useCallback((w: string) => {
    setExcludedWords((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });
  }, []);

  // В voice-режиме количество валидных = матченных - исключённых.
  useEffect(() => {
    if (voiceMode) {
      setManualCount(matchedWords.filter((w) => !excludedWords.has(w)).length);
    }
  }, [voiceMode, matchedWords, excludedWords]);

  const finalizeCount = useCallback(() => {
    const valid = matchedWords.filter((w) => !excludedWords.has(w));
    const count = voiceMode ? valid.length : Math.max(0, Math.floor(manualCount));
    const words = voiceMode ? valid : [];
    const tier = gradeAssoc(count, settings.duration).tier;

    const att: AssocAttempt = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      seed,
      duration: settings.duration,
      count,
      countAuto: voiceMode ? countAuto : null,
      words,
      tier,
    };
    saveAssocAttempt(att);
    setHistory(getAssocHistory());
    setResultAttempt(att);
    setScreen('result');
  }, [matchedWords, excludedWords, voiceMode, manualCount, countAuto, seed, settings.duration]);

  // ===== Контролы =====
  const changeDuration = useCallback((d: AssocDuration) => {
    const next = setAssocSettings({ duration: d });
    setSettingsState(next);
  }, []);

  const resetToHome = useCallback(() => {
    timerRef.current?.stop();
    recognizerRef.current?.stop();
    recognizerRef.current = null;
    setScreen('home');
    setMatchedWords([]);
    setExcludedWords(new Set());
    setManualCount(0);
    setCountAuto(null);
    setResultAttempt(null);
    setSeed('');
    setVoiceMode(false);
    setWarn(false);
  }, []);

  // ===== Рендер =====
  const showResetBtn = screen === 'draw' || screen === 'timer' || screen === 'count';

  return (
    <>
      {showResetBtn && (
        <button className="reset-btn" type="button" aria-label="Прервать и вернуться" onClick={resetToHome}>
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
            to="/warmup"
            style={{
              fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
              fontWeight: 700, color: 'var(--text-muted)', textDecoration: 'none',
              alignSelf: 'flex-start',
            }}
          >
            ← Разминка
          </Link>

          <header className="title-block">
            <h1>Ассоциативный ряд</h1>
            <p>Разминка · 02</p>
          </header>

          <div className="hero">
            Выпадает существительное — за <strong>{settings.duration}&nbsp;секунд</strong> назови всё,
            что с ним связано. Части, действия, образы, ситуации. Качество не оценивай — говори всё, что приходит.
          </div>

          <div className="step-label" style={{ marginTop: 4 }}>
            <span className="step-num">1</span>
            <span>Длительность</span>
          </div>
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            {ASSOC_DURATIONS.map((d) => (
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

          <button className="btn btn-primary btn-block" type="button" onClick={startDraw}>
            Начать
          </button>

          {history.length > 0 && (
            <div className="history-block">
              <div className="history-title">История</div>
              {history.slice(0, 5).map((a) => (
                <div key={a.id} className="history-item">
                  <span>
                    <strong>{a.count}</strong>{' '}
                    {pluralWords(a.count)} · {a.seed} · {formatDurationSec(a.duration)}
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
          <div className="draw-pos">слово · {settings.duration}&nbsp;секунд</div>
          <div className="letter-stage">
            <div className="letter-big" style={{ fontSize: 'clamp(48px, 14vw, 96px)', lineHeight: 1 }}>
              {seed}
            </div>
            <div className="draw-hint">говори всё, что приходит</div>
          </div>
          <div className="draw-context">
            <strong>Подсказка</strong> · можно называть части, материал, действия, ситуации,
            людей, места — любые связи с этим словом.
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
            <span><span className="letter">{seed}</span></span>
            <span>{formatDurationSec(settings.duration)}</span>
          </div>
          <div className="timer-stage">
            <div className={`timer-digits ${warn ? 'warn' : ''}`}>{remainingSec}</div>
            <div className="timer-voice">
              {voiceMode ? (
                <>
                  {lastWord && <div className="last-word">{lastWord}</div>}
                  <div className="count"><strong>{matchedWords.length}</strong>{' '}{pluralWords(matchedWords.length)}</div>
                </>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>
                  Голосовой ввод недоступен — посчитаешь ассоциации после таймера вручную
                </div>
              )}
            </div>
          </div>
          <button className="btn btn-block" type="button" onClick={stopEarly}>Стоп</button>
        </section>
      )}

      {/* COUNT */}
      {screen === 'count' && (
        <section className="screen">
          <div className="count-head">
            <div>{voiceMode ? 'Услышано — отметь лишнее' : 'Сколько ассоциаций назвал?'}</div>
            <h2>{seed}</h2>
          </div>

          {voiceMode ? (
            <>
              {matchedWords.length === 0 ? (
                <div className="word-list-empty">Голос не уловил ни одного слова</div>
              ) : (
                <ul className="word-list">
                  {matchedWords.map((w) => {
                    const excluded = excludedWords.has(w);
                    return (
                      <li
                        key={w}
                        className={`word-item ${excluded ? 'rejected' : 'checked'}`}
                        onClick={() => toggleWord(w)}
                        role="button"
                        tabIndex={0}
                      >
                        <span className="check" />
                        <span className="word">{w}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="count-head" style={{ marginTop: 8, borderTop: 'none' }}>
                <div>Итого: <strong style={{ color: 'var(--accent)' }}>{manualCount}</strong>{' '}{pluralWords(manualCount)}</div>
              </div>
            </>
          ) : (
            <div className="num-input-wrap">
              <button className="num-btn" type="button" onClick={() => setManualCount(Math.max(0, manualCount - 1))} aria-label="Минус">−</button>
              <input
                className="num-input"
                type="number"
                inputMode="numeric"
                value={manualCount}
                min={0}
                onChange={(e) => setManualCount(Math.max(0, parseInt(e.target.value || '0', 10) || 0))}
              />
              <button className="num-btn" type="button" onClick={() => setManualCount(manualCount + 1)} aria-label="Плюс">+</button>
            </div>
          )}

          <div className="grow" />

          <button className="btn btn-primary btn-block" type="button" onClick={finalizeCount}>Готово</button>
        </section>
      )}

      {/* RESULT */}
      {screen === 'result' && resultAttempt && (
        <ResultView
          attempt={resultAttempt}
          onAgain={() => { resetToHome(); startDraw(); }}
          onHome={resetToHome}
        />
      )}

      {toast && <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>}
    </>
  );
}

/* ============ Result subscreen ============ */
function ResultView({
  attempt, onAgain, onHome,
}: {
  attempt: AssocAttempt;
  onAgain: () => void;
  onHome: () => void;
}) {
  const grade: AssocGrade = gradeAssoc(attempt.count, attempt.duration);
  const missed = findMissedHints(attempt.seed, attempt.words);

  return (
    <section className="screen">
      <div className="count-head">
        <div>результат · {attempt.seed} · {formatDurationSec(attempt.duration)}</div>
        <h2>Итог</h2>
      </div>

      <div className="result-stage">
        <div className="result-count">{attempt.count}</div>
        <div className={`result-tier tier-${grade.tier}`}>{grade.title}</div>
        <div className="result-subtitle">{grade.subtitle}</div>
        <div className="result-meta">
          {pluralWords(attempt.count)} · {formatDurationSec(attempt.duration)}
        </div>
        <div className="result-support">{grade.support}</div>
      </div>

      {missed.length > 0 && (
        <div className="vocab-block">
          <div className="vocab-title">Ещё можно было сказать</div>
          <div className="vocab-sub">
            Эти ассоциации к слову «{attempt.seed}» приходят первыми у большинства носителей русского.
          </div>
          <div className="vocab-grid">
            {missed.map((w) => (
              <span key={w} className="vocab-chip" tabIndex={0}>{w}</span>
            ))}
          </div>
        </div>
      )}

      <div className="grow" />

      <div className="btn-row">
        <button className="btn" type="button" onClick={onHome}>На главную</button>
        <button className="btn btn-primary" type="button" onClick={onAgain}>Ещё раз</button>
      </div>
    </section>
  );
}
