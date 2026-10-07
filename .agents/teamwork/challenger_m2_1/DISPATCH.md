# Dispatch: Challenger M2 1 (Security, Core Entities & Catalog)

You are a challenger agent (`teamwork_preview_challenger`).
Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\challenger_m2_1
Project Root: c:\Users\Vinicius\PopoApp\PopoApp
Parent Orchestrator Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\orchestrator_1

Authoritative Sources:
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md (§32 V01, V02, V12, V13, V14)
- c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m2_1\handoff.md

Empirical Challenge Objectives:
1. Empirically challenge CPF validation in `src/lib/cpf.ts`:
   - Test invalid length, non-numeric strings, letters, invalid check digits.
   - Test all 10 repeated-digit sequences (000.000.000-00 through 999.999.999-99) — must all fail.
   - Test known valid CPFs with and without punctuation — must pass.
2. Empirically challenge Attachment XOR constraint and storage pipeline:
   - Attempt creating attachment with both clientId AND attendanceId (must fail).
   - Attempt creating attachment with neither clientId NOR attendanceId (must fail).
   - Verify file is stored outside web root (`./storage/uploads/`).
   - Verify unauthenticated GET to `/api/attachments/[id]` returns 401 JSON.

Render Verdict:
- Record your verdict: APPROVE or REQUEST_CHANGES in `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\challenger_m2_1\handoff.md`.
- Notify parent via `send_message`.


## 2026-10-06T03:58:48Z
You are Milestone 2 Challenger 1.
Your working directory is: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\challenger_m2_1
Read c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\challenger_m2_1\DISPATCH.md first.

Authoritative source files:
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md
- c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m2_1\handoff.md

Empirically challenge Milestone 2:
1. Empirically challenge CPF validation in src/lib/cpf.ts:
   - Test invalid length, non-numeric strings, letters, invalid check digits.
   - Test all 10 repeated-digit sequences (000.000.000-00 through 999.999.999-99) — must all fail.
   - Test known valid CPFs with and without punctuation — must pass.
2. Empirically challenge Attachment XOR constraint and storage pipeline:
   - Test both clientId AND attendanceId populated (must fail with ValidationError / CK_Attachment_Ownership).
   - Test neither clientId NOR attendanceId populated (must fail).
   - Verify file is stored outside web root (./storage/uploads/).
   - Verify unauthenticated GET to /api/attachments/[id] returns 401 JSON (AC 60).

Render Verdict:
- Record your verdict: APPROVE or REQUEST_CHANGES in handoff.md in your working directory.
- Notify parent via send_message.
