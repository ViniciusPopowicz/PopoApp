# PopoApp — Checklist do 3º Ciclo de Estabilização do MVP (CHECKLIST_2)

Este documento consolida o levantamento completo de requisitos, investigação de arquitetura/banco de dados, causa raiz, componentes impactados, proposta de implementação, dependências, critérios de aceite e testes exigidos para o 3º Ciclo de Estabilização do MVP do PopoApp.

---

## 1. BUG-010 — Prontuário: Intercorrências ou Reações Adversas não são persistidas ou recuperadas corretamente

- **Requirement ID:** `BUG-010`
- **Módulo / Área Afetada:** Detalhes do Atendimento (`/atendimentos/[id]`) → Aba Prontuário (`MedicalRecord`)
- **Severidade:** Alta
- **Comportamento Atual:**
  - Ao preencher o campo `"Intercorrências ou Reações Adversas"` e salvar o prontuário, o texto é gravado na coluna `observacoes` da tabela `MedicalRecord` com o prefixo `[Intercorrências]: ...` pelo schema `createMedicalRecordSchema` / `updateMedicalRecordSchema`.
  - Contudo, ao reabrir o atendimento ou recarregar a página, `GET /api/attendances/[id]/record` retorna o objeto bruto do Prisma (`queixaPrincipal`, `avaliacaoClinica`, `condutaProcedimento`, `orientacoes`, `observacoes`), sem a propriedade `intercorrencias`.
  - No componente `src/components/atendimentos/attendance-medical-record-section.tsx` (linha 47), a hidratação executa `setIntercorrencias(json.data.intercorrencias || '')`, que sempre resulta em `''` (vazio).
  - Além disso, quando o usuário apaga todo o conteúdo de um campo e salva, o frontend envia `intercorrencias.trim() || undefined`, omitindo a chave do payload `PUT` e impedindo a limpeza do valor salvo anteriormente.
- **Comportamento Esperado:**
  - O conteúdo inserido em `"Intercorrências ou Reações Adversas"` deve ser persistido no banco de dados e, ao reabrir/atualizar o prontuário, deve ser recuperado e exibido exatamente no campo correspondente.
  - Valores vazios devem ser tratados corretamente (permitindo limpar o campo sem afetar outros campos do prontuário).
- **Causa Raiz / Achados da Investigação:**
  1. Dessincronia entre os nomes de campos do formulário/DTO (`intercorrencias`, `anamnese`, `evolucaoClinica`, `orientacoesPosProcedimento`) e as colunas da tabela `MedicalRecord` (`queixaPrincipal`, `avaliacaoClinica`, `condutaProcedimento`, `orientacoes`, `observacoes`).
  2. `MedicalRecordService` retorna o registro bruto do Prisma sem serializar/extrair `intercorrencias` a partir de `observacoes`.
  3. `attendance-medical-record-section.tsx` envia `undefined` quando o campo é esvaziado, em vez de string vazia `""` / `null`.
  4. Quando `MedicalRecordService.createMedicalRecord` ou `updateByAttendanceId` é invocado diretamente sem passar por `createMedicalRecordSchema.parse`, campos de alias como `intercorrencias` não eram normalizados no service.
- **Arquivos e Componentes Envolvidos:**
  - `src/schemas/medical-record.ts`
  - `src/services/medical-record.service.ts`
  - `src/types/medical-record.ts`
  - `src/components/atendimentos/attendance-medical-record-section.tsx`
  - `src/components/clientes/client-workspace.tsx`
- **Implementação Proposta:**
  - Em `src/schemas/medical-record.ts` e `src/services/medical-record.service.ts`:
    - Normalizar a entrada tanto na camada de schema quanto na camada de serviço (`normalizeMedicalRecordInput`), suportando `intercorrencias` (incluindo string vazia `""` para limpar o valor no `PUT`).
    - Adicionar serializador `enrichMedicalRecord(record)` em `MedicalRecordService` para retornar tanto as colunas canônicas do Prisma quanto os atributos de domínio esperados pelo frontend (`anamnese`, `evolucaoClinica`, `orientacoesPosProcedimento`, `intercorrencias`), extraindo o conteúdo de `[Intercorrências]: ...` de `observacoes` de forma limpa e preservando compatibilidade com `observacoes` legadas.
  - Em `src/components/atendimentos/attendance-medical-record-section.tsx`:
    - Enviar strings aparadas (`trim()`) no payload de `PUT` para permitir limpeza explícita de campos.
    - Hidratar `intercorrencias` usando `json.data.intercorrencias ?? ''`.
- **Dependências:** Relacionado diretamente ao `BUG-011` (mesmo fluxo de dados do `MedicalRecord`). Não requer migração de schema.
- **Critérios de Aceite:**
  - O campo pode ser preenchido e salvo com sucesso.
  - A informação permanece persistida após atualizar a página e reabrir o atendimento.
  - Salvar outros campos do prontuário não apaga nem sobrescreve este campo.
  - Limpar o campo e salvar persiste o estado vazio sem afetar os demais campos.
- **Testes Exigidos:**
  - Teste automatizado de integração criando atendimento e prontuário no banco isolado `PopoAppTest`, salvando `"Intercorrências ou Reações Adversas"`, recuperando pelo fluxo real (`getByAttendanceId` / API) e verificando persistência, recuperação e atualização/limpeza independente.

---

## 2. BUG-011 — Prontuário: Conteúdo de Anamnese aparece no campo Evolução Clínica

- **Requirement ID:** `BUG-011`
- **Módulo / Área Afetada:** Detalhes do Atendimento (`/atendimentos/[id]`) → Aba Prontuário (`MedicalRecord`)
- **Severidade:** Alta
- **Comportamento Atual:**
  - Ao preencher `"Anamnese / Queixa Principal"`, salvar e reabrir/atualizar o atendimento, o texto salvo aparece no campo `"Evolução Clínica e Conduta do Procedimento"`, enquanto `"Anamnese / Queixa Principal"` fica em branco.
- **Comportamento Esperado:**
  - Cada campo do prontuário deve persistir e recuperar sua própria informação de forma totalmente independente.
  - O conteúdo salvo em `"Anamnese / Queixa Principal"` deve sempre aparecer em `"Anamnese / Queixa Principal"`.
  - O conteúdo salvo em `"Evolução Clínica e Conduta do Procedimento"` deve sempre aparecer em `"Evolução Clínica e Conduta do Procedimento"`.
- **Causa Raiz / Achados da Investigação:**
  1. Em `src/schemas/medical-record.ts`: quando o frontend enviava `{ anamnese: "..." }` sem enviar `queixaPrincipal`, `createMedicalRecordSchema` mapeava `queixaPrincipal: data.queixaPrincipal || null` (ficando `NULL` no banco!) e `avaliacaoClinica: data.avaliacaoClinica || data.anamnese || null` (gravando a anamnese em `avaliacaoClinica`).
  2. Em `src/components/atendimentos/attendance-medical-record-section.tsx` (linhas 44–45):
     - `setAnamnese(json.data.anamnese || json.data.queixaPrincipal || '')` recebia `queixaPrincipal = null` e `anamnese = undefined`, ficando vazio `''`.
     - `setEvolucaoClinica(json.data.evolucaoClinica || json.data.condutaProcedimento || json.data.avaliacaoClinica || '')` caía no fallback `|| json.data.avaliacaoClinica`, exibindo o texto da Anamnese dentro de `"Evolução Clínica e Conduta do Procedimento"`!
- **Arquivos e Componentes Envolvidos:**
  - `src/schemas/medical-record.ts`
  - `src/services/medical-record.service.ts`
  - `src/components/atendimentos/attendance-medical-record-section.tsx`
  - `src/lib/db-bootstrap.ts`
- **Implementação Proposta:**
  - Em `src/schemas/medical-record.ts` e `src/services/medical-record.service.ts`:
    - Mapear `anamnese` para `queixaPrincipal` (quando `queixaPrincipal` não for informado separadamente) e manter `avaliacaoClinica` sincronizado para retrocompatibilidade com testes legados (`F22.2`).
    - Mapear `evolucaoClinica` exclusivamente para `condutaProcedimento`.
    - No `enrichMedicalRecord(record)`:
      - `anamnese`: `record.queixaPrincipal ?? record.avaliacaoClinica ?? null`
      - `evolucaoClinica`: `record.condutaProcedimento ?? null` (jamais fazendo fallback para `avaliacaoClinica`).
  - Em `src/components/atendimentos/attendance-medical-record-section.tsx`:
    - Remover `|| json.data.avaliacaoClinica` de `setEvolucaoClinica`.
    - Hidratar `setAnamnese(json.data.anamnese ?? json.data.queixaPrincipal ?? json.data.avaliacaoClinica ?? '')` e `setEvolucaoClinica(json.data.evolucaoClinica ?? json.data.condutaProcedimento ?? '')`.
  - Em `src/lib/db-bootstrap.ts`:
    - Adicionar backfill seguro idempotente: `UPDATE [dbo].[MedicalRecord] SET [queixaPrincipal] = [avaliacaoClinica] WHERE [queixaPrincipal] IS NULL AND [avaliacaoClinica] IS NOT NULL`.
- **Dependências:** Compartilha camada de serviço e schema com `BUG-010`.
- **Critérios de Aceite:**
  - Cada campo possui valor independente.
  - Salvar Anamnese não modifica Evolução Clínica e vice-versa.
  - Ambos os campos mantêm seus respectivos valores após atualizar a página.
  - Registros existentes são preservados e corrigidos sem corrupção.
- **Testes Exigidos:**
  - Teste automatizado de integração salvando textos distintos em `anamnese` e `evolucaoClinica`, recuperando via serviço/API, verificando que cada propriedade retorna seu valor exato sem troca, e atualizando um campo individualmente garantindo que o outro permanece inalterado.

---

## 3. BUG-012 — Atendimento: Erro HTTP 500 intermitente ao estornar consumo de produto

- **Requirement ID:** `BUG-012`
- **Módulo / Área Afetada:** Detalhes do Atendimento (`/atendimentos/[id]`) → Aba Produtos / Estoque (`ProductUsage`)
- **Severidade:** Média
- **Comportamento Atual:**
  - Ao tentar estornar um registro de consumo de produto (`POST /api/attendances/[id]/usages/[usageId]/reverse`), a API ocasionalmente retorna `HTTP 500`, exigindo múltiplas tentativas até concluir.
- **Comportamento Esperado:**
  - O estorno de consumo de produto deve executar de forma confiável, atômica e idempotente, sem erros HTTP 500 intermitentes.
  - O saldo do lote (`ProductLot`), saldo da unidade (`StockUnit`), status do consumo (`ProductUsage`) e movimentação de rastreabilidade (`InventoryMovement`) devem permanecer 100% consistentes.
- **Causa Raiz / Achados da Investigação:**
  1. `src/services/stock.service.ts` não invocava `await ensureDatabaseSchema()` antes das operações.
  2. `reverseProductUsage` abria uma transação interativa `prisma.$transaction` com timeout padrão curto do Prisma (`maxWait: 2000ms`, `timeout: 5000ms`) e executava dentro dela duas consultas pesadas com 6–7 `JOIN`s (`include: { product, lot, stockUnit, attendance: { client } }`) além de 4 escritas. Sob latência de conexão do SQL Server LocalDB / proxy de named pipe ou contenção de lock, a transação sofria timeout (`P2028`) ou falha transitória (`P2034` / `P2024`), caindo no bloco `catch` genérico da rota como HTTP 500.
  3. Falha de concorrência/idempotência: `reverseProductUsage` verificava `if (usage.status === 'Estornado')` com leitura simples (`findUnique`), incrementava os saldos de `ProductLot` e `StockUnit`, e só no final atualizava `ProductUsage.status = 'Estornado'` sem cláusula condicional `where: { status: { not: 'Estornado' } }`. Requisições concorrentes/repetidas podiam passar na leitura inicial simultaneamente ou colidir em deadlock.
  4. No frontend (`attendance-product-usages-section.tsx`), o botão de estorno usava `prompt()` nativo e não bloqueava cliques repetidos por item (`reversingId`).
- **Arquivos e Componentes Envolvidos:**
  - `src/services/stock.service.ts`
  - `src/app/api/attendances/[id]/usages/[usageId]/reverse/route.ts`
  - `src/app/api/stock/movements/[id]/reverse/route.ts`
  - `src/components/atendimentos/attendance-product-usages-section.tsx`
- **Implementação Proposta:**
  - Em `src/services/stock.service.ts`:
    - Invocar `await ensureDatabaseSchema()`.
    - Implementar helper `withTransactionRetry` para transações Prisma com `{ maxWait: 10000, timeout: 20000 }` e retry automático com backoff para erros transitórios de banco/conexão/deadlock (`P2028`, `P2034`, `P2024`, `P1001`, `P1002`, `P1008`, `P1017`).
    - Em `reverseProductUsage`: dentro da transação, executar **primeiro** uma atualização condicional atômica (`tx.productUsage.updateMany({ where: { id: usageId, status: { not: 'Estornado' } }, data: { status: 'Estornado', reversedAt: now, reversalReason: reason } })`). Se `count === 0`, lançar `ValidationError('Este consumo de produto já foi estornado')` (400), impedindo restauração duplicada de estoque mesmo em requisições simultâneas (`Promise.all`).
    - Ler os saldos atuais de `ProductLot` e `StockUnit` dentro da transação antes de incrementá-los e criar o registro de `InventoryMovement` (`Entrada`, `Estorno`).
  - Nas rotas de API (`/api/attendances/[id]/usages/[usageId]/reverse` e `/api/stock/movements/[id]/reverse`):
    - Adicionar log estruturado (`console.error`) para diagnóstico e tratar `DomainError` tanto por `instanceof` quanto por `statusCode`.
  - No frontend (`src/components/atendimentos/attendance-product-usages-section.tsx`):
    - Substituir `prompt()`/`alert()` por modal de confirmação com campo obrigatório de motivo, estado de carregamento (`reversingLoading`) e desabilitação de botão durante a requisição.
- **Dependências:** Conecta-se com `MELHORIA-017` (substituição de `prompt`/`alert` nativos).
- **Critérios de Aceite:**
  - Estorno de consumo funciona consistentemente sem HTTP 500.
  - Saldos de estoque são restaurados exatamente uma vez.
  - Tentativas repetidas ou concorrentes de estorno retornam erro de domínio (400) e não duplicam saldo.
  - Falha no meio da transação faz rollback integral sem atualização parcial.
- **Testes Exigidos:**
  - Testes automatizados cobrindo: (1) estorno com sucesso, (2) restauração exata do saldo de lote e unidade, (3) atualização de status e rastreabilidade (`InventoryMovement`), (4) tentativas repetidas e concorrentes sem duplicar estoque, (5) falha induzida na transação garantindo rollback completo sem atualização parcial.

---

## 4. MELHORIA-015 — Detalhes do Cliente: Links de navegação para Agendamentos, Atendimentos, Produtos e Prontuários

- **Requirement ID:** `MELHORIA-015`
- **Módulo / Área Afetada:** Detalhes do Cliente (`src/components/clientes/client-workspace.tsx`) → Abas Agendamentos, Atendimentos, Produtos e Prontuários
- **Comportamento Atual:**
  - Nas abas de histórico do cliente (`Agendamentos`, `Atendimentos`, `Produtos`, `Prontuários`), os registros são listados apenas para leitura estática, sem botão de ação rápida (ícone de visualização/olho) para navegar diretamente ao registro correspondente.
- **Comportamento Esperado:**
  - Adicionar botão de ação com ícone de olho (`Eye`) em cada item de:
    1. **Agendamentos:** navega para a Agenda abrindo os detalhes do agendamento (`/agenda?appointmentId={id}`).
    2. **Atendimentos:** navega para os detalhes do atendimento (`/atendimentos/{id}`).
    3. **Produtos:** navega para o módulo de Produtos abrindo a ficha detalhada do produto (`/produtos?productId={productId}`).
    4. **Prontuários:** navega para o atendimento correspondente (`/atendimentos/{attendanceId}`) utilizando o relacionamento `MedicalRecord.attendanceId` já existente no banco de dados.
- **Causa Raiz / Achados da Investigação:**
  - Inspeção do `prisma/schema.prisma` (linhas 161–177) confirma que `MedicalRecord` já possui `attendanceId String @unique` com FK para `Attendance.id`. Na aba `Prontuários` de `client-workspace.tsx` (linha 894), a lista já itera diretamente sobre os `attendances` do cliente que possuem `medicalRecord` (`att.id` é o próprio ID do atendimento!). Portanto, **nenhuma alteração de schema ou migração é necessária** e o botão de navegação deve ser incluído também em `Prontuários`.
- **Arquivos e Componentes Envolvidos:**
  - `src/components/clientes/client-workspace.tsx`
  - `src/app/(authenticated)/agenda/page.tsx` (suporte ao query param `?appointmentId=` para abrir automaticamente o modal de Detalhes do Agendamento)
  - `src/app/(authenticated)/produtos/page.tsx` (suporte ao query param `?productId=` para abrir automaticamente o `ProductDetailSheet` do produto)
- **Implementação Proposta:**
  - Em `src/components/clientes/client-workspace.tsx`: adicionar botão de ação (`Eye` / `"Visualizar"`) com `title` e `aria-label` acessíveis em cada linha/card das abas `Agendamentos`, `Atendimentos`, `Produtos` (tanto no histórico de consumo quanto nas unidades reutilizáveis, quando `productId` existir) e `Prontuários`.
  - Em `src/app/(authenticated)/agenda/page.tsx`: ler `searchParams.get('appointmentId')`; se presente, buscar/selecionar o agendamento correspondente e abrir o popup de detalhes.
  - Em `src/app/(authenticated)/produtos/page.tsx`: ler `searchParams.get('productId')`; se presente, selecionar o produto correspondente e abrir `ProductDetailSheet`.
- **Dependências:** Nenhuma alteração de banco de dados.
- **Critérios de Aceite:**
  - Ícone de olho (`Eye`) visível e alinhado nas 4 abas (Agendamentos, Atendimentos, Produtos, Prontuários).
  - Clicar no ícone abre diretamente o registro correspondente.
  - Zero alterações no schema do banco de dados.
- **Testes Exigidos:**
  - Validação de compilação TypeScript, build das rotas e verificação de links gerados.

---

## 5. MELHORIA-019 — Agendamentos: Exibir Duração Estimada Total

- **Requirement ID:** `MELHORIA-019`
- **Módulo / Área Afetada:** Agenda (`src/app/(authenticated)/agenda/page.tsx`) → Modal Novo Agendamento e Popup Detalhes do Agendamento
- **Comportamento Atual:**
  - Ao selecionar procedimentos no modal de Novo Agendamento ou visualizar um agendamento existente no popup de Detalhes do Agendamento, cada procedimento exibe sua duração individual (`duracaoMinutos`), mas não há um campo consolidando a **Duração Estimada Total** do agendamento.
- **Comportamento Esperado:**
  - No modal **Novo Agendamento**: exibir um campo somente leitura/desabilitado (`"Duração Estimada Total"`) que soma dinamicamente a duração (`duracaoMinutos`) de todos os procedimentos selecionados à medida que são adicionados ou removidos.
  - No popup **Detalhes do Agendamento**: exibir a `"Duração Estimada Total"` correspondente à soma das durações dos procedimentos vinculados ao agendamento.
- **Causa Raiz / Achados da Investigação:**
  - O catálogo de procedimentos e a relação `AppointmentProcedure` (`plannedProcedures`) já trazem `procedure.duracaoMinutos` na resposta da API `/api/appointments` e `/api/procedures`, faltando apenas o helper de cálculo consolidado e a exibição nos dois modais.
- **Arquivos e Componentes Envolvidos:**
  - `src/lib/format.ts` (funções puras `calculateEstimatedDurationMinutes` e `formatDurationMinutes`)
  - `src/app/(authenticated)/agenda/page.tsx`
- **Implementação Proposta:**
  - Criar em `src/lib/format.ts`:
    - `calculateEstimatedDurationMinutes(items)`: soma de forma segura `duracaoMinutos` (tratando `null`, `undefined`, `0`, valores negativos ou entradas inválidas sem `NaN`).
    - `formatDurationMinutes(totalMinutes)`: formata de maneira clara e consistente (ex.: `0 min`, `45 min`, `60 min (1h)`, `90 min (1h 30min)`).
  - Em `src/app/(authenticated)/agenda/page.tsx`:
    - No modal de Novo Agendamento: exibir campo `Input` desabilitado/read-only `"Duração Estimada Total"` atualizado em tempo real conforme `formProcedureIds` muda.
    - No popup de Detalhes do Agendamento: exibir bloco/campo `"Duração Estimada Total"` calculado a partir de `selectedAppointment.plannedProcedures` (com fallback para `selectedAppointment.procedure`).
- **Dependências:** Nenhuma.
- **Critérios de Aceite:**
  - Campo somente leitura no modal de criação atualiza dinamicamente ao adicionar/remover procedimentos.
  - Popup de detalhes exibe a duração total estimada correta.
  - Trata corretamente 0 procedimentos, 1 procedimento, múltiplos procedimentos e procedimentos com duração 0/ausente.
- **Testes Exigidos:**
  - Testes automatizados cobrindo 1 procedimento, múltiplos procedimentos, remoção de procedimento, lista vazia e procedimento com duração ausente/zero.

---

## 6. MELHORIA-018 — Financeiro do Atendimento: Remover indicador redundante de Saldo Devedor

- **Requirement ID:** `MELHORIA-018`
- **Módulo / Área Afetada:** Detalhes do Atendimento → Aba Financeiro (`src/components/atendimentos/attendance-financial-section.tsx`)
- **Comportamento Atual:**
  - No cabeçalho do card `"Resumo Financeiro do Atendimento"`, ao lado do botão `"Registrar Pagamento"`, existe um badge redundante exibindo `Quitado` ou `Saldo Devedor: R$ ...` (linhas 278–289), informação que já é exibida logo abaixo no grid de 6 colunas (`Saldo Devedor` e `Status Geral`).
- **Comportamento Esperado:**
  - Remover o indicador/badge redundante ao lado do botão `"Registrar Pagamento"`, mantendo o botão `"Registrar Pagamento"` e o resumo financeiro principal de 6 colunas intactos.
- **Arquivos e Componentes Envolvidos:**
  - `src/components/atendimentos/attendance-financial-section.tsx`
- **Implementação Proposta:**
  - Remover o bloco condicional `{ financialSummary.RemainingBalance <= 0 ? ... : ... }` das linhas 278–289 de `attendance-financial-section.tsx`, preservando o botão `"Registrar Pagamento"` com alinhamento limpo no cabeçalho do card.
- **Dependências:** Nenhuma.
- **Critérios de Aceite:**
  - Indicador duplicado ao lado do botão `"Registrar Pagamento"` removido.
  - Resumo financeiro principal continua visível e funcional.
  - Fluxo de registro de pagamento permanece inalterado.
- **Testes Exigidos:**
  - Verificação de compilação, regressão e inspeção do componente.

---

## 7. MELHORIA-014 — Padronização Global de Tipografia para CPF, Telefone e Campos Numéricos

- **Requirement ID:** `MELHORIA-014`
- **Módulo / Área Afetada:** Global (Clientes, Atendimentos, Produtos, Tabelas e Fichas)
- **Comportamento Atual:**
  - Diversos componentes aplicam a classe utilitária `font-mono` em células e badges de CPF, telefone, quantidades e valores numéricos (`src/app/(authenticated)/clientes/page.tsx`, `src/components/clientes/client-workspace.tsx`, `src/app/(authenticated)/produtos/page.tsx`, `src/components/atendimentos/attendance-product-usages-section.tsx`), criando inconsistência visual com a tipografia sans-serif padrão (`Plus Jakarta Sans`) do restante do sistema.
- **Comportamento Esperado:**
  - Todos os campos de CPF, telefone, quantidades, valores monetários, datas e identificadores numéricos devem utilizar a mesma família tipográfica padrão da aplicação (sans-serif), preservando integralmente as máscaras e formatações (`000.000.000-00`, `(00) 00000-0000`, `R$`, etc.).
- **Arquivos e Componentes Envolvidos:**
  - `src/app/(authenticated)/clientes/page.tsx`
  - `src/components/clientes/client-workspace.tsx`
  - `src/app/(authenticated)/produtos/page.tsx`
  - `src/components/atendimentos/attendance-product-usages-section.tsx`
- **Implementação Proposta:**
  - Remover todas as classes `font-mono` aplicadas a CPF, telefone, quantidades, lotes, datas e valores numéricos nos componentes listados, mantendo os tamanhos (`text-xs`, `text-sm`), pesos (`font-medium`, `font-semibold`) e máscaras intactos.
- **Dependências:** Nenhuma.
- **Critérios de Aceite:**
  - CPF, telefone e campos numéricos seguem a tipografia padrão do sistema em todas as telas, tabelas, cards e modais.
  - Máscaras e regras de validação permanecem inalteradas.
- **Testes Exigidos:**
  - Auditoria automatizada no código-fonte (`Select-String font-mono`) e validação de regressão.

---

## 8. MELHORIA-016 — Popup Detalhes do Agendamento: Tag de Status sobrepondo o botão Fechar (X)

- **Requirement ID:** `MELHORIA-016`
- **Módulo / Área Afetada:** Agenda (`src/app/(authenticated)/agenda/page.tsx`) → Popup Detalhes do Agendamento
- **Comportamento Atual:**
  - No cabeçalho do `DialogContent` de Detalhes do Agendamento (linhas 984–990), a `<div className="flex items-center justify-between">` posiciona o `<StatusBadge>` na extremidade direita (`right`), exatamente onde o botão `<DialogPrimitive.Close>` (`absolute right-4 top-4`) é renderizado pelo componente `DialogContent`, causando sobreposição visual e de clique.
- **Comportamento Esperado:**
  - O `<StatusBadge>` e o botão de fechar (`X`) devem possuir espaçamento adequado (`pr-8`), sem qualquer sobreposição em resoluções desktop ou mobile.
- **Arquivos e Componentes Envolvidos:**
  - `src/app/(authenticated)/agenda/page.tsx`
- **Implementação Proposta:**
  - Adicionar `pr-8 gap-3 flex-wrap` na linha superior do `DialogHeader` do modal de Detalhes do Agendamento para reservar espaço suficiente à direita antes do botão `X` absoluto do `DialogContent`.
- **Dependências:** Nenhuma.
- **Critérios de Aceite:**
  - A tag de status não sobrepõe o botão `X`.
  - O botão `X` permanece claramente visível e clicável em desktop e mobile.
- **Testes Exigidos:**
  - Validação estrutural e responsiva do cabeçalho do modal.

---

## 9. MELHORIA-017 — Padronizar Popups de Confirmação e Alerta em toda a Aplicação

- **Requirement ID:** `MELHORIA-017`
- **Módulo / Área Afetada:** Global (`agenda`, `financeiro`, `procedimentos`, `client-workspace`, `attendance-header`, `attendance-procedures-section`, `attendance-product-usages-section`, `attendance-financial-section`, `attendance-attachments-section`)
- **Comportamento Atual:**
  - A aplicação utiliza chamadas nativas do navegador `window.confirm()`, `window.alert()` e `window.prompt()` em 9 arquivos para confirmações destrutivas, solicitação de motivo de estorno e exibição de erros.
- **Comportamento Esperado:**
  - Substituir todas as chamadas nativas `alert()`, `confirm()` e `prompt()` por componentes modais padronizados da aplicação (`Dialog` / `AlertDialog`), com suporte a:
    - Título e descrição claros;
    - Botões de confirmação e cancelamento com variante semântica (`default` ou `destructive`);
    - Campo de entrada opcional/obrigatório (ex.: motivo de estorno) com validação;
    - Estado de carregamento (`loading`) evitando submissões duplicadas;
    - Exibição de erros inline ou em modal de feedback padronizado;
    - Acessibilidade por teclado (`Escape`, foco).
- **Arquivos e Componentes Envolvidos:**
  - Novo componente reutilizável: `src/components/shared/app-dialogs.tsx` (provendo `AppConfirmDialog`, `AppPromptDialog`, `AppAlertModal` e hook imperativo/declarativo `useAppDialogs`)
  - `src/app/(authenticated)/agenda/page.tsx`
  - `src/app/(authenticated)/financeiro/page.tsx`
  - `src/app/(authenticated)/procedimentos/page.tsx`
  - `src/components/clientes/client-workspace.tsx`
  - `src/components/atendimentos/attendance-header.tsx`
  - `src/components/atendimentos/attendance-procedures-section.tsx`
  - `src/components/atendimentos/attendance-product-usages-section.tsx`
  - `src/components/atendimentos/attendance-financial-section.tsx`
  - `src/components/atendimentos/attendance-attachments-section.tsx`
- **Implementação Proposta:**
  - Criar `src/components/shared/app-dialogs.tsx` baseado nos componentes Radix `Dialog` e `AlertDialog` do design system da aplicação, permitindo abrir modais de confirmação (`confirm`), solicitação de texto/motivo (`prompt` com validação de campo obrigatório) e alerta de erro/aviso (`alert`) com estado de loading e acessibilidade por teclado.
  - Substituir 100% das ocorrências de `alert(`, `confirm(` e `prompt(` nos 9 arquivos identificados.
- **Dependências:** Relacionado ao fluxo de estorno de `BUG-012`.
- **Critérios de Aceite:**
  - Nenhuma chamada nativa `window.alert`, `window.confirm` ou `window.prompt` permanece ativa nos fluxos da aplicação.
  - Todos os diálogos seguem o padrão visual do PopoApp.
- **Testes Exigidos:**
  - Auditoria automatizada (`Select-String`) confirmando zero chamadas nativas `alert/confirm/prompt` em `src/`.

---

## 10. MELHORIA-020 — Lembretes: Melhoria de Layout da Lista e Visão Alternativa em Kanban

- **Requirement ID:** `MELHORIA-020` (Parte A e Parte B)
- **Módulo / Área Afetada:** Lembretes (`src/app/(authenticated)/lembretes/page.tsx`)
- **Comportamento Atual:**
  - **Parte A:** Os lembretes na visualização em lista são renderizados com `divide-y` simples dentro de uma `div` única, com pouca separação visual entre itens adjacentes.
  - **Parte B:** Existe apenas a visualização em lista; não há opção de visualização em quadro Kanban agrupado por status.
- **Comportamento Esperado:**
  - **Parte A (Layout da Lista):** Cada lembrete deve ser exibido em um card individual claramente delimitado, com borda, espaçamento consistente, indicador lateral de status/prioridade, hierarquia tipográfica clara para título, descrição, data de vencimento, vínculo (cliente/atendimento) e ações rápidas.
  - **Parte B (Visão Kanban):**
    - Adicionar seletor de visualização (`Lista` | `Kanban`) no cabeçalho da barra de filtros.
    - Agrupar os lembretes nas colunas correspondentes aos status reais do sistema:
      1. **Pendentes** (`pendente`)
      2. **Concluídos** (`concluido`)
      3. **Dispensados** (`dispensado`)
    - Cada coluna deve exibir título, badge com contagem de itens, estado vazio informativo quando não houver itens, e cards completos contendo título, descrição/resumo, data/status de atraso, cliente vinculado e botões de ação (concluir, dispensar, reativar, editar, excluir).
    - A busca textual e os filtros devem funcionar de maneira integrada e consistente entre as duas visualizações.
- **Arquivos e Componentes Envolvidos:**
  - `src/app/(authenticated)/lembretes/page.tsx`
  - `src/schemas/reminder.ts` (ou helper exportado para agrupamento/filtragem de lembretes por coluna Kanban e ordenação)
- **Implementação Proposta:**
  - Extrair helper puro `groupRemindersByKanbanColumn(reminders)` (em `src/schemas/reminder.ts`) para agrupar lembretes nas 3 colunas (`pendente`, `concluido`, `dispensado`) mantendo ordenação por data de vencimento, permitindo testes automatizados diretos além da camada de serviço/API.
  - Atualizar `src/app/(authenticated)/lembretes/page.tsx`:
    - Na visão `Lista`, renderizar cada lembrete como um card individual com borda, sombra sutil no hover, faixa lateral semântica (vermelho se atrasado, âmbar se pendente no prazo, esmeralda se concluído, cinza se dispensado) e ações organizadas.
    - Adicionar alternador de visão `Lista` / `Kanban`. Quando em `Kanban`, exibir todos os status nas 3 colunas (ajustando o carregamento/filtragem para que as 3 colunas possam exibir seus respectivos itens simultaneamente ou respeitar o filtro selecionado), permitindo concluir, dispensar, reativar, editar e excluir diretamente dos cards do Kanban.
- **Dependências:** Nenhuma alteração de banco de dados.
- **Critérios de Aceite:**
  - Itens da lista possuem separação visual clara em cards.
  - Usuário pode alternar entre Lista e Kanban sem perda de contexto.
  - Colunas do Kanban refletem com precisão os status `pendente`, `concluido` e `dispensado`.
  - Atualizações de status movem o lembrete imediatamente para a coluna correta.
- **Testes Exigidos:**
  - Testes automatizados cobrindo renderização/agrupamento em Lista e Kanban, agrupamento por status nas colunas, transição de status movendo o item entre colunas e comportamento de coluna vazia.
