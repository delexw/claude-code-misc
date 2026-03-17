# Phase 4: Prompt Optimization (conditional)

- Read `SKILL_DIR/references/dossier.json` to assess the ticket
- **Assess whether the ticket is well-specified:**
  - Well-specified: has clear acceptance criteria, a concrete description, or linked design specs/Figma
  - Ambiguous/underspecified: vague requirements, missing acceptance criteria, unclear scope, or contradictory instructions

**If well-specified** — skip `Skill("meta-prompter")`:
- Write `SKILL_DIR/references/soul.md` with a concise restatement of the task derived directly from the dossier (requirements, acceptance criteria, key constraints)

**If ambiguous/underspecified** — run `Skill("meta-prompter")`:
- Build a summary of the task context by reading:
  - `SKILL_DIR/references/dossier.json` — requirements
  - `SKILL_DIR/references/domains.json` — domain analysis
  - `SKILL_DIR/references/intel/` — scanned links (if any)
  - `SKILL_DIR/references/blueprints/` — design specs (if any)
  - `SKILL_DIR/references/briefing.md` — additional user context (if exists)
- Invoke `Skill("meta-prompter")` with the summarized context and `SKILL_DIR/references` as the output directory
