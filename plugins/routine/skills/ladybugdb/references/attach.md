# LadybugDB ATTACH / DETACH

ATTACH lets you query external databases directly from Cypher — no ETL required. The external tables appear as node tables you can MATCH against.

## LadybugDB to LadybugDB

```cypher
ATTACH '/path/to/other.lbug' AS other (dbtype lbug);
MATCH (n:User) RETURN n.name;   -- queries the attached DB
DETACH other;

-- Read-only attach
ATTACH '/path/to/other.lbug' AS other (dbtype lbug, read_only true);
```

## PostgreSQL

```cypher
ATTACH 'host=localhost port=5432 dbname=mydb user=postgres password=secret'
    AS pg (dbtype postgres);

-- Query a PostgreSQL table as a node table
MATCH (u:users) RETURN u.name, u.email LIMIT 10;

-- Join graph data with PostgreSQL rows
MATCH (g:GraphNode)
WITH g
MATCH (p:postgres_table {id: g.external_id})
RETURN g.name, p.metadata;

DETACH pg;
```

## SQLite

```cypher
ATTACH 'path/to/data.db' AS sqlite_db (dbtype sqlite);
MATCH (r:my_table) RETURN r.*;
DETACH sqlite_db;
```

## DuckDB

```cypher
ATTACH 'path/to/analytics.duckdb' AS duck (dbtype duckdb);
MATCH (r:sales_summary) RETURN r.*;
DETACH duck;
```

## Delta Lake

```cypher
-- Local Delta table
ATTACH 'path/to/delta-table' AS delta_tbl (dbtype delta);

-- S3-hosted Delta table (requires httpfs)
ATTACH 's3://my-bucket/delta-table' AS delta_tbl (dbtype delta);
MATCH (r:delta_tbl) RETURN r.*;
DETACH delta_tbl;
```

## Apache Iceberg

```cypher
ATTACH 's3://my-bucket/iceberg-table' AS ice_tbl (dbtype iceberg);
MATCH (r:ice_tbl) RETURN r.*;
DETACH ice_tbl;
```

## Unity Catalog

```cypher
ATTACH 'catalog_name' AS uc (
    dbtype unity_catalog,
    token '...',
    host 'https://my-workspace.azuredatabricks.net'
);
MATCH (r:schema.table_name) RETURN r.*;
DETACH uc;
```

## Neo4j

```cypher
ATTACH 'bolt://localhost:7687' AS neo4j (
    dbtype neo4j,
    user 'neo4j',
    password 'password'
);
MATCH (n:Person) RETURN n.name LIMIT 10;
DETACH neo4j;
```

## Cloud storage credentials for Delta/Iceberg

```cypher
-- S3
SET s3_access_key_id = '...';
SET s3_secret_access_key = '...';
SET s3_region = 'us-east-1';

-- GCS
SET gcs_service_account_key = '...';

-- Azure
SET azure_storage_connection_string = '...';
```

Or use environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `GOOGLE_APPLICATION_CREDENTIALS`, `AZURE_STORAGE_CONNECTION_STRING`.

## Tips

- ATTACH is read-only by default for most external sources — check the specific driver
- Attached tables appear as first-class node tables; you can MATCH, filter, and join them
- For large external tables, push filters into WHERE to avoid full scans
- DETACH when done to release the connection/file handle
