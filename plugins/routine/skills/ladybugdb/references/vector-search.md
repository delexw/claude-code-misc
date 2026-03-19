# LadybugDB Vector Search (HNSW)

LadybugDB stores embeddings as `FLOAT[]` columns and indexes them with a disk-based HNSW (Hierarchical Navigable Small World) index for approximate nearest-neighbor (ANN) search.

## Schema setup

```cypher
-- Add an embedding column
CREATE NODE TABLE Document(
    id INT64 PRIMARY KEY,
    text STRING,
    category STRING,
    embedding FLOAT[]
);

-- Or add to an existing table
ALTER TABLE Document ADD COLUMN embedding FLOAT[];
```

## Create a vector index

```cypher
-- Cosine similarity (most common for text/semantic embeddings)
CALL CREATE_VECTOR_INDEX('Document', 'doc_vec', 'embedding', metric:='cosine');

-- L2 / Euclidean distance
CALL CREATE_VECTOR_INDEX('Document', 'doc_vec', 'embedding', metric:='l2');

-- Other metrics: l2sq, dotproduct

-- HNSW tuning parameters (optional)
CALL CREATE_VECTOR_INDEX('Document', 'doc_vec', 'embedding',
    metric:='cosine',
    ef_construction:=128,   -- higher = better quality index, slower build
    m:=16                   -- neighbors per node; higher = better recall, more memory
);
```

## Query the vector index

```cypher
-- Find top-10 nearest neighbors to a query vector
CALL QUERY_VECTOR_INDEX('Document', 'doc_vec', [0.1, 0.2, 0.3, ...], 10)
RETURN node.id, node.text, distance ORDER BY distance;

-- Combined ANN + property filter (post-filter after ANN retrieval)
-- Fetch more candidates (50) to compensate for filtering
CALL QUERY_VECTOR_INDEX('Document', 'doc_vec', $query_embedding, 50)
WITH node AS d, distance
WHERE d.category = 'science'
RETURN d.id, d.text, distance
ORDER BY distance LIMIT 10;
```

## Manage vector indexes

```cypher
-- List all indexes (FTS and vector)
CALL SHOW_INDEXES() RETURN *;

-- Drop
CALL DROP_VECTOR_INDEX('Document', 'doc_vec');
```

## Inserting vectors

```cypher
-- Inline
CREATE (d:Document {id: 1, text: 'hello world', embedding: [0.1, 0.2, 0.3]});

-- Bulk import from CSV (embedding column as array literal)
COPY Document FROM "docs.csv";

-- From Python with pre-computed embeddings
```

```python
import real_ladybug as lb
import openai

db = lb.Database("docs.lbug")
conn = lb.Connection(db)

client = openai.OpenAI()
texts = ["first doc", "second doc", "third doc"]

for i, text in enumerate(texts):
    emb = client.embeddings.create(
        input=text, model="text-embedding-3-small"
    ).data[0].embedding
    conn.execute(
        "CREATE (d:Document {id: $id, text: $text, embedding: $emb})",
        parameters={"id": i, "text": text, "emb": emb}
    )
```

## Full RAG pattern

```cypher
-- 1. Schema
CREATE NODE TABLE Chunk(
    id INT64 PRIMARY KEY,
    text STRING,
    source STRING,
    embedding FLOAT[]
);

-- 2. Index
CALL CREATE_VECTOR_INDEX('Chunk', 'chunk_vec', 'embedding', metric:='cosine');

-- 3. Query at runtime (pass embedding from application layer)
CALL QUERY_VECTOR_INDEX('Chunk', 'chunk_vec', $query_embedding, 5)
RETURN node.text, node.source, distance;
```

## Choosing a metric

| Metric | Use when |
|--------|----------|
| `cosine` | Text/semantic embeddings (OpenAI, Ollama, etc.) — direction matters, not magnitude |
| `l2` | Image embeddings, spatial data — absolute distance matters |
| `dotproduct` | When vectors are pre-normalized and you want raw dot product |
| `l2sq` | Same as `l2` but avoids a square root — faster, same ranking |
