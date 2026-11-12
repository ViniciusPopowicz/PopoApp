# PopoApp — Plano de Execução do 3º Ciclo de Estabilização do MVP (PLANNING_2)

## 1. Visão Geral e Análise de Arquitetura

O 3º Ciclo de Estabilização do MVP abrange 10 itens (3 correções críticas de integridade de dados e 7 melhorias funcionais, de navegação e de interface).

### Avaliação de Impacto no Banco de Dados (Zero Migrações Necessárias)
- **Prontuário (`MedicalRecord` - BUG-010 / BUG-011):** A tabela `MedicalRecord` possui as colunas `queixaPrincipal`, `avaliacaoClinica`, `condutaProcedimento`, `orientacoes` e `observacoes`. Os defeitos decorrem do mapeamento assimétrico entre os campos de domínio do frontend (`anamnese`, `evolucaoClinica`, `orientacoesPosProcedimento`, `intercorrencias`) e as colunas do Prisma no schema/service/componente. Nenhuma alteração de DDL é necessária; apenas um backfill idempotente (`UPDATE MedicalRecord SET queixaPrincipal = avaliacaoClinica WHERE queixaPrincipal IS NULL AND avaliacaoClinica IS NOT NULL`) em `db-bootstrap.ts` garante consistência imediata para registros legados.
- **Estorno de Consumo de Produto (`ProductUsage` - BUG-012):** As tabelas `ProductUsage`, `ProductLot`, `StockUnit` e `InventoryMovement` já contêm todas as colunas de controle (`status`, `reversedAt`, `reversalReason`). A correção atua na atomicidade transacional (`updateMany` condicional), timeout/retry de transação interativa e chamadas a `ensureDatabaseSchema()`.
- **Relacionamento Prontuário → Atendimento (`MELHORIA-015`):** A coluna `MedicalRecord.attendanceId` (`@unique`, FK para `Attendance.id`) **já existe** no schema atual do banco de dados e já é carregada em `client-workspace.tsx`. Portanto, a navegação para o atendimento gerador do prontuário é implementada integralmente sem qualquer alteração de schema.

---

## 2. Ordem Priorizada de Execução

### Fase 1 — Investigação e Planejamento (Concluída)
- Rastreamento ponta a ponta de todas as rotas, schemas, services, tabelas e componentes.
- Documentação em `Bugs_Improvments/CHECKLIST_2.md` e `Bugs_Improvments/PLANNING_2.md`.

### Fase 2 — Correções de Integridade de Dados de Alta Prioridade
1. **`BUG-010` e `BUG-011` (Prontuário Médico):**
   - Atualizar `src/schemas/medical-record.ts` para mapear de forma determinística e independente `anamnese` (`queixaPrincipal`), `evolucaoClinica` (`condutaProcedimento`), `orientacoesPosProcedimento` (`orientacoes`) e `intercorrencias` (`observacoes`), suportando limpeza explícita de campos (`""` -> `null`).
   - Atualizar `src/services/medical-record.service.ts` com normalização de entrada e enriquecimento de saída (`enrichMedicalRecord`), devolvendo tanto as colunas do banco quanto os campos de domínio `anamnese`, `evolucaoClinica`, `orientacoesPosProcedimento` e `intercorrencias` em todas as operações (`create`, `getById`, `getByAttendanceId`, `update`, `updateByAttendanceId`, `listByClient`).
   - Corrigir a hidratação e o envio do formulário em `src/components/atendimentos/attendance-medical-record-section.tsx` (removendo o fallback indevido `|| json.data.avaliacaoClinica` de `evolucaoClinica` e hidratando `intercorrencias` corretamente).
   - Adicionar backfill idempotente em `src/lib/db-bootstrap.ts`.
2. **`BUG-012` (Estorno de Consumo de Produto — HTTP 500 Intermitente):**
   - Atualizar `src/services/stock.service.ts`:
     - Invocar `await ensureDatabaseSchema()` em todas as operações públicas.
     - Adicionar wrapper `withTransactionRetry` com `{ maxWait: 10000, timeout: 20000 }` e retry automático para falhas transitórias de conexão/lock do SQL Server LocalDB.
     - Tornar `reverseProductUsage` e `reverseInventoryMovement` estritamente atômicos e idempotentes usando `updateMany` condicional (`where: { id, status: { not: 'Estornado' } }`) como primeiro passo da transação, bloqueando qualquer restauração duplicada em requisições concorrentes ou repetidas.
   - Atualizar `src/app/api/attendances/[id]/usages/[usageId]/reverse/route.ts` e `src/app/api/stock/movements/[id]/reverse/route.ts` com logging contextualizado e tratamento resiliente de `DomainError`.

### Fase 3 — Melhorias Funcionais e de Navegação
3. **`MELHORIA-015` (Links de Navegação nos Detalhes do Cliente):**
   - Adicionar botões de visualização (`Eye`) nas abas `Agendamentos`, `Atendimentos`, `Produtos` e `Prontuários` em `src/components/clientes/client-workspace.tsx`.
   - Adicionar suporte a deep-link `?appointmentId=` em `src/app/(authenticated)/agenda/page.tsx` e `?productId=` em `src/app/(authenticated)/produtos/page.tsx`.
4. **`MELHORIA-019` (Duração Estimada Total de Agendamentos):**
   - Implementar `calculateEstimatedDurationMinutes` e `formatDurationMinutes` em `src/lib/format.ts`.
   - Exibir o campo somente leitura `"Duração Estimada Total"` no modal de Novo Agendamento (atualizado dinamicamente) e no popup de Detalhes do Agendamento em `src/app/(authenticated)/agenda/page.tsx`.
5. **`MELHORIA-018` (Remoção de Saldo Devedor Redundante no Financeiro do Atendimento):**
   - Remover o badge duplicado ao lado do botão `"Registrar Pagamento"` em `src/components/atendimentos/attendance-financial-section.tsx`.

### Fase 4 — Melhorias Globais de Interface
6. **`MELHORIA-014` (Padronização Tipográfica Global):**
   - Remover `font-mono` de exibições de CPF, telefone e campos numéricos em `src/app/(authenticated)/clientes/page.tsx`, `src/components/clientes/client-workspace.tsx`, `src/app/(authenticated)/produtos/page.tsx` e `src/components/atendimentos/attendance-product-usages-section.tsx`.
7. **`MELHORIA-016` (Correção de Sobreposição no Header do Popup de Agendamento):**
   - Ajustar espaçamento (`pr-8 gap-3 flex-wrap`) no `DialogHeader` do modal de Detalhes do Agendamento em `src/app/(authenticated)/agenda/page.tsx`.
8. **`MELHORIA-017` (Padronização Global de Popups de Confirmação, Prompt e Alerta):**
   - Criar `src/components/shared/app-dialogs.tsx` (`useAppDialogs`) e substituir todas as chamadas nativas `alert()`, `confirm()` e `prompt()` nos 9 arquivos da aplicação.

### Fase 5 — Melhorias na Interface de Lembretes
9. **`MELHORIA-020` (Parte A: Layout da Lista de Lembretes | Parte B: Visão Kanban):**
   - Adicionar helper `groupRemindersByKanbanColumn` em `src/schemas/reminder.ts`.
   - Reestruturar `src/app/(authenticated)/lembretes/page.tsx` com cards individuais bem delimitados na visão `Lista` e implementar a visão `Kanban` com 3 colunas (`Pendentes`, `Concluídos`, `Dispensados`), alternador de visualização, contadores, estados vazios e ações completas.

### Fase 6 — Testes Automatizados, Validação de Regressão e Relatório Final
10. Criar a suíte automatizada `tests/cycle3_stabilization.spec.ts` validando no banco de testes isolado (`PopoAppTest`):
    - `BUG-010` (persistência, recuperação e limpeza de Intercorrências/Reações Adversas);
    - `BUG-011` (independência estrita entre Anamnese e Evolução Clínica);
    - `BUG-012` (estorno de consumo, restauração de estoque, rastreabilidade, bloqueio de duplicidade/concorrência e rollback atômico em falha);
    - `MELHORIA-019` (cálculo dinâmico de duração estimada total para 0, 1, múltiplos procedimentos e durações nulas/zero);
    - `MELHORIA-020` (agrupamento Kanban por status, transições de status entre colunas e colunas vazias).
11. Executar `npx tsc --noEmit`, `npm run lint`, `npm test` e `npm run build`.
