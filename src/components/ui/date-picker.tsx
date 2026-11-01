'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import {
  format,
  parse,
  isValid,
  isToday,
  isSameDay,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { maskDateBR, dateBRToISO, isoToDateBR } from '@/lib/masks';
import { cn } from '@/lib/utils';

export interface DatePickerProps {
  id?: string;
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  minDate?: Date | string;
  maxDate?: Date | string;
  'aria-label'?: string;
}

export function DatePicker({
  id: customId,
  name,
  value = '',
  onChange,
  placeholder = 'DD/MM/AAAA',
  disabled = false,
  required = false,
  className,
  minDate,
  maxDate,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const generatedId = useId();
  const id = customId || generatedId;

  // Convert incoming value (could be ISO or DD/MM/AAAA) into DD/MM/AAAA display value
  const displayValue = React.useMemo(() => {
    if (!value) return '';
    if (value.includes('-')) {
      const parts = value.split('T')[0];
      return isoToDateBR(parts) || value;
    }
    return value;
  }, [value]);

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parsed selected date object for calendar highlight
  const selectedDate = React.useMemo(() => {
    if (!displayValue || displayValue.length !== 10) return null;
    const parsed = parse(displayValue, 'dd/MM/yyyy', new Date());
    return isValid(parsed) ? parsed : null;
  }, [displayValue]);

  // Current view month in calendar
  const [currentMonth, setCurrentMonth] = useState<Date>(() => selectedDate || new Date());

  // Update calendar view month if selected date changes externally
  useEffect(() => {
    if (selectedDate && isValid(selectedDate)) {
      setCurrentMonth(selectedDate);
    }
  }, [selectedDate]);

  // Click outside to close calendar
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const parsedMin = minDate
    ? typeof minDate === 'string'
      ? minDate.includes('/')
        ? parse(minDate, 'dd/MM/yyyy', new Date())
        : new Date(minDate)
      : minDate
    : null;

  const parsedMax = maxDate
    ? typeof maxDate === 'string'
      ? maxDate.includes('/')
        ? parse(maxDate, 'dd/MM/yyyy', new Date())
        : new Date(maxDate)
      : maxDate
    : null;

  const isDayDisabled = (day: Date) => {
    const dayStart = startOfDay(day);
    if (parsedMin && isValid(parsedMin) && dayStart < startOfDay(parsedMin)) return true;
    if (parsedMax && isValid(parsedMax) && dayStart > startOfDay(parsedMax)) return true;
    return false;
  };

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskDateBR(e.target.value);
    onChange?.(masked);
  };

  const handleSelectDay = (day: Date) => {
    if (isDayDisabled(day)) return;
    const formatted = format(day, 'dd/MM/yyyy');
    onChange?.(formatted);
    setIsOpen(false);
  };

  const handleToday = () => {
    const today = new Date();
    if (!isDayDisabled(today)) {
      handleSelectDay(today);
    }
  };

  const handleClear = () => {
    onChange?.('');
    setIsOpen(false);
  };

  // Generate days for grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { locale: ptBR });
  const endDate = endOfWeek(monthEnd, { locale: ptBR });
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className="relative flex items-center">
        <Input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          value={displayValue}
          onChange={handleManualInput}
          onClick={() => !disabled && setIsOpen(true)}
          disabled={disabled}
          required={required}
          aria-label={ariaLabel}
          className="pr-10 h-9 text-sm"
        />
        <button
          type="button"
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          disabled={disabled}
          aria-label="Abrir calendário para seleção de data"
          className="absolute right-2 text-muted-foreground hover:text-foreground p-1 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 transition-colors"
        >
          <CalendarIcon className="h-4 w-4" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1.5 w-72 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg animate-fade-in">
          {/* Calendar Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-sm capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground mb-1">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {calendarDays.map((day, idx) => {
              const inCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
              const isCurrentDay = isToday(day);
              const disabledDay = isDayDisabled(day);

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={disabledDay}
                  onClick={() => handleSelectDay(day)}
                  className={cn(
                    'h-8 w-8 mx-auto flex items-center justify-center rounded-md text-xs font-medium transition-colors',
                    !inCurrentMonth && 'text-muted-foreground/40',
                    inCurrentMonth && !isSelected && 'hover:bg-muted text-foreground',
                    isCurrentDay && !isSelected && 'border border-primary text-primary font-semibold',
                    isSelected && 'bg-primary text-primary-foreground font-bold shadow-sm',
                    disabledDay && 'opacity-30 cursor-not-allowed hover:bg-transparent'
                  )}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Calendar Quick Actions */}
          <div className="flex items-center justify-between pt-2 mt-2 border-t text-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-primary"
              onClick={handleToday}
            >
              Hoje
            </Button>
            {displayValue && !required && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={handleClear}
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
