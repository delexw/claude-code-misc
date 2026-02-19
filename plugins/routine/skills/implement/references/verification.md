# Verification Checklist

## Phase 8: Verify Changes

Review every change to ensure it is:
- reasonable and well-justified
- within the scope of the JIRA ticket:
   - If a PR link was provided as an example → "Are my changes aligned with what the example PR guides?"
   - If a Figma design or UI image was present → "Are the UI changes compliant with `<task><design>`?"
   - If a runbook or guidance link was present → "Are my changes fully following the runbook?"
- compliant with project conventions/standards
- evidence-based (no guesswork)

Must fix or rollback anything that's wrong or off.

## Error Handling

- Network failures → Return timeout error with retry suggestion
- If any phase failed, report which phase and why
