import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light-glass' | 'dark-neon';
export type AccentColor = 'cyan' | 'blue' | 'violet' | 'green' | 'custom';
export type EffectLevel = 'low' | 'medium' | 'high';

interface ThemeState {
    theme: ThemeMode;
    accent: AccentColor;
    customAccent: string;
    blur: EffectLevel;
    glow: EffectLevel;
    reducedMotion: boolean;

    setTheme: (theme: ThemeMode) => void;
    setAccent: (accent: AccentColor) => void;
    setCustomAccent: (color: string) => void;
    setBlur: (level: EffectLevel) => void;
    setGlow: (level: EffectLevel) => void;
    setReducedMotion: (enabled: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: 'dark-neon',
            accent: 'cyan',
            customAccent: '#00d4d4',
            blur: 'medium',
            glow: 'medium',
            reducedMotion: false,

            setTheme: (theme) => set({ theme }),
            setAccent: (accent) => set({ accent }),
            setCustomAccent: (customAccent) => set({ customAccent }),
            setBlur: (blur) => set({ blur }),
            setGlow: (glow) => set({ glow }),
            setReducedMotion: (reducedMotion) => set({ reducedMotion }),
        }),
        {
            name: 'abos-theme',
        }
    )
);

// Hook to apply theme to document
export function useTheme() {
    const { theme, accent, blur, glow, reducedMotion } = useThemeStore();

    if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-accent', accent);
        document.documentElement.setAttribute('data-blur', blur);
        document.documentElement.setAttribute('data-glow', glow);

        if (reducedMotion) {
            document.documentElement.classList.add('reduce-motion');
        } else {
            document.documentElement.classList.remove('reduce-motion');
        }
    }

    return useThemeStore();
}
