'use client';

import React, { useState } from 'react';
import { useTheme, THEMES } from './theme-provider';
import { Palette, Check } from 'lucide-react';

const themeColors: Record<string, string> = {
  'rosa-delicado': '#f472b6',
  'lavanda-suave': '#a78bfa',
  'nude-natural': '#d6d3d1',
  'verde-sereno': '#34d399',
  'azul-classico': '#60a5fa',
  'borgonha-elegante': '#9f1239'
};

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen && (
        <div className="absolute bottom-14 right-0 bg-white dark:bg-zinc-950 border rounded-lg shadow-lg p-2 w-48 mb-2">
          <div className="text-sm font-semibold mb-2 px-2 text-zinc-900 dark:text-zinc-100">Tema</div>
          <div className="flex flex-col gap-1">
            {THEMES.map((t) => (
              <button
                key={t.name}
                onClick={() => {
                  setTheme(t.name);
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm text-left w-full transition-colors"
              >
                <div 
                  className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" 
                  style={{ backgroundColor: themeColors[t.name] }}
                >
                  {theme === t.name && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-zinc-700 dark:text-zinc-300 flex-1">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
        aria-label="Selecionar tema"
      >
        <Palette className="w-6 h-6" />
      </button>
    </div>
  );
}
