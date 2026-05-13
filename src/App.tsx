import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getSettings } from '@/lib/storage';
import HomeScreen from '@/screens/HomeScreen';
import WarmupHomeScreen from '@/screens/WarmupHomeScreen';
import LetterTrainer from '@/screens/LetterTrainer';
import AssocTrainer from '@/screens/AssocTrainer';
import DescribeTrainer from '@/screens/DescribeTrainer';
import NarrateTrainer from '@/screens/NarrateTrainer';
import PlaceholderScreen from '@/screens/PlaceholderScreen';

function applyStoredTheme() {
  const t = getSettings().theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
}

export default function App() {
  useEffect(() => {
    applyStoredTheme();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/warmup" element={<WarmupHomeScreen />} />
        <Route path="/warmup/letter" element={<LetterTrainer />} />
        <Route path="/warmup/assoc" element={<AssocTrainer />} />
        <Route path="/describe" element={<DescribeTrainer />} />
        <Route path="/narrate" element={<NarrateTrainer />} />
        <Route
          path="/reason"
          element={<PlaceholderScreen title="Рассуждение" subtitle="Тренажёр / 03" backTo="/" />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
