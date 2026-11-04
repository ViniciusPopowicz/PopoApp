'use client';

import { useState, useEffect } from 'react';

/**
 * Custom debounce hook that delays updating the returned value until
 * `delay` milliseconds have elapsed since the last change to `value`.
 *
 * Default delay: 350ms (per IMPROVEMENT-003 specification).
 */
export function useDebounce<T>(value: T, delay = 350): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
