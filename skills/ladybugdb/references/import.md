# LadybugDB Data Import

## COPY FROM — Bulk Import (recommended for large datasets)

COPY FROM is the fastest way to load data. It uses a columnar scan path and bypasses normal write path overhead — 10-100x faster than row-by-row `CREATE`.

### CSV

```cypher
COPY User FROM "users.csv";
COPY User FROM "users.csv" (header=true);

-- Custom delimiter/quote/escape
COPY User FROM "users.tsv" (delim='\t');
COPY User FROM "data.csv" (delim=',', quote='"', escape='\\');

-- Wildcard — loads all matching files
COPY User FROM "User*.csv";

-- Multiple explicit files
COPY User FROM ["users_0.csv", "users_1.csv"];

-- Column mapping (when CSV columns differ from table columns)
COPY User FROM "users.csv" (header=true, columns={"csv_name": "name", "csv_age": "age"});
```

### Parquet

```cypher
COPY User FROM "users.parquet";
COPY User FROM "User*.parquet";
COPY Transaction FROM ["txn_jan.parquet", "txn_feb.parquet"];
```

### JSON / JSONL

```cypher
COPY User FROM "users.json";
COPY User FROM "users.jsonl";
```

### Cloud Storage (S3, GCS, Azure Blob)

Requires the `httpfs` extension (usually auto-loaded):

```cypher
COPY User FROM "s3://my-bucket/users.parquet";
COPY User FROM "s3://my-bucket/data/*.csv";
COPY User FROM "gcs://my-bucket/users.parquet";
COPY User FROM "az://my-container/users.parquet";
```

Set credentials via environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `GOOGLE_APPLICATION_CREDENTIALS`, `AZURE_STORAGE_CONNECTION_STRING`) or via `SET`:

```cypher
SET s3_access_key_id = '...';
SET s3_secret_access_key = '...';
SET s3_region = 'us-east-1';
```

### From subquery

```cypher
COPY Person FROM (MATCH (u:User) RETURN u.name AS name, u.age AS age);
```

---

## LOAD FROM — Scan Without Inserting

LOAD FROM reads data into the query pipeline without committing it to a table. Use it for inspection, transformation, or conditional import.

```cypher
-- Inspect a file
LOAD FROM "users.csv" (header=true) RETURN * LIMIT 10;

-- Transform on the fly
LOAD FROM "users.csv" (header=true)
RETURN toInteger(age) AS age, toLower(name) AS name;

-- Filter before inserting
LOAD FROM "events.parquet"
WHERE type = 'click'
RETURN *;

-- Scan a DataFrame without inserting
LOAD FROM df RETURN * LIMIT 5;

-- Insert with transformation
LOAD FROM "users.csv" (header=true) AS row
CREATE (u:User {name: row.name, age: toInteger(row.age)});
```

---

## DataFrame Import (Python)

```python
import real_ladybug as lb
import pandas as pd

db = lb.Database(":memory:")
conn = lb.Connection(db)
conn.execute("CREATE NODE TABLE User(name STRING PRIMARY KEY, age INT64)")

df = pd.DataFrame({"name": ["Alice", "Bob", "Charlie"], "age": [30, 25, 35]})

# Fastest bulk import
conn.execute("COPY User FROM df")

# With transformation/filtering
conn.execute("""
    LOAD FROM df AS row
    WHERE toInteger(row.age) >= 30
    CREATE (u:User {name: row.name, age: toInteger(row.age)})
""")

# Polars
import polars as pl
pl_df = pl.read_parquet("events.parquet")
conn.execute("COPY Event FROM pl_df")
```

---

## Import from DuckDB (zero-copy via Arrow)

```python
import duckdb, real_ladybug as lb

duck_conn = duckdb.connect("analytics.duckdb")
lbug_conn = lb.Connection(lb.Database("graph.lbug"))

duck_result = duck_conn.execute("SELECT name, age FROM sales_users").arrow()
lbug_conn.execute("COPY User FROM duck_result")
```

---

## Performance Tips

1. **COPY FROM over row-by-row CREATE** — 10-100x faster for bulk loads
2. **Parquet over CSV** — columnar, compressed, typed schemas
3. **Wildcards for sharded data**: `COPY User FROM "shard_*.parquet"`
4. **Disable WAL for initial load** (if crash recovery isn't needed):
   ```cypher
   PRAGMA journal_mode=OFF;
   COPY User FROM "users.parquet";
   PRAGMA journal_mode=WAL;
   ```
5. **CHECKPOINT after large loads** to flush WAL to disk:
   ```cypher
   CHECKPOINT;
   ```
