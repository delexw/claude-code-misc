# LadybugDB Python API (`real_ladybug`)

```bash
pip install real_ladybug
# nightly: pip install --pre lbug
```

## Connection setup

```python
import real_ladybug as lb

db = lb.Database("mydb.lbug")           # on-disk
db = lb.Database(":memory:")            # in-memory / ephemeral
db = lb.Database("mydb.lbug", read_only=True)
db = lb.Database("mydb.lbug", buffer_pool_size=4 * 1024**3)  # 4 GB pool

conn = lb.Connection(db)
```

## Executing queries

```python
# Basic execute
result = conn.execute("MATCH (u:User) RETURN u.name, u.age")

# Parameterized (prevents injection, reuses query plans)
result = conn.execute(
    "MATCH (u:User {name: $name}) RETURN u",
    parameters={"name": "Alice"}
)

# Fetch results
rows      = result.get_all()       # list of dicts
df_pandas = result.get_as_df()     # pandas DataFrame
df_polars = result.get_as_pl()     # polars DataFrame
tbl_arrow = result.get_as_arrow()  # pyarrow Table

# Stream large results row by row
result = conn.execute("MATCH (u:User) RETURN u.*")
while True:
    row = result.get_next()
    if row is None:
        break
    print(row)
```

## Transactions

```python
conn.execute("BEGIN TRANSACTION")
conn.execute("CREATE (u:User {name: 'Alice', age: 30})")
conn.execute("COMMIT")

# Context manager (auto-commit on exit, rollback on exception)
with conn.transaction():
    conn.execute("CREATE (u:User {name: 'Bob', age: 25})")
```

## DataFrame import

```python
import pandas as pd

df = pd.DataFrame({"name": ["Alice", "Bob"], "age": [30, 25]})

conn.execute("COPY User FROM df")           # fastest bulk import
conn.execute("LOAD FROM df RETURN * LIMIT 5")  # scan without inserting

# With transformation
conn.execute("""
    LOAD FROM df AS row
    WHERE toInteger(row.age) >= 30
    CREATE (u:User {name: row.name, age: toInteger(row.age)})
""")
```

## Prepared statements

```python
prepared = conn.prepare("MATCH (u:User {name: $name}) RETURN u.age")
result1 = conn.execute(prepared, parameters={"name": "Alice"})
result2 = conn.execute(prepared, parameters={"name": "Bob"})
```

## Concurrency

- One `READ_WRITE` `Database` per file at a time; multiple `READ_ONLY` ok
- Multiple `Connection` objects from one `Database` are safe
- Multiple reads simultaneously; only one write at a time
- Web server pattern: one `Database` at startup, one `Connection` per request (cheap to create)

## DuckDB / Arrow interop

```python
import duckdb

arrow_tbl = conn.execute("MATCH (u:User) RETURN u.*").get_as_arrow()
duck = duckdb.connect()
duck.execute("CREATE TABLE users AS SELECT * FROM arrow_tbl")
```
