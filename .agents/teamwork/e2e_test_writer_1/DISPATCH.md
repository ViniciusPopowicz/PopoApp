# Dispatch: E2E Test Writer 1

You are a test writer (`teamwork_preview_test_writer`).
Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\e2e_test_writer_1
Project Root: c:\Users\Vinicius\PopoApp\PopoApp
Parent Orchestrator Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\orchestrator_1

Authoritative Sources:
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\spec_miner_survey_1\spec_inventory.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\spec_miner_arch_1\arch_and_test_spec.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\orchestrator_1\PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Tasks:
1. Create c:\Users\Vinicius\PopoApp\PopoApp\TEST_INFRA.md following the TEST_INFRA.md specification:
   - Test Philosophy: Opaque-box, requirement-driven, testing against isolated SQL Server LocalDB (`PopoAppTest`).
   - Feature Inventory mapping for all features and 24 critical validations.
   - Tier 1: Feature Coverage (>=5 tests per feature).
   - Tier 2: Boundary & Corner Cases (>=5 tests per feature).
   - Tier 3: Pairwise cross-feature interactions.
   - Tier 4: Real-world clinical workflows (Scenarios A through E from §47).
2. Set up the test directory skeleton under `tests/`:
   - `tests/helpers/` (test db client connecting to PopoAppTest, seed fixtures, auth session helpers).
   - `tests/tier1_features/`
   - `tests/tier2_boundaries/`
   - `tests/tier3_combinations/`
   - `tests/tier4_workflows/`
3. Write initial test helper files and initial validation tests (e.g. CPF checksum validation, SQL Server attachment XOR constraint check test AC 61, D1 lifecycle rules).

Deliverables:
- c:\Users\Vinicius\PopoApp\PopoApp\TEST_INFRA.md
- Initial test directory skeleton and helpers in `tests/`
- handoff.md in your working directory
- Notify parent via send_message when done.

## 2026-10-06T02:43:14Z
You are E2E Test Writer 1.
Your working directory is: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\e2e_test_writer_1
Read c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\e2e_test_writer_1\DISPATCH.md first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Authoritative source files:
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\spec_miner_survey_1\spec_inventory.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\spec_miner_arch_1\arch_and_test_spec.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\orchestrator_1\PROJECT.md

Scope & Tasks:
1. Create c:\Users\Vinicius\PopoApp\PopoApp\TEST_INFRA.md following the TEST_INFRA.md specification in Project Pattern:
   - Test Philosophy: Opaque-box, requirement-driven, testing against isolated SQL Server LocalDB (PopoAppTest).
   - Complete Feature Inventory mapping for all 42 features and 24 critical validations.
   - Tier 1: Feature Coverage (>=5 tests per feature).
   - Tier 2: Boundary & Corner Cases (>=5 tests per feature).
   - Tier 3: Pairwise cross-feature interactions.
   - Tier 4: Real-world clinical workflows (Scenarios A through E from §47).
2. Set up test directory layout under c:\Users\Vinicius\PopoApp\PopoApp\tests\:
   - `tests/helpers/` (test db client for PopoAppTest, seed fixtures, auth session helpers).
   - `tests/tier1_features/`
   - `tests/tier2_boundaries/`
   - `tests/tier3_combinations/`
   - `tests/tier4_workflows/`
3. Write initial test fixtures and helpers.

Deliverables:
- c:\Users\Vinicius\PopoApp\PopoApp\TEST_INFRA.md
- Tests skeleton and helpers under `tests/`
- Self-contained handoff.md in your working directory.
- Notify parent via send_message when done.
