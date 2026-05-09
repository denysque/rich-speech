# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
всегда отвечай на русском языке

## What this repo is

**Rich Speech** — набор тренажёров устной речи для спикеров. Форк проекта `speech-trainer` (тренажёр «Слова на букву»), переросший в мульти-упражнение приложение с разделами:

- **Разминка** (`/warmup`) — короткие активации речевого аппарата перед основными упражнениями.
  - **Слова на букву** (`/warmup/letter`) — минутный тренажёр беглости (готов, перенесён из speech-trainer).
  - **Ассоциативный ряд** (`/warmup/assoc`) — в разработке.
- **Описание** (`/describe`) — опиши предмет/человека/место за минуту. В разработке.
- **Повествование** (`/narrate`) — расскажи историю. В разработке.
- **Рассуждение** (`/reason`) — объясни/докажи/обоснуй. В разработке.

Родитель (speech-trainer) живёт отдельным репозиторием (https://github.com/denysque/speech-trainer) и является единственным «упражнением разминки» там — в Rich Speech он один из многих.

## Stack

- **Vite 6** + **React 19** + **TypeScript 5** + **Tailwind 4** (через `@tailwindcss/vite`, без `tailwind.config.js`, тема в `src/index.css` через `@theme inline`)
- **react-router-dom 7** — клиентский роутинг между разделами
- **Vercel Functions** (`api/*.ts`, `@vercel/node`) — три эндпоинта словаря Ожегова, нужны только тренажёру «Слова на букву». В dev поднимаются Vite-плагином `dev-api` (`vite.config.ts`).
- **Node 18.18+**

## Run / develop

```bash
npm install
npm run dev          # vite dev, http://localhost:3000
npm run build        # tsc -b + vite build (в dist/)
npm run preview      # запуск собранного dist/
```

Тестов нет.

## Architecture

### Роутер

`src/App.tsx` — тонкий, только `<BrowserRouter>` и `<Routes>`. Применяет сохранённую тему один раз при старте.

| Маршрут | Компонент | Статус |
|---|---|---|
| `/` | `screens/HomeScreen.tsx` | список 4 разделов |
| `/warmup` | `screens/WarmupHomeScreen.tsx` | список упражнений разминки |
| `/warmup/letter` | `screens/LetterTrainer.tsx` | готов — минутный тренажёр беглости |
| `/warmup/assoc` | `PlaceholderScreen` | заглушка |
| `/describe`, `/narrate`, `/reason` | `PlaceholderScreen` | заглушки |
| `*` | `<Navigate to="/" replace />` | catch-all |

### Тренажёр «Слова на букву»

Остался монолитом `screens/LetterTrainer.tsx` (~900 строк) с внутренней state-машиной `screen: 'home' | 'draw' | 'timer' | 'count' | 'result'` — это **внутренний** конечный автомат тренажёра, не роуты. Не разбивайте на роуты — это сломает поток упражнения. Если будете трогать — все хуки и эффекты идут одним блоком.

### Чистые функции — `src/lib/`

Не менялись по сравнению с speech-trainer:

| Файл | Что |
|---|---|
| `constants.ts` | LETTERS (28 букв), PARTS_OF_SPEECH, `STORAGE_KEYS` (`speech-trainer:*` — оставлены без переименования, чтобы не тащить миграцию; новые тренажёры используют свои префиксы), типы `Attempt`/`Settings` |
| `letters.ts` | `pickLetter` (антиповтор последних 3) |
| `words.ts` | `extractMatchingWords`, `looksLikePOS` |
| `grade.ts` | `gradeResult` (пороги 10/20/30) |
| `dict.ts` | Клиентские обёртки над `/api/check`, `/api/vocab`, `/api/define` |
| `liveValidator.ts` | Дебансит распознанные слова и батчем шлёт в `/api/check` |
| `timer.ts` | `createTimer` через rAF + Date.now() |
| `recognizer.ts` | Web Speech API wrapper + `ensureMicPermission` |
| `storage.ts` | localStorage CRUD |
| `format.ts` | склонения, относительные даты |
| `server/ozhegov.ts` | **Серверный** — читает `data/ozhegov.json`, не импортируйте из клиентского кода |

### Серверные API — `api/`

Те же три эндпоинта (`check`, `vocab`, `define`), используются только тренажёром «Слова на букву». Когда будут добавляться новые упражнения с серверной логикой — добавляйте новые `api/*.ts`, общие утилиты в `src/lib/server/`.

### Дизайн-система

`src/index.css` — editorial / Pentagram направление: кремовый газетный фон, угольные чернила (sumi), один акцент — ink red (`#e0301e`). Шрифты: Fraunces (variable serif, opsz/wght) для хедлайнов и крупной типографики, Inter Tight для интерфейсного sans. Нулевые скругления, тонкие чёрные правила вместо рамок-карточек. Переменные в `:root`, тёмная тема через `prefers-color-scheme` + `[data-theme]` override.

Главное «лицо» дизайна — гигантский серифный текст: буква жеребьёвки 52vh, цифра результата 28vh, цифра таймера 36vh.

## Architecture rules

- **Алфавит = 28 букв** (`Ъ Ы Ь Й` исключены, `Ё → Е`), последние 3 не повторяются.
- **Таймер на `Date.now()`-дельтах**, не `setInterval`.
- **Web Speech API graceful-деградирует в ручной ввод.**
- **Эвристика части речи — мягкий фильтр.** UI показывает обе секции с возможностью вернуть.
- **Словарь Ожегова** — live-валидация во время таймера + добивание остатков на экране подсчёта.
- **`gradeResult` пороги 10/20/30** — точные.
- **localStorage namespace `speech-trainer:*`** — keys в `src/lib/constants.ts`. Новым тренажёрам брать собственные namespaces (`rich-speech:describe:*`, `rich-speech:narrate:*` и т.п.).
- **Mobile-first, ≥44px тачи, prefers-reduced-motion**.

## Добавление нового упражнения

1. Новый компонент `src/screens/<Name>.tsx`
2. Маршрут в `src/App.tsx`
3. Пункт в соответствующем `HomeScreen` / `WarmupHomeScreen` (поле `ready: true`)
4. Если нужен серверный код — `api/<endpoint>.ts`, общие утилиты в `src/lib/server/`
5. Свой namespace для localStorage

## Deploy

- **Vercel** — автодеплой при push в `main`. Vercel автодетектит Vite (build = `npm run build`, output = `dist/`) и параллельно собирает `api/*.ts`.
- При первом деплое: создать новый Vercel-проект, привязать к репо `denysque/rich-speech`, унаследовать `vercel.json` (`functions: { "api/**/*.ts": { includeFiles: "data/**" } }` уже там).

## Telegram Mini App

Родительский тренажёр (speech-trainer) интегрирован с `@slovanabukvubot`. Для Rich Speech это пока не настроено — будет отдельный бот, когда появятся стабильные основные упражнения.

⚠️ **WebKit (Safari, Telegram WebView на iOS/macOS) не поддерживает SpeechRecognition.** Голос работает только в Chromium-браузерах и Telegram Desktop на Win/Linux. На iPhone и Mac в Telegram приложение сваливается в ручной ввод.

## Что в `legacy/`

`legacy/index.html` — старая single-file vanilla сборка тренажёра «Слова на букву» (~1700 строк), пришла из speech-trainer. Можно удалить, когда не понадобится для референса.

## Locale

UI на русском. `lang="ru"` в `index.html`, `lang='ru-RU'` в SpeechRecognition. Числа/даты — `'ru-RU'`.
