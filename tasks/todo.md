## Implementation Task List

### Phase 1: CI & Linting
- [ ] **Add CI linting**: Configure GitHub Actions workflow using `ruff` (or `flake8` once PATH issue resolved). Ensure `npm run lint` passes.
- [ ] **Add pre‑commit hook**: Use Antigravity `code-review-and-quality` skill to run on staged files.

### Phase 2: Test Suite
- [ ] **Create pytest suite** for FastAPI endpoints (`/health`, `/clone-voice`, `/save-voice`). Include fixtures for temporary upload files.
- [ ] **Add npm test scripts** for frontend if needed (e.g., Jest/Vitest for React components).

### Phase 3: Documentation
- [ ] **Document environment variables** (`HF_TOKEN`, any future DB vars) in `README.md` under an `## Environment` section.
- [ ] **Update README** with CI instructions and test running guide.

### Phase 4: Security Hardening
- [ ] **Add token‑based authentication** for API routes (use FastAPI `Depends` with simple Bearer token).
- [ ] **Secure Next.js proxy** to forward auth headers.

### Phase 5: Antigravity Skill Integration
- [ ] **Configure `code-review-and-quality` skill** as a GitHub Action step after linting.
- [ ] **Create an automation script** (`automation/voice-clone-ci.yml`) that runs the skill on PRs.

### Checkpoints
- **Checkpoint 1 – CI Ready**: Lint passes, CI workflow defined, pre‑commit active.
- **Checkpoint 2 – Tests Passing**: All pytest and frontend tests succeed locally and in CI.
- **Checkpoint 3 – Docs Updated**: README reflects env vars, CI, and testing.
- **Checkpoint 4 – Auth Implemented**: API requires valid token; proxy forwards token.
- **Final Checkpoint**: End‑to‑end clone flow works with CI passing and security in place.
