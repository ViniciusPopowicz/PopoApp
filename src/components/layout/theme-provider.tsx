'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export const THEMES = [
  { name: 'rosa-delicado', label: 'Rosa Delicado' },
  { name: 'lavanda-suave', label: 'Lavanda Suave' },
  { name: 'nude-natural', label: 'Nude Natural' },
  { name: 'verde-sereno', label: 'Verde Sereno' },
  { name: 'azul-classico', label: 'Azul Clássico' },
  { name: 'borgonha-elegante', label: 'Borgonha Elegante' }
];

type ThemeContextType = {
  theme: string;
  setTheme: (name: string) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: 'rosa-delicado',
  setTheme: () => null,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<string>('rosa-delicado');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('popoapp-theme') || 'rosa-delicado';
    setTheme(savedTheme);
  }, []);

  const setTheme = (name: string) => {
    setThemeState(name);
    localStorage.setItem('popoapp-theme', name);
    if (name === 'rosa-delicado') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', name);
    }
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
