# Implement Phases — Index

All phases accumulate data into a single `<task>` tag with structured sub-tags:

```xml
<task>
  <model_id/>             <!-- P1: current model ID (e.g. claude-opus-4-6) -->
  <context/>              <!-- P1: additional user-provided context -->
  <requirements/>         <!-- P2: raw jira ticket output -->
  <domains/>              <!-- P2: identified business domains + summary -->
  <domain_knowledge/>     <!-- P3.1: codebase knowledge per domain -->
  <supporting_context/>   <!-- P3.2: content from scanned links -->
  <design/>               <!-- P3.2: Figma/UI design context -->
</task>
```

> **Output file convention:** Sub-skills with `context: fork` run as subagents whose return values may be summarized. To get the **complete** output, each sub-skill persists its full response to a file on disk. After a forked skill completes, **always read the output file** (e.g. `OUT_DIR/output.md`) rather than relying on the subagent's return value.

## Phases

Execute each phase sequentially. Read the linked file for detailed instructions when you reach that phase.

1. **Initialization** — [phase1-initialization.md](phase1-initialization.md)
2. **JIRA Analysis** — [phase2-jira-analyzer.md](phase2-jira-analyzer.md)
3. **Create Git Branch** — [phase2.5-create-branch.md](phase2.5-create-branch.md)
4. **Discovery & Scanning** (all 3.x phases run concurrently):
   - 3.1 **Domain Discovery** — [phase3.1-domain-discovery.md](phase3.1-domain-discovery.md)
   - 3.2 **Resource Scanning** — [phase3.2-resource-scanning.md](phase3.2-resource-scanning.md)
5. **Prompt Optimization** — [phase4-prompt-optimization.md](phase4-prompt-optimization.md)
6. **Implementation Planning** — [phase5-implementation-planning.md](phase5-implementation-planning.md)
7. **Execute Per Planning** — [phase6-execution.md](phase6-execution.md)
8. **Verification** — [verification.md](verification.md)
