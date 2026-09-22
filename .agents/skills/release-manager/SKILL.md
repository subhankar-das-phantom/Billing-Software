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

### Step 1: Update `CHANGELOG.md` & Version Discipline
- **Anti-Inflation Rule on `dev`**: During an active development milestone on `dev`, do NOT invent new version headers (`v2.6.1`, `v2.6.2`) for every intermediate fix, asset refresh, or sub-task before a production merge has occurred. Group ongoing work under the **target milestone version**.
- **1:1 Tag-to-Changelog Invariant**: **Every single `## [vX.Y.Z]` entry in `CHANGELOG.md` MUST have an exact, matching Git tag and GitHub release.** Never leave phantom untagged versions in `CHANGELOG.md`.
- **Valid Release URLs**: Format headers as `## [vX.Y.Z](https://github.com/subhankar-das-phantom/Billing-Software/releases/tag/vX.Y.Z) — YYYY-MM-DD — Title`. Only include the URL if the tag will be created and pushed in Phase 5B.
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

#### Phase 5B: Production Merge, Tag Parity & Release Push (`master`) — ONLY upon explicit "merge" command

> [!IMPORTANT]
> **Multi-Version Parity Audit**:
> Before merging into `master`, inspect `CHANGELOG.md` and compare against existing git tags (`git tag -l`).
> - If `CHANGELOG.md` contains multiple new versions (e.g., `v2.6.0`, `v2.6.1`, `v2.6.2`), **EVERY SINGLE ONE MUST BE TAGGED**.
> - Identify the historical commit for each earlier version and tag it: `git tag -s vX.Y.Z <commit-hash> -m "Release vX.Y.Z - <Title>"`.
> - Never merge `master` with only one tag if the changelog documents multiple versions.
> - **Mandatory Copy-Paste Ready Output**: Pushing to `master` automatically obligates the agent to output the complete, 1-click copy-paste-ready GitHub Release Notes in the chat response as defined in Step 6.

```powershell
# 1. Checkout master and pull latest
git checkout master
git pull origin master

# 2. Merge dev into master with rich descriptive context
git merge dev -m "<type>(<scope>): merge vX.Y.Z — <Title> into master`n`n### 🎯 Problem & Motivation`n- Explanation of what broke, what was missing, or what capability was requested.`n`n### 🔍 Root Cause Analysis`n- Technical breakdown of why the bug or limitation occurred.`n`n### 🛠️ Key Changes & Architectural Decisions`n- Detailed summary of fixes and enhancements.`n- If new components or files are added, explain WHY they were introduced.`n`n### 📁 Key Files Modified`n- path/to/file1.jsx: Specific modifications`n- path/to/file2.ts: Specific modifications`n`n### ✅ Verification & Quality Assurance`n- Build checks (npm run build): PASS`n- Test results and verification summary"

# 3. Create cryptographically signed tag for the latest release
git tag -s vX.Y.Z -m "Release vX.Y.Z - <Title>"

# 4. If earlier versions in CHANGELOG lack tags, tag them at their respective commits:
# git tag -s vX.Y.A <commitA> -m "Release vX.Y.A - <Title>"
# git tag -s vX.Y.B <commitB> -m "Release vX.Y.B - <Title>"

# 5. Return to working branch (dev)
git checkout dev

# 6. Push production branch and ALL tags to remote
git push origin master; git push origin --tags
```

---

### Step 6: Present In-Chat 1-Click Copy-Paste-Ready Release Notes

> [!CAUTION]
> **MANDATORY IN-CHAT CODEBLOCK (100% COPY-PASTE READY — NO ARTIFACT-ONLY LINKS):**
> - Never just provide a link to a markdown file or an artifact (e.g. `[release_notes.md](...)`).
> - Never ask the user to open a file or find a document to copy release notes.
> - **You MUST output the full, unabridged release notes directly inside a fenced markdown codeblock (` ```markdown ... ``` `) in the chat response.**
> - The content inside the codeblock must be **100% ready for GitHub Releases** — complete with titles, overview, problem/root cause, categorized features, tables of modified files, and QA results. Zero placeholders, zero unresolved variables, zero post-editing needed.
> - The user must be able to click the single-click "Copy" button on the codeblock in the chat UI and paste it directly into GitHub's release body textarea.
> - **Direct Pre-filled Link**: Provide the direct pre-filled GitHub URL immediately above the codeblock:
>   `https://github.com/subhankar-das-phantom/Billing-Software/releases/new?tag=vX.Y.Z&title=Release+vX.Y.Z+-+<Title>`
> - If multiple versions were merged in the batch, output a separate pre-filled link and a dedicated copy-paste codeblock for **each** version so the user can release all of them with 1 click each.

The release note block must include:
- **Overview & Operational Impact**: Executive summary of what the version delivers.
- **Problem & Root Cause**: Why the changes were necessary.
- **Categorized Change Highlights**: Grouped logically (`🎨 Frontend UI & Accessibility`, `🔧 Backend Services & APIs`, `📋 Legal & Compliance Documents`, `⚙️ Configuration & Tooling`).
- **Key Files Modified**: Clear bulleted list or table of modified files and what changed in each.
- **Verification & QA Status**: Confirmation that `npx tsc --noEmit` and `npm run build` passed with 0 errors.
