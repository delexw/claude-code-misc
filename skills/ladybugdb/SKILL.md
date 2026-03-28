---
name: ladybugdb
description: "Expert guide for LadybugDB — an embedded, in-process property graph database using openCypher. Use this skill whenever the user is working with LadybugDB, writing Cypher queries for LadybugDB, using the `lbug` CLI, importing `real_ladybug` in Python, using `@ladybugdb/core` in Node.js, or building any application with LadybugDB. Also triggers when the user asks about LadybugDB schema design, graph algorithms (PageRank, Louvain), HNSW vector search, full-text search, ATTACH to PostgreSQL/DuckDB/Delta Lake, LLM embeddings with CREATE_EMBEDDING, or bulk data import/export with COPY FROM/TO. Use even if the user just says 'ladybug graph db' or pastes a .lbug file path."
---

# LadybugDB

LadybugDB is an **embedded, in-process property graph database** — no server process required. It uses the openCypher query language with a **required, predefined schema** (unlike Neo4j), columnar disk-based storage, vectorized query execution, and serializable ACID transactions.

## Quick orientation

- **Schema-first**: you must create node/rel tables before inserting data
- **One primary key per node table** — automatically indexed, unique, non-null
- **Walk semantics**: repeated edges allowed in MATCH (unlike Neo4j's trail semantics)
- **One write transaction at a time**; multiple concurrent reads are fine
- **In-memory mode**: use `":memory:"` as the database path for ephemeral databases

## Installation

```bash
# CLI
curl -s https://install.ladybugdb.com | bash   # Linux
brew install ladybug                             # macOS

# Python
pip install real_ladybug

# Node.js
npm install @ladybugdb/core
```

## CLI basics

```bash
lbug mydb.lbug        # open/create on-disk DB
lbug                   # in-memory (ephemeral)
lbug mydb.lbug < schema.cypher   # batch mode
```

Key shell commands: `:schema` (show tables), `:help`, `:quit`, `:mode [json|csv|markdown|...]`

## Reference files

Load only the sections you need:

| File | Contents |
|------|----------|
| `references/cypher-reference.md` | DDL, DML, MATCH queries, transactions, macros, LadybugDB vs Neo4j differences |
| `references/python.md` | Python (`real_ladybug`) — connection, query, DataFrame, transactions |
| `references/nodejs.md` | Node.js (`@ladybugdb/core`) — connection, query, streaming, transactions |
| `references/java.md` | Java — Maven setup, connection, query, transactions |
| `references/rust.md` | Rust — Cargo setup, connection, query, Value types |
| `references/go.md` | Go — module setup, connection, query, transactions |
| `references/swift.md` | Swift — SPM setup, connection, query, async/await |
| `references/import.md` | COPY FROM, LOAD FROM, DataFrame import, cloud storage, performance tips |
| `references/export.md` | COPY TO, DataFrame export (pandas/polars/arrow), DuckDB export |
| `references/graph-algorithms.md` | PageRank, Louvain, WCC, SCC, K-Core, shortest paths — PROJECT_GRAPH |
| `references/vector-search.md` | HNSW index, CREATE/QUERY/DROP_VECTOR_INDEX, RAG pattern |
| `references/full-text-search.md` | BM25, CREATE/QUERY/DROP_FTS_INDEX, stemmers |
| `references/llm-embeddings.md` | CREATE_EMBEDDING — OpenAI, Ollama, Google, Bedrock, Voyage AI |
| `references/attach.md` | ATTACH/DETACH — PostgreSQL, DuckDB, SQLite, Delta Lake, Iceberg, Neo4j |
| `references/cli.md` | `lbug` shell flags, commands, output modes, batch/scripting mode |
| `references/explorer.md` | Ladybug Explorer Docker GUI — launch, env vars, volume mount |

## Common task routing

| Task | Read |
|------|------|
| Schema design, Cypher queries, differences from Neo4j | `cypher-reference.md` |
| Python integration | `python.md` |
| Node.js / TypeScript integration | `nodejs.md` |
| Java integration | `java.md` |
| Rust integration | `rust.md` |
| Go integration | `go.md` |
| Swift / iOS / macOS integration | `swift.md` |
| Bulk import — COPY FROM, LOAD FROM, DataFrames, cloud storage | `import.md` |
| Bulk export — COPY TO, DataFrame export, DuckDB | `export.md` |
| PageRank, Louvain, WCC, SCC, K-Core, shortest paths | `graph-algorithms.md` |
| HNSW vector similarity search, RAG | `vector-search.md` |
| Full-text search (BM25) | `full-text-search.md` |
| LLM embeddings (OpenAI, Ollama, Bedrock…) | `llm-embeddings.md` |
| ATTACH to PostgreSQL, DuckDB, Delta Lake, Neo4j | `attach.md` |
| CLI shell, batch scripts | `cli.md` |
| Ladybug Explorer browser GUI (Docker) | `explorer.md` |

## Key gotchas

1. **`SET n.prop = NULL`** to remove a property (not `REMOVE`)
2. **`label(n)`** not `labels(n)`; **`id(n)`** not `elementId(n)`
3. **`UNWIND`** instead of `FOREACH`
4. List functions use `list_` prefix: `list_concat`, `list_sort`, etc.
5. Variable-length paths **must** have an upper bound (default 30): `[:Follows*1..5]`
6. `LOAD FROM` (not `LOAD CSV FROM`) — supports CSV, Parquet, JSON, DataFrames
7. No manual index creation — primary key index is automatic; use FTS/vector extensions for search
