# 🚀 PopoApp — Guia de Retomada do Desenvolvimento (Resume Guide)

> **Documento de Retomada Rápida e Registro de Trabalho**: Atualizado em 14/10/2026 com o status completo das tarefas executadas, remediações aplicadas e roteiro exato para a próxima sessão.

---

## 1. 📌 Estado Atual do Projeto

- **Status Geral**: **Milestone 2 Remediado com Sucesso & Suíte de Testes 100% Verde**.
- **Instância LocalDB**: Microsoft SQL Server LocalDB (`MSSQLLocalDB`).
  - Base Dev: `PopoApp`
  - Base Testes: `PopoAppTest` (isolado per D7)
- **Proxy LocalDB**: `tests/helpers/localdb-proxy.js` (TCP 1433 -> LocalDB Named Pipe).
- **Suíte de Testes Automatizados (Vitest)**:
  - **18 arquivos de teste executados e 100% passando** (`18 passed`).
  - Testes cobrem: Tier 1 (funcionalidades essenciais), Tier 2 (fronteiras e validações críticas), Tier 3 (máquinas de estado e fluxos combinados), Tier 4 (Cenários A a E da especificação §47) e Tier 5 (testes adversários do Milestone 2).

---

## 2. 🛠️ Trabalho Realizado Nesta Sessão

Durante esta sessão, foram investigados e resolvidos todos os apontamentos críticos identificados na auditoria/revisão do Milestone 2:

1. **Unificação e Isolamento do Banco de Dados (D7)**:
   - Arquivo modificado: [`src/lib/prisma.ts`](file:///c:/Users/Vinicius/PopoApp/PopoApp/src/lib/prisma.ts)
   - Adicionada trava de segurança estrita: sob `NODE_ENV === 'test'`, a conexão rejeita qualquer banco que não seja `PopoAppTest`.
   - Arquivo modificado: [`tests/helpers/db-client.ts`](file:///c:/Users/Vinicius/PopoApp/PopoApp/tests/helpers/db-client.ts)
   - Os testes agora compartilham a mesma instância singleton do Prisma utilizada pelos serviços de domínio, eliminando o problema de "split-brain" (onde testes criavam dados no `PopoAppTest` mas os serviços tentavam acessar o `PopoApp`).

2. **Injeção de Ambiente no Vitest**:
   - Arquivo modificado: [`vitest.config.ts`](file:///c:/Users/Vinicius/PopoApp/PopoApp/vitest.config.ts)
   - Configurada injeção de `.env.test` e `NODE_ENV: 'test'`, garantindo execução com `singleFork: true` para evitar concorrência no LocalDB durante a limpeza de dados entre suítes.

3. **Correção do Limpador de Banco de Dados (`db-cleaner.ts`)**:
   - Arquivo modificado: [`tests/helpers/db-cleaner.ts`](file:///c:/Users/Vinicius/PopoApp/PopoApp/tests/helpers/db-cleaner.ts)
   - Adicionada anulação prévia de chaves estrangeiras autorreferenciadas (`UPDATE [Appointment] SET [rescheduledFromId] = NULL, [rescheduledToId] = NULL`) e fotos de perfil (`UPDATE [Client] SET [profilePhotoId] = NULL`) antes de deletar as tabelas. Isso eliminou erros de SQL Server Msg 547 durante os resets entre testes.

4. **Remediação de Segurança no Middleware (`middleware.ts`)**:
   - Arquivo criado: [`src/lib/session-config.ts`](file:///c:/Users/Vinicius/PopoApp/PopoApp/src/lib/session-config.ts)
   - Arquivo modificado: [`src/middleware.ts`](file:///c:/Users/Vinicius/PopoApp/PopoApp/src/middleware.ts)
   - O middleware agora desencapsula criptograficamente o cookie `popoapp-session` via `unsealData` da `iron-session` e valida `isLoggedIn === true` e `userId`. Requisições com cookies forjados são bloqueadas (redirecionamento para `/login` ou 401 JSON para `/api/*`).
   - Novo teste criado: [`tests/tier2_boundaries/middleware_session.spec.ts`](file:///c:/Users/Vinicius/PopoApp/PopoApp/tests/tier2_boundaries/middleware_session.spec.ts) validando todos os cenários de autorização e rejeição de tokens forjados.

5. **Ajuste de Import no Teste de Validação de CPF**:
   - Arquivo modificado: [`tests/tier2_boundaries/cpf_validation.spec.ts`](file:///c:/Users/Vinicius/PopoApp/PopoApp/tests/tier2_boundaries/cpf_validation.spec.ts)
   - Funções `isValidCpf`, `normalizeCpf` e `formatCpf` passaram a ser importadas diretamente do código de produção ([`src/lib/cpf.ts`](file:///c:/Users/Vinicius/PopoApp/PopoApp/src/lib/cpf.ts)).
   - Semente de `fixtureCounter` em [`tests/helpers/test-fixtures.ts`](file:///c:/Users/Vinicius/PopoApp/PopoApp/tests/helpers/test-fixtures.ts) foi randomizada para prevenir colisões residuais.

6. **Extensão de Arquivos no Armazenamento Seguro (`AttachmentService`)**:
   - Arquivo modificado: [`src/services/attachment.service.ts`](file:///c:/Users/Vinicius/PopoApp/PopoApp/src/services/attachment.service.ts)
   - A extensão no disco agora é mapeada diretamente a partir do MIME type validado (`MIME_TO_EXTENSION`), impedindo extensão arbitrária fornecida pelo cliente.
   - Arquivo modificado: [`src/app/api/attachments/route.ts`](file:///c:/Users/Vinicius/PopoApp/PopoApp/src/app/api/attachments/route.ts) padronizado para usar `await requireAuth(request)`.

---

## 3. 🎯 O Que Falta Fazer (Próximos Passos de Desenvolvimento)

Para continuar o desenvolvimento, o sistema está pronto para prosseguir em duas frentes:

### Trilha 1: Milestone 2 — Interface Visual (UI) e Integração de Telas (Fases 5, 8, 11)
Substituir os imports de `src/data/mock/*` pelas APIs reais já funcionais:
- **Clientes (`/clientes` e `/clientes/[id]`)**:
  - Consumir `GET /api/clients`, `POST /api/clients`, `PUT /api/clients/[id]`.
  - Conectar contatos de emergência e foto de perfil.
  - Criar página de detalhes do cliente com histórico clínico derivado.
- **Procedimentos (`/procedimentos`)**:
  - Conectar catálogo a `GET /api/procedures` e `POST /api/procedures`.
- **Anexos e Fotos**:
  - Componente de upload e galeria autenticada.

### Trilha 2: Milestone 3 — Regras de Domínio e Serviços Clínicos (Fases 6, 7, 9, 10)
Construir a camada de serviços antes das telas:
- **Agendamentos (`AppointmentService`)**: 6 status, reagendamento atômico, cancelamento com justificativa e efeito cascata no Atendimento pendente.
- **Atendimentos (`AttendanceService`)**: Máquina de estados D1, snapshot do valor padrão, valor praticado e desconto explícito.
- **Estoque e Rastreabilidade (`ProductService` / `StockService`)**: Produtos de uso único vs. reutilizáveis pelo mesmo cliente; bloqueio estrito de reuso entre clientes diferentes.
- **Prontuário Médico (`MedicalRecordService`)**: Relação 1:1 estrita com o Atendimento.

---

## 4. ⚡ Comandos para Retomada Rápida

Quando desejar retomar os trabalhos, execute na raiz do projeto (`c:\Users\Vinicius\PopoApp\PopoApp`):

```powershell
# 1. Iniciar o LocalDB (se não estiver rodando)
sqllocaldb start MSSQLLocalDB

# 2. Iniciar o proxy TCP do LocalDB (necessário em dev/test)
npm run db:proxy

# 3. Executar a suíte completa de testes
npm test

# 4. Validar linter e build
npm run lint
npm run build
```

---
*PopoApp — Registro e contexto consolidados para retomada sem perda de estado.*
