# Worker Dispatch — UI Core (Clients, Procedures, Products)
Working directory initialized.

## 2026-10-20T02:27:46Z
From: 8d6c0e93-207a-4af1-807a-6b80b2ba7746 (Parent Orchestrator)

You are Worker M5 UI Core (Generation 5) for PopoApp.
Your working directory is: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m5_ui_core
Your parent orchestrator is: 8d6c0e93-207a-4af1-807a-6b80b2ba7746

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Mandatory Reading before starting work:
1. `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md` (read completely)
2. `POPOAPP_DEVELOPMENT_SPEC.md` (§28 UX/UI Requirements, §33–§38 Clients, Procedures, Products)
3. `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md`
4. `PROJECT.md`
5. `IMPLEMENTATION_CHECKLIST.md`

Your Exclusive File Write Boundaries:
- `src/app/(authenticated)/clientes/page.tsx`
- `src/app/(authenticated)/clientes/[id]/page.tsx`
- `src/app/(authenticated)/procedimentos/page.tsx`
- `src/app/(authenticated)/produtos/page.tsx`
- Any helper components under `src/components/clientes/`, `src/components/procedimentos/`, `src/components/produtos/`
DO NOT touch files outside these boundaries.

Your Mission:
1. Replace all `@/data/mock/*` imports with genuine API interactions (`/api/clients`, `/api/procedures`, `/api/products`, `/api/lots`, `/api/stock`, `/api/attachments`).
2. `/clientes/page.tsx`:
   - Client list with search by name and normalized CPF.
   - Create/edit client modal: mandatory CPF with mask (`000.000.000-00`) and checksum validation; 1:N emergency contacts (nome, telefone, parentesco); contact fields (telefone, email, dataNascimento, endereco, observacoes); profile photo upload (`/api/clients/[id]/photo`); soft-deactivation toggle (`ativo`/`inativo`).
   - Link each client to `/clientes/[id]`.
3. `/clientes/[id]/page.tsx`:
   - Next.js 15 App Router dynamic route handler (`const { id } = await params;`).
   - Clinical client detail workspace displaying tabs or sections in Brazilian Portuguese:
     - Dados Cadastrais & Contatos de Emergência
     - Histórico de Agendamentos (Appointments)
     - Histórico de Atendimentos & Procedimentos Realizados
     - Produtos Utilizados & Rastreabilidade de Lotes
     - Prontuários (Medical Records)
     - Histórico Financeiro & Pagamentos
     - Documentos & Anexos (file upload & secure streaming `/api/attachments/[id]`)
4. `/procedimentos/page.tsx`:
   - Procedure listing with category filter and active toggle.
   - Create and edit procedure modal: nome, categoria, valor padrão (> 0 per V06), duração estimada em minutos, descrição.
5. `/produtos/page.tsx`:
   - Product catalog listing with low stock indicators.
   - Create product modal.
   - Stock lot intake modal (`/api/products/[id]/lots`): número do lote, validade, quantidade recebida, isReusable toggle. Generates individual StockUnits.
   - Traceable units list with individual unitIdentifier, serialNumber, status, and client assignment if reusable.
6. Verify:
   - Check that ZERO `@/data/mock` imports remain in your owned files.
   - Run `npm run lint`.
   - Run `npm run build`.
   - Run `npx vitest run` to ensure tests continue passing.
7. Write `handoff.md` in your working directory with detailed observations, files modified, and command outputs verbatim.
8. Send completion message to parent (8d6c0e93-207a-4af1-807a-6b80b2ba7746).
