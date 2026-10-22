'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  Camera,
  FileText,
  Trash2,
  Download,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { formatDate } from '@/lib/format';

interface AttachmentItem {
  id: string;
  nomeOriginal: string;
  mimeType: string;
  tamanhoBytes: number;
  categoria?: string | null;
  createdAt: string;
}

interface AttendanceAttachmentsSectionProps {
  attendanceId: string;
  status: 'Pendente' | 'Realizado' | 'Cancelado';
}

export function AttendanceAttachmentsSection({
  attendanceId,
  status,
}: AttendanceAttachmentsSectionProps) {
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<'foto_antes' | 'foto_depois' | 'documento'>('foto_antes');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditable = status !== 'Cancelado';

  const loadAttachments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/attachments?attendanceId=${attendanceId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.attachments) {
          setAttachments(json.attachments);
        }
      }
    } catch (err: any) {
      console.error('Error loading attachments:', err);
      setError('Erro ao carregar anexos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('attendanceId', attendanceId);
      formData.append('categoria', selectedCategory);

      const res = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao enviar anexo.');
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await loadAttachments();
    } catch (err: any) {
      setError(err.message || 'Falha no upload do anexo.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este anexo permanentemente?')) return;
    try {
      const res = await fetch(`/api/attachments/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao excluir anexo.');
      }
      await loadAttachments();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir anexo.');
    }
  };

  const getCategoryBadge = (cat?: string | null) => {
    switch (cat) {
      case 'foto_antes':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">Foto Antes</Badge>;
      case 'foto_depois':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Foto Depois</Badge>;
      default:
        return <Badge variant="outline">Documento</Badge>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Fotos Antes/Depois e Documentos
          </CardTitle>
          <CardDescription>
            Armazenamento clínico de imagens comparativas e termos de consentimento.
          </CardDescription>
        </div>

        {isEditable && (
          <div className="flex items-center gap-2">
            <Select
              value={selectedCategory}
              onValueChange={(v) => setSelectedCategory(v as any)}
            >
              <SelectTrigger className="w-[140px] text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="foto_antes">Foto Antes</SelectItem>
                <SelectItem value="foto_depois">Foto Depois</SelectItem>
                <SelectItem value="documento">Documento</SelectItem>
              </SelectContent>
            </Select>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,application/pdf"
            />

            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-1.5"
            >
              <Upload className="h-4 w-4" />
              <span>{uploading ? 'Enviando...' : 'Adicionar Arquivo'}</span>
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-destructive/15 text-destructive rounded-md text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {attachments.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm border rounded-lg border-dashed">
            Nenhuma foto ou documento anexado a este atendimento.
            {isEditable && (
              <p className="text-xs text-primary mt-1">
                Adicione fotos de antes e depois para documentação clínica e consentimentos.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {attachments.map((att) => {
              const isImage = att.mimeType.startsWith('image/');
              return (
                <div
                  key={att.id}
                  className="border rounded-lg p-3 flex flex-col justify-between space-y-2 bg-muted/10 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      {isImage ? (
                        <ImageIcon className="h-4 w-4 text-primary flex-shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="text-xs font-medium truncate" title={att.nomeOriginal}>
                        {att.nomeOriginal}
                      </span>
                    </div>
                    {getCategoryBadge(att.categoria)}
                  </div>

                  {isImage && (
                    <div className="h-32 w-full bg-muted/30 rounded overflow-hidden flex items-center justify-center">
                      <a
                        href={`/api/attachments/${att.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="h-full w-full flex items-center justify-center"
                      >
                        {/* We use standard img with preview */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/attachments/${att.id}`}
                          alt={att.nomeOriginal}
                          className="h-full w-full object-cover hover:scale-105 transition-transform"
                        />
                      </a>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-1 border-t text-[11px] text-muted-foreground">
                    <span>{formatFileSize(att.tamanhoBytes)}</span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                        <a
                          href={`/api/attachments/${att.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Visualizar / Baixar"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      {isEditable && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(att.id)}
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
