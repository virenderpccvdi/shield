import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeStore {
  mode: 'light' | 'dark';
  toggle: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: 'light',
      toggle: () => set((s) => ({ mode: s.mode === 'light' ? 'dark' : 'light' })),
    }),
    { name: 'shield-theme' }
  )
);
