'use client';

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RowStatusToggleProps {
  isActive: boolean;
  onToggle: (nextState: boolean) => Promise<void>;
  activeLabel?: string;
  inactiveLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Standardized In-Table Row Status Toggle (Phase 2 & IMPROVEMENT-002).
 *
 * Provides an accessible switch + status badge inside table/card rows with:
 * - Optimistic UI state update
 * - Automatic rollback on API failure
 * - In-flight lock to prevent duplicate rapid clicks
 */
export function RowStatusToggle({
  isActive,
  onToggle,
  activeLabel = 'Ativo',
  inactiveLabel = 'Inativo',
  disabled = false,
  className,
}: RowStatusToggleProps) {
  const [optimisticActive, setOptimisticActive] = useState<boolean>(isActive);
  const [isPending, setIsPending] = useState<boolean>(false);

  useEffect(() => {
    setOptimisticActive(isActive);
  }, [isActive]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || isPending) return;

    const previousState = optimisticActive;
    const nextState = !previousState;

    // Optimistic update
    setOptimisticActive(nextState);
    setIsPending(true);

    try {
      await onToggle(nextState);
    } catch (err) {
      // Automatic rollback on failure
      setOptimisticActive(previousState);
      console.error('Failed to toggle row status:', err);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimisticActive}
      aria-label={optimisticActive ? `Status: ${activeLabel}. Clique para inativar` : `Status: ${inactiveLabel}. Clique para ativar`}
      disabled={disabled || isPending}
      onClick={handleClick}
      className={cn(
        'group inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60',
        optimisticActive
          ? 'border-emerald-200 bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'border-slate-200 bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400',
        className
      )}
    >
      <span
        className={cn(
          'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors',
          optimisticActive ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
        )}
      >
        <span
          className={cn(
            'inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform',
            optimisticActive ? 'translate-x-3.5' : 'translate-x-0.5'
          )}
        />
      </span>
      <span className="flex items-center gap-1">
        {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
        {optimisticActive ? activeLabel : inactiveLabel}
      </span>
    </button>
  );
}

export default RowStatusToggle;
