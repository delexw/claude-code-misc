# LadybugDB Cypher Reference

## DDL — Schema Definition

### Node tables

```cypher
-- Basic node table (primary key required)
CREATE NODE TABLE User(name STRING PRIMARY KEY, age INT64, email STRING);
CREATE NODE TABLE City(id INT64 PRIMARY KEY, name STRING, population INT64);

-- Supported types: BOOL, INT8/16/32/64, UINT8/16/32/64, FLOAT, DOUBLE,
--   STRING, DATE, TIMESTAMP, INTERVAL, BLOB, UUID, JSON,
--   INT64[], STRING[], FLOAT[], STRUCT(field TYPE, ...), MAP(K, V)
```

### Relationship tables

```cypher
-- Single source/destination
CREATE REL TABLE Follows(FROM User TO User, since INT64);
CREATE REL TABLE LivesIn(FROM User TO City);

-- Multiple valid source/destination types
CREATE REL TABLE Knows(FROM User TO User, FROM User TO City, weight FLOAT);
```

### Altering and dropping tables

```cypher
ALTER TABLE User ADD COLUMN gender STRING;
ALTER TABLE User DROP COLUMN gender;
ALTER TABLE User RENAME COLUMN age TO user_age;
ALTER TABLE User RENAME TO Person;
DROP TABLE User;
```

### Open-type graphs (dynamic labels)

```cypher
-- Create a graph that allows dynamic label creation (no predefined schema)
CREATE GRAPH mygraph ANY;
USE GRAPH mygraph;
```

### Multiple graphs / subgraphs

```cypher
CREATE GRAPH analytics;
USE GRAPH analytics;
CREATE NODE TABLE Event(id INT64 PRIMARY KEY);
USE GRAPH default;  -- switch back
```

---

## DML — Data Manipulation

```cypher
-- Create
CREATE (u:User {name: 'Alice', age: 30, email: 'alice@example.com'});
CREATE (u:User {name: 'Bob'})-[:Follows {since: 2023}]->(v:User {name: 'Alice'});

-- Merge (upsert on primary key)
MERGE (u:User {name: 'Alice'}) SET u.age = 31;
MERGE (u:User {name: 'Charlie'}) ON CREATE SET u.age = 25 ON MATCH SET u.age = u.age + 1;

-- Update
MATCH (u:User {name: 'Alice'}) SET u.age = 32;
MATCH (u:User {name: 'Alice'}) SET u.email = NULL;  -- removes property (NOT REMOVE)

-- Delete node (must have no relationships, or use DETACH DELETE)
MATCH (u:User {name: 'Alice'}) DELETE u;
MATCH (u:User {name: 'Alice'}) DETACH DELETE u;  -- also deletes relationships

-- Delete relationship
MATCH (:User {name: 'Alice'})-[f:Follows]->(:User {name: 'Bob'}) DELETE f;
```

---

## Querying — MATCH

```cypher
-- Basic pattern
MATCH (u:User) RETURN u.name, u.age ORDER BY u.age DESC LIMIT 10;

-- Filter
MATCH (u:User) WHERE u.age > 25 AND u.name STARTS WITH 'A' RETURN u;

-- Relationship traversal
MATCH (a:User)-[f:Follows]->(b:User) RETURN a.name, b.name, f.since;

-- Variable-length path (MUST have upper bound)
MATCH (a:User)-[:Follows*1..3]->(b:User) RETURN a.name, b.name;

-- Shortest path
MATCH p = shortestPath((a:User {name:'Alice'})-[:Follows*]->(b:User {name:'Charlie'}))
RETURN p;

-- Optional match
MATCH (u:User) OPTIONAL MATCH (u)-[:LivesIn]->(c:City) RETURN u.name, c.name;

-- Aggregation
MATCH (u:User)-[:Follows]->(f:User)
RETURN u.name, COUNT(f) AS followers, AVG(f.age) AS avg_follower_age;

-- WITH pipeline
MATCH (u:User)-[:Follows]->(f:User)
WITH u, COUNT(f) AS cnt
WHERE cnt > 5
RETURN u.name, cnt ORDER BY cnt DESC;

-- UNWIND (instead of FOREACH)
UNWIND [1, 2, 3] AS x RETURN x * 2;
UNWIND $names AS name MERGE (u:User {name: name});

-- UNION
MATCH (u:User) RETURN u.name AS name
UNION ALL
MATCH (c:City) RETURN c.name AS name;
```

### Subqueries

```cypher
-- EXISTS subquery
MATCH (a:User)
WHERE EXISTS { MATCH (a)-[:Follows*3..3]->(b:User) }
RETURN a.name;

-- COUNT subquery
MATCH (a:User)
RETURN a.name, COUNT { MATCH (a)<-[:Follows]-(b:User) } AS followers;
```

### Projecting properties

```cypher
-- Return all properties of a node
MATCH (u:User) RETURN u.*;

-- Collect into list
MATCH (u:User)-[:Follows]->(f:User)
RETURN u.name, collect(f.name) AS following;
```

---

## Transactions

```cypher
BEGIN TRANSACTION;
CREATE (u:User {name: 'Dave', age: 28});
COMMIT;

BEGIN TRANSACTION READ ONLY;
MATCH (u:User) RETURN u.name;
ROLLBACK;

CHECKPOINT;  -- flush WAL to disk
```

---

## Macros

Reusable scalar expressions (not full procedures):

```cypher
CREATE MACRO addWithDefault(a, b:=3) AS a + b;
RETURN addWithDefault(2);        -- 5
RETURN addWithDefault(2, 10);    -- 12

CREATE MACRO fullName(first, last) AS first + ' ' + last;
MATCH (u:User) RETURN fullName(u.first_name, u.last_name);
```

---

## LadybugDB vs Neo4j — Key Differences

| Concept | Neo4j | LadybugDB |
|---------|-------|-----------|
| Schema | Optional (schema-free) | Required (CREATE NODE/REL TABLE) |
| MATCH semantics | Trail (no repeated edges) | Walk (repeated edges allowed) |
| Remove property | `REMOVE n.prop` | `SET n.prop = NULL` |
| Node labels | `labels(n)` → list | `label(n)` → single string |
| Node identity | `elementId(n)` | `id(n)` |
| Loop iteration | `FOREACH` | `UNWIND` |
| CSV import | `LOAD CSV FROM 'file' AS row` | `LOAD FROM 'file.csv' RETURN *` |
| List concat | `+` operator | `list_concat(a, b)` |
| List sort | `apoc.coll.sort(list)` | `list_sort(list)` |
| Indexes | Manual creation | Primary key index is automatic |
| Variable paths | No upper bound needed | Upper bound required (default 30) |
| Stored procedures | APOC | Extensions (`algo`, `fts`, `vector`) |

---

## Useful built-in functions

```cypher
-- Node/rel info
id(n)            -- internal ID
label(n)         -- node label string
type(r)          -- relationship type string
properties(n)    -- map of all properties

-- String
toLower(s), toUpper(s), trim(s), size(s)
substring(s, start, length)
split(s, delimiter)
replace(s, search, replacement)

-- Math
abs(n), ceil(n), floor(n), round(n), sqrt(n), log(n)
min(x, y), max(x, y)

-- List
list_concat(a, b), list_sort(lst), list_reverse(lst)
list_unique(lst), list_sum(lst), list_avg(lst)
size(lst), lst[0], lst[-1]

-- Type conversion
toInteger(x), toFloat(x), toString(x), toBoolean(x)
date('2024-01-15'), timestamp('2024-01-15T10:00:00')

-- Null handling
coalesce(a, b, c)   -- first non-null
nullIf(a, b)        -- null if a == b
```
