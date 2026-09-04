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
- Detail the problem, root cause, and categorized component modifications (`frontend`, `backend`, etc.).

### Step 2: Update `README.md`
- Update the version badge on line 3 to `vX.Y.Z`.
- Update feature highlights or subscription matrices if capabilities changed.

### Step 3: Audit Legal & Compliance Documents
- Check `frontend/src/pages/Legal/PrivacyPolicyPage.jsx` if user roles, auth, or telemetry were modified.
- Check `frontend/src/pages/Legal/TermsPage.jsx` if payment processing, billing cycles, or SaaS tiers were updated.

### Step 4: Run Automated Build Validations
Run both checks and verify 0 errors:
```powershell
cd backend; npx tsc --noEmit
cd frontend; npm run build
```

### Step 5: Git Flow & Signed Tagging
Execute the standard sequence:
```powershell
# 1. Commit on dev
git checkout dev
git add .
git commit -m "<type>(<scope>): <message>"

# 2. Merge into master
git checkout master
git merge dev -m "<type>(<scope>): sync vX.Y.Z to master"

# 3. Create signed tag
git tag -s vX.Y.Z -m "Release vX.Y.Z - <Title>"

# 4. Return to dev
git checkout dev

# 5. Push to GitHub
git push origin dev; git push origin master; git push origin vX.Y.Z
```
