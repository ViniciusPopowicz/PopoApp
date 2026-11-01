'use client';

import React, { useState, useEffect } from 'react';
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
import { AppCombobox } from '@/components/ui/app-combobox';
import { StockUnitItemDto, StockUnitStatus } from '@/types/product';
import { Loader2, Tag } from 'lucide-react';

interface UnitActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: StockUnitItemDto | null;
  onSuccess: () => void;
}

const UNIT_STATUS_OPTIONS = [
  { value: 'Disponivel', label: 'Disponível' },
  { value: 'EmUso', label: 'Em Uso' },
  { value: 'Esgotado', label: 'Esgotado' },
  { value: 'Descartado', label: 'Descartado / Perda' },
];

export function UnitActionDialog({
  open,
  onOpenChange,
  unit,
  onSuccess,
}: UnitActionDialogProps) {
  const [status, setStatus] = useState<StockUnitStatus>('Disponivel');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && unit) {
      setStatus(unit.status);
      setMotivo(unit.motivoStatus || '');
      setError(null);
    }
  }, [open, unit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/stock/units/${unit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          motivo: motivo.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao atualizar status da unidade.');
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar unidade.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Gerenciar Status da Unidade
          </DialogTitle>
          <DialogDescription>
            Unidade <strong>{unit?.codigoSerial}</strong> ({unit?.productName})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Novo Status *</Label>
            <AppCombobox
              options={UNIT_STATUS_OPTIONS}
              value={status}
              onChange={(val) => setStatus(val as StockUnitStatus)}
              searchable={false}
            />
          </div>

          <div className="space-y-2">
            <Label>Motivo / Observação</Label>
            <Input
              placeholder="Ex.: Descarte por vencimento, ajuste de inventário..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alteração
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
