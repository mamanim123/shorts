# Plan: Shorts Lab Genre Manager Save & Reset Fix

## TL;DR

> **Quick Summary**: This plan addresses the critical issue where Genre, Prompt, and Character rules are reset to defaults during save or load operations. The fix involves resolving race conditions in the storage service and relaxing over-aggressive data normalization.
> 
> **Deliverables**:
> - Robust `appStorageService` with primed state tracking.
> - Fixed Managers (Genre, Prompt, Step2, Character) with reliable async loading.
> - Improved Normalization logic that preserves user-cleared fields.
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: NO - sequential fix required for data integrity.
> **Critical Path**: appStorageService → Managers → Frontend Verification.

---

## Context

### Original Request
마마님 (the User) reported that "Shorts Lab Genre Manager" settings (Genre, Prompt Rules, Step 2 Rules, Costume Rules) are being reset/initialized to defaults unexpectedly even after saving.

### Research Findings
1. **Race Condition**: `primeAppStorageCache` is async, but managers often call it and immediately use synchronous cached getters. If the network is slow, they get defaults and may save them back.
2. **Aggressive Normalization**: Managers force `DEFAULT` values if an object is empty or missing specific fields, rather than allowing partial custom states.
3. **Load-time Overwrite**: `shortsLabGenreManager.ts` explicitly writes defaults to the server if the first load appears empty (line 131), which is risky during race conditions.
4. **Step 2 Normalization**: Forces defaults on empty strings, preventing 마마님 from clearing prompts.

---

## Work Objectives

### Core Objective
Ensure that user settings in the Genre Manager are accurately saved, reliably loaded, and never overwritten by defaults without explicit user intent.

### Concrete Deliverables
- `services/appStorageService.ts`: Added `isPrimed` state and async safety.
- `services/shortsLabGenreManager.ts`: Removed auto-write-on-empty logic.
- `services/shortsLabPromptRulesManager.ts`: Improved `normalize` logic.
- `services/shortsLabStep2PromptRulesManager.ts`: Allowed empty string values.
- `services/shortsLabCharacterRulesManager.ts`: Fixed fallback race condition.

### Definition of Done
- [ ] Settings changed in all 4 tabs are preserved after page refresh.
- [ ] "Reset" only happens when the "Reset to Default" button is clicked.
- [ ] No race conditions observed on app launch.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO
- **User wants tests**: NO
- **QA approach**: Manual verification via UI + Console logging.

### Automated Verification (Agent-Executable)

| Type | Verification Tool | Automated Procedure |
|------|------------------|---------------------|
| **Logic** | Node REPL | Import managers, mock fetch, verify `load` returns expected data after delay. |
| **API** | Bash curl | Verify `POST /api/app-storage` correctly updates `app_storage.json`. |

---

## TODOs

- [ ] 1. Enhance `appStorageService.ts` for Async Safety
  **What to do**:
  - Add `let isPrimed = false` and `let primingPromise: Promise<void> | null = null`.
  - Update `primeAppStorageCache` to return the `primingPromise` and set `isPrimed = true` on success.
  - Add `ensurePrimed()` helper to be used by all managers.
  **Recommended Agent Profile**: `unspecified-high` + `bash`

- [ ] 2. Fix `shortsLabPromptRulesManager.ts` Loading & Normalization
  **What to do**:
  - Update `loadRules` to `await primeAppStorageCache()`.
  - Pass the raw data from `getAppStorageValue` directly to `normalizePromptRules`.
  - In `normalizePromptRules`, don't reset `cameraMapping` unless it is completely missing.
  **Recommended Agent Profile**: `unspecified-high`

- [ ] 3. Fix `shortsLabGenreManager.ts` Data Integrity
  **What to do**:
  - Remove the block that calls `writeStoredGenres` if `stored.length === 0` during load.
  - Update `loadGenres` to await priming properly.
  **Recommended Agent Profile**: `unspecified-high`

- [ ] 4. Fix `shortsLabStep2PromptRulesManager.ts` Empty String Handling
  **What to do**:
  - Update `normalizeRules` to allow empty strings (`''`) if the key exists, instead of forcing defaults.
  **Recommended Agent Profile**: `unspecified-high`

- [ ] 5. Fix `shortsLabCharacterRulesManager.ts` Fallback Logic
  **What to do**:
  - In `loadRules`, ensure `primeAppStorageCache` is awaited.
  - Ensure it doesn't fall back to `readStoredRules` (sync) if the async fetch is still in progress.
  **Recommended Agent Profile**: `unspecified-high`

---

## After Plan Completion: Cleanup & Handoff

### 1. Delete the Draft File
Bash("rm .sisyphus/drafts/genre-manager-fix.md")

### 2. Guide User to Start Execution
마마님, 원인 분석이 완료되었습니다. 저장 로직의 고질적인 타이밍 문제와 과도한 자동 초기화 기능을 모두 해결하는 완벽한 수정 계획을 세웠습니다.

실행하시려면 아래 명령어를 입력해 주세요:
  `/start-work`
