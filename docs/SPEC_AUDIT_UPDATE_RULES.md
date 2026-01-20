# SPEC_AUDIT_UPDATE_RULES.md

## 0. Purpose

This document defines the rules for making changes labeled as **“Update”** to `docs/SPEC_AUDIT_CHECKLIST.md`.

* Goal: Maintain checklist **trustworthiness** and **audit traceability** while allowing routine maintenance.
* Non-goal: Redesigning the checklist structure or redefining audit gates (that is **Rewrite**).

---

## 1. Terminology

### 1.1 Update

An **Update** is a change that:

* Preserves the existing **section structure**, **ordering**, and **item text** of `SPEC_AUDIT_CHECKLIST.md`.
* Modifies only the **allowed fields** (see Section 2).

### 1.2 Rewrite

A **Rewrite** is any change that modifies:

* Section structure (add/remove/merge/reorder sections)
* The text of checklist items in a way that changes meaning
* Gate rules or constraints semantics

Rewrite requires explicit agreement and should be handled as a separate workstream.

---

## 2. Allowed Changes Under “Update”

Updates are allowed only within the following categories.

### U1 — Status / Notes Updates (All Sections)

Allowed:

* Updating **Status** values
* Updating **Notes** to reflect implementation evidence

This applies to **all sections**, including **Global System Constraints** items.

Constraints:

* The **item text itself** must not be modified (no rephrasing that changes meaning).
* Do not add/remove constraint items in an Update.

### U2 — Audit Target Modernization

Allowed:

* Updating audit target metadata, such as:

  * Target branch / tag / commit reference
  * Referenced spec/doc locations when files are moved or renamed
  * Audit scope declarations that describe which modules/areas are in scope for the current iteration

Constraints:

* Audit Target updates must not be used to **weaken or bypass** gates.
* Removing core contract documents from the audit target is **not** permitted as an Update.

  * If removal is needed, treat it as Rewrite and record the rationale.

### U3 — Literal Contract Sync (Same-Meaning String Alignment)

Allowed:

* Literal string replacements that align the checklist wording with a contract change **without changing meaning**, e.g.:

  * API path singular/plural normalization (as defined by contract)

Constraints:

* If the change alters requirements or semantics, it is not U3; it is Rewrite.

---

## 3. Forbidden Changes Under “Update”

An Update must **not** include:

1. Section structure changes

* Adding/removing/merging/reordering sections
* Renumbering sections

2. Constraint/Gate semantics changes

* Rewriting Global System Constraints text
* Weakening FAIL rules or changing “release readiness” decision logic

3. Checklist item meaning changes

* Rephrasing “Check” criteria to raise/lower the bar
* Changing what constitutes PASS/FAIL

4. Scope evasion

* Dropping contract references to avoid audit findings

If any forbidden change is necessary, it must be handled as **Rewrite**.

---

## 4. Status Vocabulary (Standard)

Status values should be limited to:

* `PASS`
* `FAIL`
* `TODO`

Do not introduce new statuses without explicit agreement (Rewrite).

---

## 5. Update Process Requirements

Every Update should follow this process.

### Step 1 — Declare Update Type(s)

Declare one or more of:

* U1 (Status/Notes)
* U2 (Audit Target)
* U3 (Literal Contract Sync)

### Step 2 — Provide Evidence

At least one of the following per updated area:

* Test evidence (e.g., `./gradlew test PASS`)
* Code reference (file path(s) / class names)
* Command output evidence (e.g., grep result)
* Commit SHA (recommended once committed)

### Step 3 — Apply Minimal Changes

* Prefer minimal edits.
* Do not touch unrelated sections.

### Step 4 — Validate Invariants

Confirm:

* No section structure changes
* No item text meaning changes
* Global System Constraints items remain intact (only Status/Notes may change)

---

## 6. Rewrite Escalation Criteria

Escalate to Rewrite if any of the following are true:

* More than ~30% of checklist items require changes beyond Status/Notes
* Contract documents introduce new domains requiring structural changes
* Global System Constraints items must be added/removed/rewritten
* Gate rules or acceptance criteria must be changed

Rewrite must include:

* A proposed structural change list (section-level)
* Rationale for each change
* A mapping from old sections/items to new ones (traceability)

---

## 7. Governance

* Default assumption: Requests labeled “update” must follow these rules.
* Any ambiguity (Update vs Rewrite) should be resolved conservatively by treating it as Rewrite.

---

## 8. Change Log

* 2026-01-19: Initial version created. Scope includes U1 for Global System Constraints Status/Notes and U2 Audit Target modernization.
