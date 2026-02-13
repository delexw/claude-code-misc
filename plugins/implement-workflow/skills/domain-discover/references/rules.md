# Domain Discovery Rules

## Required Content

### Development Commands Section
- Build commands and prerequisites
- Test execution (full suite and single test)
- Linting and code quality checks
- Development server startup
- Any project-specific tooling commands

### Architecture Overview Section
- High-level system design and data flow
- Key directories and their purposes
- Important design patterns or frameworks used
- Integration points and external dependencies
- Database schema or data models (if applicable)

## Content Guidelines
- Include existing README.md highlights
- Include relative paths to related documentations without duplicate content
- Extract important code comments that explain business logic or architectural decisions
- Focus on information requiring multiple file analysis, not obvious file listings
- Avoid generic development practices unless project-specific

## Existing File Handling
- If `$ARGUMENTS.md` already exists, read it first
- Review existing content for accuracy against the current codebase
- Preserve sections that are still correct and relevant
- Update outdated commands, paths, or architecture details
- Add any new information discovered that is missing
- Remove content that no longer applies (deleted files, changed patterns)
- If `$ARGUMENTS.md` does not exist, create it from scratch

## Safety Requirements
- Only include information you can verify from actual files
- If you cannot access certain files, explicitly state "Cannot access [filename]"
- Do not fabricate commands, architecture details, or development practices

