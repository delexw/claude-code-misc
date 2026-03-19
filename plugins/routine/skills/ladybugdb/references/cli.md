# LadybugDB CLI (`lbug`)

## Installation

```bash
# Linux
curl -s https://install.ladybugdb.com | bash

# macOS
brew install ladybug

# Windows
# Download from GitHub releases, extract, run lbug.exe

# Nix (temporary shell)
nix-shell -p lbug
```

## Starting the shell

```bash
lbug mydb.lbug          # open/create on-disk database
lbug                     # open in-memory (ephemeral — lost on exit)
lbug mydb.lbug -r       # read-only mode
lbug mydb.lbug < schema.cypher   # batch (non-interactive) mode
```

## CLI flags

| Flag | Description |
|------|-------------|
| `-r, --read_only` | Open database read-only |
| `-d, --default_bp_size <MB>` | Buffer pool size in MB |
| `--max_db_size <bytes>` | Maximum database size |
| `--no_compression` | Disable compression |
| `-p, --path_history <dir>` | Shell history directory |
| `-i, --init <file>` | Load startup script on open |
| `-m, --mode <mode>` | Default output mode |
| `-s, --no_stats` | Disable query statistics |
| `-b, --no_progress_bar` | Disable progress bar |
| `-v, --version` | Show version |

## Shell commands

| Command | Description |
|---------|-------------|
| `:help` | List all shell commands |
| `:quit` / `Ctrl+D` | Exit the shell |
| `:clear` / `Ctrl+L` | Clear the screen |
| `:schema` | Show all node/rel tables and their properties |
| `:max_rows [n]` | Set max rows displayed (default: 20) |
| `:max_width [n]` | Set max character width per column |
| `:mode [mode]` | Change output format (see below) |
| `:stats [on\|off]` | Toggle execution statistics display |
| `:multiline` | Enable multi-line input mode |
| `:singleline` | Return to single-line input mode |
| `:highlight [on\|off]` | Toggle syntax highlighting |
| `:render_errors [on\|off]` | Toggle visual error rendering |

## Output modes (`:mode`)

| Mode | Description |
|------|-------------|
| `box` | Default — bordered table |
| `column` | Aligned columns, no borders |
| `csv` | Comma-separated values |
| `tsv` | Tab-separated values |
| `json` | JSON array of objects |
| `jsonlines` | One JSON object per line |
| `markdown` | Markdown table |
| `html` | HTML table |
| `latex` | LaTeX tabular |
| `line` | One property per line |
| `list` | Pipe-separated list |
| `trash` | Suppress output (useful for timing) |

## Batch / scripting mode

```bash
# Run a script file
lbug mydb.lbug < queries.cypher

# Pipe a single query
echo "MATCH (u:User) RETURN COUNT(*)" | lbug mydb.lbug

# Output in JSON for downstream processing
echo "MATCH (u:User) RETURN u.*" | lbug mydb.lbug -m json | jq '.[].name'

# Chain multiple statements
cat <<'EOF' | lbug mydb.lbug
CREATE NODE TABLE User(name STRING PRIMARY KEY, age INT64);
COPY User FROM "users.csv";
MATCH (u:User) RETURN COUNT(*);
EOF
```

