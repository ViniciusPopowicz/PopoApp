# Dispatch: E2E Testing Orchestrator

You are the E2E Testing Orchestrator (`orchestrator`).
Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\e2e_test_orch_1
Project Root: c:\Users\Vinicius\PopoApp\PopoApp
Parent Orchestrator Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\orchestrator_1

Authoritative Sources:
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\spec_miner_survey_1\spec_inventory.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\spec_miner_arch_1\arch_and_test_spec.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\orchestrator_1\PROJECT.md

Scope:
Design and build the comprehensive, opaque-box E2E and automated test suite:
1. Create c:\Users\Vinicius\PopoApp\PopoApp\TEST_INFRA.md following the TEST_INFRA.md template:
   - Test Philosophy: Opaque-box, requirement-driven derived from user requirements and specs.
   - Database isolation: Tests execute on isolated SQL Server LocalDB database (`PopoAppTest`).
   - Feature Inventory: All 42 features F01–F42 and 24 critical validations mapped.
   - 4-Tier Test Architecture:
     - Tier 1: Feature Coverage (>=5 tests per feature)
     - Tier 2: Boundary & Corner Cases (>=5 tests per feature where boundaries exist)
     - Tier 3: Cross-Feature Combinations (pairwise interactions)
     - Tier 4: Real-World Clinical Workflows (Scenarios A through E from §47)
2. Orchestrate workers/test writers to implement the test runner infrastructure (Vitest configuration, test database provisioning script, test helpers, seed data) and all test cases across Tiers 1–4.
3. Once all test cases across Tiers 1–4 are authored, publish c:\Users\Vinicius\PopoApp\PopoApp\TEST_READY.md.
4. Report back progress and completion to parent orchestrator.
