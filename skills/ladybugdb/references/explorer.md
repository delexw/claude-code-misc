# LadybugDB Explorer (GUI)

Ladybug Explorer is a Docker-based browser UI at `http://localhost:8000`. Features: graph visualization, schema browser, import panel, and interactive query panel.

## Launch

```bash
# Open an existing on-disk database
docker run -p 8000:8000 \
  -v /absolute/path/to/db:/database \
  -e LBUG_FILE=mydb.lbug \
  ladybugdb/explorer

# In-memory database (demos / scratch exploration)
docker run -p 8000:8000 \
  -e LBUG_IN_MEMORY=true \
  ladybugdb/explorer

# Read-only mode
docker run -p 8000:8000 \
  -v /absolute/path/to/db:/database \
  -e LBUG_FILE=mydb.lbug \
  -e MODE=READ_ONLY \
  ladybugdb/explorer

# Custom buffer pool size (bytes)
docker run -p 8000:8000 \
  -v /absolute/path/to/db:/database \
  -e LBUG_FILE=mydb.lbug \
  -e LBUG_BUFFER_POOL_SIZE=4294967296 \
  ladybugdb/explorer
```

Open `http://localhost:8000` in your browser.

## Environment variables

| Variable | Description |
|----------|-------------|
| `LBUG_FILE` | Database filename inside `/database` mount |
| `LBUG_IN_MEMORY` | `true` to start with an in-memory database |
| `MODE` | `READ_ONLY` to prevent writes |
| `LBUG_BUFFER_POOL_SIZE` | Buffer pool size in bytes (default: 80% of RAM) |

## Volume mount

The `-v` flag maps a local directory to `/database` inside the container. The path must be absolute. `LBUG_FILE` is the filename within that directory (not a full path).

```bash
# Example: database at ~/graphs/social.lbug
docker run -p 8000:8000 \
  -v ~/graphs:/database \
  -e LBUG_FILE=social.lbug \
  ladybugdb/explorer
```
