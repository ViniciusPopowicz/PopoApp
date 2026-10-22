import { Badge } from "@/components/ui/badge"
import { ptBR } from "@/i18n/pt-BR"

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  let variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "error" | "info" = "default"
  
  const normalizedStatus = status.toLowerCase()

  switch (normalizedStatus) {
    case "ativo":
    case "active":
    case "concluido":
    case "concluído":
    case "completed":
    case "confirmado":
    case "pago":
      variant = "success"
      break
    case "pendente":
    case "pending":
    case "em_andamento":
    case "em andamento":
    case "agendado":
      variant = "warning"
      break
    case "inativo":
    case "inactive":
    case "cancelado":
    case "cancelled":
    case "falha":
    case "failed":
    case "nao_compareceu":
    case "não compareceu":
    case "atrasado":
      variant = "error"
      break
    case "rascunho":
    case "draft":
      variant = "secondary"
      break
    default:
      variant = "default"
  }

  const statusMap: Record<string, string> = {
    agendado: ptBR.status.agendado,
    confirmado: ptBR.status.confirmado,
    concluido: ptBR.status.concluido,
    concluído: ptBR.status.concluido,
    cancelado: ptBR.status.cancelado,
    nao_compareceu: ptBR.status.naoCompareceu,
    "não compareceu": ptBR.status.naoCompareceu,
    pendente: ptBR.status.pendente,
    em_andamento: ptBR.status.emAndamento,
    "em andamento": ptBR.status.emAndamento,
    atrasado: ptBR.status.atrasado,
    ativo: ptBR.status.ativo,
    inativo: ptBR.status.inativo,
  }

  const label = statusMap[normalizedStatus] || status

  return <Badge variant={variant}>{label}</Badge>
}
