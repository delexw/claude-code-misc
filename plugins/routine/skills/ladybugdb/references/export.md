# LadybugDB Data Export

## COPY TO — Bulk Export

```cypher
-- CSV
COPY (MATCH (u:User) RETURN u.*) TO "output.csv";

-- Parquet (compressed, efficient)
COPY (MATCH (u:User) RETURN u.*) TO "output.parquet";

-- JSON
COPY (MATCH (u:User) RETURN u.*) TO "output.json";

-- Export relationship data
COPY (MATCH (a:User)-[r:Follows]->(b:User) RETURN a.name, b.name, r.since)
TO "follows.csv";

-- Export to cloud storage
COPY (MATCH (u:User) RETURN u.*) TO "s3://my-bucket/users.parquet";
COPY (MATCH (u:User) RETURN u.*) TO "gcs://my-bucket/users.parquet";
```

---

## Export to DataFrame (Python)

```python
result = conn.execute("MATCH (u:User) RETURN u.name, u.age ORDER BY u.age")

df_pandas = result.get_as_df()     # pandas DataFrame
df_polars = result.get_as_pl()     # polars DataFrame
tbl_arrow = result.get_as_arrow()  # pyarrow Table
```

---

## Export to DuckDB (zero-copy via Arrow)

```python
import duckdb, real_ladybug as lb

lbug_conn = lb.Connection(lb.Database("graph.lbug"))
duck_conn = duckdb.connect("analytics.duckdb")

arrow_tbl = lbug_conn.execute("MATCH (u:User) RETURN u.*").get_as_arrow()
duck_conn.execute("CREATE TABLE users AS SELECT * FROM arrow_tbl")
duck_conn.execute("SELECT AVG(age) FROM users").fetchall()
```

---

## Cloud storage credentials

Set via environment variables or `SET` before exporting to cloud:

```cypher
SET s3_access_key_id = '...';
SET s3_secret_access_key = '...';
SET s3_region = 'us-east-1';
```

Environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `GOOGLE_APPLICATION_CREDENTIALS`, `AZURE_STORAGE_CONNECTION_STRING`.
