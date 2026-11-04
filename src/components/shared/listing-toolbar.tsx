'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ListingToolbarProps {
  /** Search value controlled by parent */
  searchValue?: string;
  /** Callback when search input changes */
  onSearchChange?: (value: string) => void;
  /** Placeholder for search input */
  searchPlaceholder?: string;
  /** Optional custom content for the left slot (overrides or supplements default search input) */
  leftSlot?: React.ReactNode;
  /** Alias for leftSlot */
  left?: React.ReactNode;
  /** Secondary filters and primary creation button rendered on the right */
  rightSlot?: React.ReactNode;
  /** Alias for rightSlot */
  right?: React.ReactNode;
  /** Optional secondary filter controls rendered in the right slot */
  filters?: React.ReactNode;
  /** Optional primary action buttons rendered in the right slot */
  actions?: React.ReactNode;
  /** Additional wrapper className */
  className?: string;
  /** Optional width class for the search input container */
  searchClassName?: string;
}

/**
 * Standardized Listing Toolbar (Phase 2 & IMPROVEMENT-004 / IMPROVEMENT-005).
 *
 * Layout:
 * - Left Slot: Primary search/filter input with clear button.
 * - Right Slot: Secondary filter dropdowns/toggles + primary creation action button ("Novo ...").
 * - Positioned directly above the listing table/cards with responsive flex wrapping.
 */
export function ListingToolbar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  leftSlot,
  left,
  rightSlot,
  right,
  filters,
  actions,
  className,
  searchClassName,
}: ListingToolbarProps) {
  const resolvedLeft = leftSlot ?? left;
  const resolvedRight = rightSlot ?? right;
  const hasRightContent = Boolean(resolvedRight || filters || actions);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between',
        className
      )}
    >
      {/* Left Slot: Search / Primary Filter */}
      <div className={cn('flex flex-1 items-center gap-2', searchClassName)}>
        {onSearchChange !== undefined && (
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9 pr-8 h-10"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        {resolvedLeft}
      </div>

      {/* Right Slot: Secondary Filters + Primary Creation Button */}
      {hasRightContent && (
        <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
          {filters}
          {actions}
          {resolvedRight}
        </div>
      )}
    </div>
  );
}
