---
name: domain-discover
description: Discover and document domain knowledge from a codebase into a structured knowledge file
agent: general-purpose
model: sonnet
argument-hint: <domain name and optional output directory>
allowed-tools: Read, Bash, Write, Edit
context: fork
---

# Discover Domain Knowledge

You are tasked with creating a comprehensive domain knowledge file for a codebase that will help future Claude Code instances work effectively with this repository.

## Inputs

Raw arguments: $ARGUMENTS

Infer from the arguments:
- DOMAIN_NAME: the domain name, used as the output filename
- OUT_DIR: output directory, or `.` (project root) if not provided

## Output Location

- Creates or updates `OUT_DIR/{DOMAIN_NAME}.md`
- Run `mkdir -p OUT_DIR` before writing to ensure the directory exists.

## Objective

Analyze the provided codebase and create or update a `{DOMAIN}.md` file containing essential information for productive development.

## Analysis Approach

1. First, scan the repository structure to understand the project type and technology stack
2. Read key configuration files (package.json, requirements.txt, Makefile, etc.) to identify build/test commands
3. Examine main application files to understand the high-level architecture
4. Review existing documentation (README.md, docs/) for important context

## Execution

Follow [references/rules.md](references/rules.md) for content requirements, guidelines, and safety rules.
Use [references/output-format.md](references/output-format.md) for the output template and validation criteria.