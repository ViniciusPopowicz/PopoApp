# Handoff Report — Empirical Challenge Milestone 2

**Agent**: challenger_m2_2  
**Target Milestone**: Milestone 2 (Attachment Storage, Procedure Pricing, Route Security)  
**Date**: 2026-10-07T02:19:00Z  
**Verdict**: **APPROVE**

---

## 1. Observation

Direct empirical observations collected through test execution on Microsoft SQL Server LocalDB (`PopoAppTest`) using the automated Vitest harness (`npm test`):

### 1.1 Attachment XOR Constraint (Database & Service Layers)
- **Database CHECK Constraint (`CK_Attachment_Ownership`)**:
  - Raw SQL bypass insert with **both** `clientId` and `attendanceId` populated:
    ```sql
    INSERT INTO [Attachment] ([id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo], [createdAt], [updatedAt], [clientId], [attendanceId])
    VALUES ('adv-raw-both-001', 'both.pdf', 'both.pdf', 'application/pdf', 1024, './storage/adversarial_uploads/both.pdf', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '<clientId>', '<attendanceId>');
    ```
    Observed error verbatim:
    ```
    Raw query failed. Code: 547. Message: The INSERT statement conflicted with the CHECK constraint "CK_Attachment_Ownership". The conflict occurred in database "PopoAppTest", table "dbo.Attachment".
    ```
    Zero records persisted (`prisma.attachment.count({ where: { id: 'adv-raw-both-001' } }) === 0`).
  - Raw SQL bypass insert with **neither** `clientId` nor `attendanceId` populated (`NULL, NULL`):
    Observed error verbatim:
    ```
    Raw query failed. Code: 547. Message: The INSERT statement conflicted with the CHECK constraint "CK_Attachment_Ownership". The conflict occurred in database "PopoAppTest", table "dbo.Attachment".
    ```
    Zero records persisted (`count === 0`).
  - Valid inserts with only `clientId` or only `attendanceId` succeed cleanly without error.
- **Service Layer (`src/services/attachment.service.ts:63-98`)**:
  - `saveAttachment` with both `clientId` and `attendanceId` throws `ValidationError`:
    `"O anexo deve pertencer exclusivamente a um Cliente ou a um Atendimento, nunca a ambos."`
  - `saveAttachment` with neither `clientId` nor `attendanceId` throws `ValidationError`:
    `"O anexo deve ser vinculado obrigatoriamente a um Cliente ou a um Atendimento."`
  - `saveAttachment` with empty or whitespace string IDs (`'   '`) throws `ValidationError`.

### 1.2 Attachment File Boundaries & Path Traversal Resistance
- **File Size Boundaries (`src/services/attachment.service.ts:77-81`)**:
  - File size 10MB + 1 byte (`10485761` bytes) rejected with verbatim message:
    `"Tamanho do arquivo excede o limite máximo permitido de 10 MB."`
  - File size 0 bytes or negative size rejected with `ValidationError`.
- **MIME Type Boundaries (`src/services/attachment.service.ts:9-16, 70-74`)**:
  - Disallowed MIME types rejected with verbatim message:
    `"Tipo de arquivo não permitido. Tipos aceitos: JPEG, PNG, WebP e PDF."`
  - Tested formats: `.exe` (`application/x-msdownload`, `application/x-dosexec`), `.sh` (`application/x-sh`, `text/x-shellscript`), `.html` (`text/html`), `.js` (`application/javascript`), `.php` (`application/x-httpd-php`), `.svg` (`image/svg+xml`), `.zip` (`application/zip`). All 9 attack vectors threw `ValidationError`.
- **Path Traversal Resistance (`src/services/attachment.service.ts:113-122, 168-175`)**:
  - Filenames containing path traversal payloads (`../../../../etc/passwd.pdf`, `..\\..\\..\\windows\\system32\\calc.exe.pdf`, `....//....//deep/nested.pdf`):
    Stored file on disk was generated using a sanitized crypto UUID (`[0-9a-f-]{36}.pdf`), confined strictly inside `storage/adversarial_uploads`. File did not escape the storage root.
  - Calling `attachmentService.getAbsoluteFilePath` on a forged `nomeArquivo` with `'../../etc/passwd'`:
    Throws `ValidationError: "Caminho de arquivo inseguro detectado."`.

### 1.3 Procedure Boundaries & Soft Deactivation
- **Procedure Pricing Boundaries (`src/schemas/procedure.ts:22-29, 67`)**:
  - `valorPadrao = 0`: Rejected by Zod schema (`"O valor padrão deve ser maior que zero (V06)"`) and returns HTTP 400 from `POST /api/procedures`.
  - `valorPadrao = -150.0`: Rejected by Zod schema and returns HTTP 400 from `POST /api/procedures`.
- **Procedure Mandatory Category (`src/schemas/procedure.ts:71-76`)**:
  - Missing or whitespace-only category rejected by Zod schema and returns HTTP 400 from `POST /api/procedures`.
- **Soft Deactivation Behavior (`src/services/procedure.service.ts:349-407`)**:
  - Procedure without historical records: `deleteProcedure` executed a hard delete (`softDeactivated: false`, record deleted from database).
  - Procedure associated with `AttendanceProcedure`: `deleteProcedure` executed a soft deactivation (`softDeactivated: true`, message: `"Procedimento possui histórico de agendamentos ou atendimentos e foi desativado em vez de excluído."`, `isActive` updated to `false`).
  - The procedure row remains persisted in SQL Server to protect historical encounter snapshots (V12, V24).
  - Filtering: `listProcedures({ active: true })` excludes the deactivated procedure; `listProcedures({ active: false })` includes it.
  - Reactivation: `toggleProcedureActive(id, true)` safely restores `isActive = true`.

### 1.4 Route Security & Unauthenticated Access
- Unauthenticated requests to:
  - `GET /api/attachments/[id]` -> HTTP 401 JSON (`{ success: false, error: 'Não autorizado' }`)
  - `DELETE /api/attachments/[id]` -> HTTP 401 JSON (`{ success: false, error: 'Não autorizado' }`)
  - `GET /api/clients` -> HTTP 401 JSON (`{ success: false, error: 'Sessão expirada ou não autenticada' }`)
  - `POST /api/clients` -> HTTP 401 JSON
  - `GET /api/clients/[id]` -> HTTP 401 JSON
  - `PUT /api/clients/[id]` -> HTTP 401 JSON
  - `DELETE /api/clients/[id]` -> HTTP 401 JSON
  - `GET /api/procedures` -> HTTP 401 JSON
  - `POST /api/procedures` -> HTTP 401 JSON
  - `GET /api/procedures/[id]` -> HTTP 401 JSON
  - `PUT /api/procedures/[id]` -> HTTP 401 JSON
  - `PATCH /api/procedures/[id]` -> HTTP 401 JSON
  - `DELETE /api/procedures/[id]` -> HTTP 401 JSON
- Corrupted iron-session token:
  - Request with header `Cookie: popoapp-session=forged-corrupted-token-signature-invalid` returned HTTP 401 JSON.
- Middleware verification (`src/middleware.ts:16-28`):
  - Invocations to `middleware(req)` for `/api/attachments/*`, `/api/clients/*`, `/api/procedures/*` without session cookie returned HTTP 401 JSON.

### 1.5 Full Test Suite Execution
- **Command**: `npm test`
- **Output**:
  ```
  Test Files  16 passed (16)
       Tests  110 passed (110)
    Duration  50.25s
  ```
- 0 failed tests, 0 skipped tests, 0 regressions.

---

## 2. Logic Chain

1. **Observation 1.1** demonstrates that the database engine itself enforces `CK_Attachment_Ownership` (error code 547), guaranteeing that neither raw SQL injection nor direct ORM calls can produce an attachment owning both a Client and an Attendance or an orphan attachment with neither. The service layer provides an additional defense-in-depth barrier returning `ValidationError`.
2. **Observation 1.2** establishes that all boundary edge cases (sizes >10MB, non-positive sizes, executable and script MIME types) are intercepted before saving to disk. Path traversal payloads in the original filename cannot influence the stored file path on disk because files are stored under randomly generated UUIDs, and tampered storage paths are rejected with `"Caminho de arquivo inseguro detectado."`.
3. **Observation 1.3** establishes that procedures cannot be created or updated with non-positive standard values or missing categories. Deletion safely distinguishes between virgin catalog entries (hard delete) and historical clinical entries (soft deactivation with `isActive: false`), preserving referential integrity and historical pricing snapshots (V12, V24).
4. **Observation 1.4** proves that unauthenticated requests to `/api/attachments/[id]`, `/api/clients`, and `/api/procedures` fail closed with HTTP 401 JSON responses across all CRUD methods, both at the handler level (`requireAuth` / `getSession`) and at the edge Next.js middleware level.
5. **Observation 1.5** demonstrates that all 110 automated tests in the project (including the 21 newly added empirical challenge tests in `tests/tier5_adversarial/milestone2_adversarial_challenge.spec.ts`) pass completely with 0 failures against the live `PopoAppTest` database.
6. Therefore, Milestone 2 fulfills all security, invariant, and boundary requirements specified in the project charter.

---

## 3. Caveats

- Milestone 2 empirical challenge was scoped specifically to Attachment Storage, Procedure Pricing, and Route Security.
- Higher-order clinical encounter workflows (Milestone 3: Appointments 6-status lifecycle, Attendance D1 state machine, Product reuse and stock unit traceability) and Financial workflows (Milestone 4: dynamic calculation D2, credit card installments, PIX reminders) were not part of Milestone 2 scope and will be challenged in their respective milestones.

---

## 4. Conclusion

**Verdict: APPROVE**

Milestone 2 implementation satisfies all specification invariants, security constraints, and adversarial edge-case conditions without any detected vulnerabilities or regressions.

---

## 5. Verification Method

To independently reproduce and verify this assessment:

1. **Execute full automated test suite**:
   ```powershell
   npm test
   ```
   *Expected outcome*: 16 test files pass, 110 tests pass, 0 failures.

2. **Inspect adversarial test cases**:
   Review file `c:\Users\Vinicius\PopoApp\PopoApp\tests\tier5_adversarial\milestone2_adversarial_challenge.spec.ts` which contains the 21 adversarial tests covering:
   - Lines 52–153: Attachment XOR Constraint (DB raw SQL insert and service layer).
   - Lines 156–252: File boundaries (>10MB, negative size, 9 forbidden MIME types, path traversal).
   - Lines 255–416: Procedure boundaries (valorPadrao = 0, < 0, missing category, soft deactivation vs hard delete).
   - Lines 419–529: Route security (unauthenticated requests returning 401 JSON, tampered cookies, middleware).
