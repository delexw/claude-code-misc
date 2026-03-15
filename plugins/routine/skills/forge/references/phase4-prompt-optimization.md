# Phase 4: Prompt Optimization (via `Skill("meta-prompter")`)


- Build a summary of the task context by reading key output files:
  - `SKILL_DIR/references/dossier.json` — requirements
  - `SKILL_DIR/references/domains.json` — domain analysis
  - `SKILL_DIR/references/lore/*.md` — domain knowledge
  - `SKILL_DIR/references/intel/` — scanned links (if any)
  - `SKILL_DIR/references/blueprints/` — design specs (if any)
  - `SKILL_DIR/references/briefing.md` — additional user context (if exists)
- Invoke `Skill("meta-prompter")` with the summarized context and `SKILL_DIR/references` as the output directory
