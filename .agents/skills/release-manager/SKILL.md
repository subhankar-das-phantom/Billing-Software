---
name: release-manager
description: >-
  Use this skill when preparing, documenting, testing, or publishing a new version or patch
  in the Bharat Enterprise platform. Enforces changelog-first documentation, README updates,
  legal/terms compliance checks, automated build validations, and signed git flow.
---

# Release Manager Skill

This skill guides the agent through the standardized release protocol, ensuring zero regression, complete documentation, and signed version tagging.

---

## 📋 Step-by-Step Release Procedure

### Step 1: Update `CHANGELOG.md`
- Add entry at top of file under `## [vX.Y.Z](url) — YYYY-MM-DD — Title`.
- Detail the problem, root cause, and categorized component modifications (`frontend`, `backend`, `compliance`, `devops`).

### Step 2: Update `README.md`
- Update the version badge on line 3 to `vX.Y.Z`.
- Update feature highlights or subscription matrices if capabilities changed.

### Step 3: Audit Legal & Compliance Documents
- Check `frontend/src/pages/Legal/PrivacyPolicyPage.jsx` if user roles, auth, data retention, or telemetry were modified.
- Check `frontend/src/pages/Legal/TermsPage.jsx` if payment processing, billing cycles, or SaaS subscription tiers were updated.

### Step 4: Run Automated Build Validations
Run both checks synchronously and verify 0 errors:
```powershell
cd backend; npx tsc --noEmit
cd frontend; npm run build
```

---

### Step 5: Git Flow, Production Gate & Signed Tagging

> [!CAUTION]
> **PRODUCTION MERGE GATE (`master` is Production):**
> - You may **ONLY** commit and push to `dev` (`git push origin dev`).
> - **DO NOT merge into `master` or create version tags** unless the user explicitly commands **"merge"** (or gives unambiguous approval to merge into production).
> - If the user has not said **"merge"**, stop after pushing to `dev` and inform the user that changes are committed and pushed to `dev`, ready for testing.

Execute the release flow in two strictly gated phases:

#### Phase 5A: Commit & Push to `dev` (Always Executed)
- **Granular Commits by Purpose**: Group changes into clear commits (`fix(...)` for bug fixes, `feat(...)` for new feature creation or components, `docs(...)` for documentation/changelogs, `chore(...)` for rule or configuration updates, `perf(...)` for optimizations).
- **PowerShell Escaping Rule**:
  > [!TIP]
  > When writing commit messages in PowerShell, wrap descriptions in single quotes (`'...'`) or escape `$` as `` `$ `` (e.g. `` `$in ``) to prevent PowerShell from misinterpreting MongoDB query operators or symbols as undefined shell variables.

```powershell
# 1. Ensure on dev branch
git checkout dev

# 2. Stage & commit fixes / optimizations:
git add <fix-files>
git commit -m 'fix(<scope>): <description>'

# 3. Stage & commit creations / new features:
git add <feature-files>
git commit -m 'feat(<scope>): <description>'

# 4. Stage & commit documentation:
git add CHANGELOG.md README.md <doc-files>
git commit -m 'docs(<scope>): <description>'

# 5. Stage & commit chores/agents:
git add .agents/
git commit -m 'chore(agents): <description>'

# 6. Push to dev ONLY
git push origin dev
```

*🛑 STOP HERE unless the user has explicitly said **"merge"**.*

---

#### Phase 5B: Production Merge, Tagging & Release Push (`master`) — ONLY upon explicit "merge" command

> [!IMPORTANT]
> **Mandatory Descriptive Merge Commits**: Every merge into `master` must use a multi-line, structured commit message detailing the problem, root cause, changes, rationale for any new additions, files modified, and verification results. Never use generic one-liners.

```powershell
# 1. Checkout master
git checkout master

# 2. Merge dev into master with rich descriptive context
git merge dev -m "<type>(<scope>): merge vX.Y.Z — <Title> into master`n`n### 🎯 Problem & Motivation`n- Explanation of what broke, what was missing, or what capability was requested.`n`n### 🔍 Root Cause Analysis`n- Technical breakdown of why the bug or limitation occurred.`n`n### 🛠️ Key Changes & Architectural Decisions`n- Detailed summary of fixes and enhancements.`n- If new components or files are added, explain WHY they were introduced.`n`n### 📁 Key Files Modified`n- path/to/file1.jsx: Specific modifications`n- path/to/file2.ts: Specific modifications`n`n### ✅ Verification & Quality Assurance`n- Build checks (npm run build): PASS`n- Test results and verification summary"

# 3. Create cryptographically signed tag
git tag -s vX.Y.Z -m "Release vX.Y.Z - <Title>"

# 4. Return to working branch (dev)
git checkout dev

# 5. Push production branch and tag to remote
git push origin master; git push origin vX.Y.Z
```

---

### Step 6: Generate GitHub Release Notes
Immediately following git push and tag creation:
- Generate and present a complete, copy-paste-ready **GitHub Release Note** markdown artifact for the user.
- The release note must include:
  - **Release Header & Tag Reference**: `vX.Y.Z — <Release Title>`
  - **Direct GitHub Release URL**: `https://github.com/subhankar-das-phantom/Billing-Software/releases/new?tag=vX.Y.Z&title=Release+vX.Y.Z+-+<Title>`
  - **Overview & Operational Impact**: Executive summary of what the version delivers.
  - **Problem & Root Cause**: Why the changes were necessary.
  - **Categorized Change Highlights**: Grouped logically (`🎨 Frontend UI & Accessibility`, `🔧 Backend Services & APIs`, `📋 Legal & Compliance Documents`, `⚙️ Configuration & Tooling`).
  - **Key Files Modified**: Clear bulleted list of modified files and what changed in each.
  - **Verification & QA Status**: Confirmation that `npx tsc --noEmit` and `npm run build` passed with 0 errors.
