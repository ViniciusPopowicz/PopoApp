'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AppComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

export interface AppComboboxProps {
  options: AppComboboxOption[];
  value: string;
  onChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  searchable?: boolean;
  creatable?: boolean;
  clearable?: boolean;
  className?: string;
  triggerClassName?: string;
  id?: string;
  name?: string;
  required?: boolean;
  'aria-label'?: string;
}

/**
 * Standardized Combobox / Select primitive (Phase 2 & IMPROVEMENT-007).
 *
 * Visually matches the "Modo de Rastreio" ("Tracking Mode") control in New Product:
 * - Trigger: `flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`
 * - Popover: `z-50 max-h-60 min-w-[8rem] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md`
 * - Option: `relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground`
 * - Supports keyboard navigation (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`), outside click detection, search filtering, and creatable free-text options.
 */
export function AppCombobox({
  options,
  value,
  onChange: onChangeProp,
  onValueChange,
  placeholder = 'Selecione...',
  searchPlaceholder = 'Buscar opção...',
  emptyText = 'Nenhuma opção encontrada.',
  disabled = false,
  searchable = false,
  creatable = false,
  clearable = false,
  className,
  triggerClassName,
  id,
  name,
  required,
  'aria-label': ariaLabel,
}: AppComboboxProps) {
  const onChange = onChangeProp ?? onValueChange ?? (() => {});
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const displayLabel = selectedOption
    ? selectedOption.label
    : creatable && value
    ? value
    : '';

  const showSearchInput = searchable || creatable || options.length > 7;

  const filteredOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(trimmed) ||
        opt.value.toLowerCase().includes(trimmed) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(trimmed))
    );
  }, [options, query]);

  const canCreateCustom = useMemo(() => {
    if (!creatable) return false;
    const trimmed = query.trim();
    if (!trimmed) return false;
    return !options.some(
      (opt) =>
        opt.value.toLowerCase() === trimmed.toLowerCase() ||
        opt.label.toLowerCase() === trimmed.toLowerCase()
    );
  }, [creatable, options, query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setQuery('');
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 10);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, open]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    const totalItems = filteredOptions.length + (canCreateCustom ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (totalItems > 0) {
        setHighlightedIndex((prev) => (prev + 1) % totalItems);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (totalItems > 0) {
        setHighlightedIndex((prev) => (prev - 1 + totalItems) % totalItems);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex < filteredOptions.length) {
        const opt = filteredOptions[highlightedIndex];
        if (opt && !opt.disabled) {
          handleSelect(opt.value);
        }
      } else if (canCreateCustom) {
        handleSelect(query.trim());
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          required={required}
        />
      )}

      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={id ? `${id}-listbox` : 'app-combobox-listbox'}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((prev) => !prev);
          }
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-left',
          triggerClassName
        )}
      >
        <span className={cn('block truncate', !displayLabel && 'text-muted-foreground')}>
          {displayLabel || placeholder}
        </span>

        <span className="flex items-center gap-1 ml-2 shrink-0">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Limpar seleção"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 opacity-50 transition-transform duration-150',
              open && 'rotate-180'
            )}
          />
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          ref={listRef}
          className="absolute left-0 z-50 mt-1 max-h-64 w-full min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80"
        >
          {showSearchInput && (
            <div className="flex items-center border-b px-2.5 py-1.5 bg-muted/20">
              <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={creatable ? 'Buscar ou digitar novo...' : searchPlaceholder}
                className="flex h-7 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="max-h-52 overflow-y-auto p-1">
            {filteredOptions.length === 0 && !canCreateCustom ? (
              <div className="py-3 px-2 text-center text-xs text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              <>
                {filteredOptions.map((option, idx) => {
                  const isSelected = option.value === value;
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <div
                      key={`${option.value}-${idx}`}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => {
                        if (!option.disabled) {
                          handleSelect(option.value);
                        }
                      }}
                      className={cn(
                        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
                        isHighlighted && 'bg-accent text-accent-foreground',
                        isSelected && 'font-medium',
                        option.disabled && 'pointer-events-none opacity-50'
                      )}
                    >
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        {isSelected && <Check className="h-4 w-4" />}
                      </span>
                      <div className="flex flex-col truncate">
                        <span className="truncate">{option.label}</span>
                        {option.sublabel && (
                          <span className="truncate text-[11px] text-muted-foreground">
                            {option.sublabel}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {canCreateCustom && (
                  <div
                    role="option"
                    aria-selected={false}
                    onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
                    onClick={() => handleSelect(query.trim())}
                    className={cn(
                      'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors text-primary hover:bg-accent hover:text-accent-foreground',
                      highlightedIndex === filteredOptions.length &&
                        'bg-accent text-accent-foreground'
                    )}
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <Check className="h-4 w-4 opacity-50" />
                    </span>
                    <span className="truncate font-medium">
                      Usar &quot;{query.trim()}&quot;
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AppCombobox;
