---
name: domain-discover
description: Discover and document domain knowledge from a codebase into a structured knowledge file
context: fork
argument-hint: Domain name (e.g. "payments", "auth", "frontend")
---

# Discover Domain Knowledge

You are tasked with creating a comprehensive domain knowledge file for a codebase that will help future Claude Code instances work effectively with this repository.

## Arguments
- `$ARGUMENTS` — Domain name used as the output filename (`$ARGUMENTS.md`)

## Output Location
- Creates or updates `$ARGUMENTS.md` in the **project root** (current working directory).

## Objective

Analyze the provided codebase and create or update a `$ARGUMENTS.md` file containing essential information for productive development.

## Analysis Approach

1. First, scan the repository structure to understand the project type and technology stack
2. Read key configuration files (package.json, requirements.txt, Makefile, etc.) to identify build/test commands
3. Examine main application files to understand the high-level architecture
4. Review existing documentation (README.md, docs/) for important context

## Execution

Follow [references/rules.md](references/rules.md) for content requirements, guidelines, and safety rules.
Use [references/output-format.md](references/output-format.md) for the output template and validation criteria.

<tags>
   <mode>standard</mode>
   <custom>yes</custom>
</tags>
