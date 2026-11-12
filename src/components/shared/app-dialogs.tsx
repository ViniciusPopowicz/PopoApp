'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, AlertTriangle, HelpCircle } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
}

export interface PromptOptions {
  title?: string;
  description?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
}

export interface AlertOptions {
  title?: string;
  description: string;
  buttonLabel?: string;
  variant?: 'default' | 'destructive';
}

type ActiveModalState =
  | {
      type: 'confirm';
      options: ConfirmOptions;
      resolve: (value: boolean) => void;
    }
  | {
      type: 'prompt';
      options: PromptOptions;
      resolve: (value: string | null) => void;
    }
  | {
      type: 'alert';
      options: AlertOptions;
      resolve: () => void;
    };

export function useAppDialogs() {
  const [modal, setModal] = React.useState<ActiveModalState | null>(null);
  const [promptValue, setPromptValue] = React.useState('');
  const [promptError, setPromptError] = React.useState<string | null>(null);

  const confirm = React.useCallback(
    (options: ConfirmOptions | string): Promise<boolean> => {
      const normalized: ConfirmOptions =
        typeof options === 'string' ? { description: options } : options;
      return new Promise<boolean>((resolve) => {
        setModal({
          type: 'confirm',
          options: normalized,
          resolve,
        });
      });
    },
    []
  );

  const prompt = React.useCallback(
    (options: PromptOptions | string, defaultValue = ''): Promise<string | null> => {
      const normalized: PromptOptions =
        typeof options === 'string'
          ? { description: options, defaultValue, required: true }
          : { required: true, ...options };
      setPromptValue(normalized.defaultValue ?? '');
      setPromptError(null);
      return new Promise<string | null>((resolve) => {
        setModal({
          type: 'prompt',
          options: normalized,
          resolve,
        });
      });
    },
    []
  );

  const alert = React.useCallback(
    (options: AlertOptions | string): Promise<void> => {
      const normalized: AlertOptions =
        typeof options === 'string'
          ? { description: options, variant: 'destructive' }
          : options;
      return new Promise<void>((resolve) => {
        setModal({
          type: 'alert',
          options: normalized,
          resolve,
        });
      });
    },
    []
  );

  const handleClose = React.useCallback(() => {
    if (!modal) return;
    if (modal.type === 'confirm') {
      modal.resolve(false);
    } else if (modal.type === 'prompt') {
      modal.resolve(null);
    } else {
      modal.resolve();
    }
    setModal(null);
    setPromptError(null);
  }, [modal]);

  const handleConfirm = React.useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!modal) return;

      if (modal.type === 'confirm') {
        modal.resolve(true);
        setModal(null);
      } else if (modal.type === 'prompt') {
        const trimmed = promptValue.trim();
        if (modal.options.required !== false && !trimmed) {
          setPromptError('Este campo é obrigatório para prosseguir.');
          return;
        }
        modal.resolve(trimmed);
        setModal(null);
        setPromptError(null);
      } else {
        modal.resolve();
        setModal(null);
      }
    },
    [modal, promptValue]
  );

  const DialogsNode = React.useMemo(() => {
    if (!modal) return null;

    if (modal.type === 'confirm') {
      const {
        title = 'Confirmar Ação',
        description,
        confirmLabel = 'Confirmar',
        cancelLabel = 'Cancelar',
        variant = 'default',
      } = modal.options;

      return (
        <Dialog open onOpenChange={(open) => !open && handleClose()}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {variant === 'destructive' ? (
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                ) : (
                  <HelpCircle className="h-5 w-5 text-primary shrink-0" />
                )}
                <span>{title}</span>
              </DialogTitle>
              <DialogDescription className="pt-2 whitespace-pre-line text-sm text-muted-foreground">
                {description}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                {cancelLabel}
              </Button>
              <Button
                type="button"
                variant={variant === 'destructive' ? 'destructive' : 'default'}
                onClick={() => handleConfirm()}
              >
                {confirmLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }

    if (modal.type === 'prompt') {
      const {
        title = 'Informação Necessária',
        description,
        label = 'Motivo / Justificativa',
        placeholder = 'Informe o motivo...',
        confirmLabel = 'Confirmar',
        cancelLabel = 'Cancelar',
        variant = 'default',
      } = modal.options;

      return (
        <Dialog open onOpenChange={(open) => !open && handleClose()}>
          <DialogContent className="sm:max-w-[460px]">
            <form onSubmit={handleConfirm}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <span>{title}</span>
                </DialogTitle>
                {description && (
                  <DialogDescription className="pt-1 whitespace-pre-line">
                    {description}
                  </DialogDescription>
                )}
              </DialogHeader>

              <div className="space-y-2 py-4">
                <Label htmlFor="app-prompt-input">{label} *</Label>
                <Input
                  id="app-prompt-input"
                  value={promptValue}
                  onChange={(e) => {
                    setPromptValue(e.target.value);
                    if (promptError) setPromptError(null);
                  }}
                  placeholder={placeholder}
                  autoFocus
                />
                {promptError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {promptError}
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={handleClose}>
                  {cancelLabel}
                </Button>
                <Button
                  type="submit"
                  variant={variant === 'destructive' ? 'destructive' : 'default'}
                >
                  {confirmLabel}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      );
    }

    const {
      title = 'Atenção',
      description,
      buttonLabel = 'Entendi',
      variant = 'destructive',
    } = modal.options;

    return (
      <Dialog open onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle
                className={
                  variant === 'destructive'
                    ? 'h-5 w-5 text-destructive shrink-0'
                    : 'h-5 w-5 text-primary shrink-0'
                }
              />
              <span>{title}</span>
            </DialogTitle>
            <DialogDescription className="pt-2 whitespace-pre-line text-sm text-foreground/90">
              {description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button type="button" onClick={() => handleConfirm()}>
              {buttonLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }, [modal, promptValue, promptError, handleClose, handleConfirm]);

  return {
    confirm,
    prompt,
    alert,
    DialogsNode,
  };
}
