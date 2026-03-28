# LadybugDB LLM Embeddings (`CREATE_EMBEDDING`)

Generate vector embeddings directly in Cypher using various LLM providers. The result is a `FLOAT[]` you can store in a node property or pass directly to `QUERY_VECTOR_INDEX`.

## OpenAI

```cypher
-- Set API key (or use OPENAI_API_KEY environment variable)
SET openai_api_key = 'sk-...';

RETURN CREATE_EMBEDDING("Hello world", "openai", "text-embedding-3-small");
RETURN CREATE_EMBEDDING("Hello world", "openai", "text-embedding-3-large");
RETURN CREATE_EMBEDDING("Hello world", "openai", "text-embedding-ada-002");
```

## Ollama (local / self-hosted)

```cypher
-- Default endpoint (localhost:11434)
RETURN CREATE_EMBEDDING("text", "ollama", "nomic-embed-text");
RETURN CREATE_EMBEDDING("text", "ollama", "mxbai-embed-large");

-- Custom endpoint
RETURN CREATE_EMBEDDING("text", "ollama", "nomic-embed-text", "http://my-server:11434");
```

## Google (Gemini / Vertex AI)

```cypher
SET google_api_key = '...';
RETURN CREATE_EMBEDDING("text", "google", "text-embedding-004");
RETURN CREATE_EMBEDDING("text", "google", "embedding-001");
```

## Amazon Bedrock

```cypher
-- Uses AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION env vars
RETURN CREATE_EMBEDDING("text", "bedrock", "amazon.titan-embed-text-v2:0");
RETURN CREATE_EMBEDDING("text", "bedrock", "cohere.embed-english-v3");
```

## Voyage AI

```cypher
SET voyage_api_key = '...';
RETURN CREATE_EMBEDDING("text", "voyage", "voyage-3");
RETURN CREATE_EMBEDDING("text", "voyage", "voyage-3-lite");
```

## Store embeddings at insert time

```cypher
-- Generate and store inline
MATCH (d:Document)
WHERE d.embedding IS NULL
WITH d
SET d.embedding = CREATE_EMBEDDING(d.text, "openai", "text-embedding-3-small");
```

## Bulk embedding population (Python)

```python
import real_ladybug as lb
import openai

db = lb.Database("docs.lbug")
conn = lb.Connection(db)
client = openai.OpenAI()

# Fetch documents needing embeddings
rows = conn.execute(
    "MATCH (d:Document) WHERE d.embedding IS NULL RETURN d.id, d.text"
).get_all()

# Generate in batches for efficiency
BATCH = 100
for i in range(0, len(rows), BATCH):
    batch = rows[i:i+BATCH]
    texts = [r["d.text"] for r in batch]
    response = client.embeddings.create(input=texts, model="text-embedding-3-small")
    for row, emb_obj in zip(batch, response.data):
        conn.execute(
            "MATCH (d:Document {id: $id}) SET d.embedding = $emb",
            parameters={"id": row["d.id"], "emb": emb_obj.embedding}
        )
```

## Use at query time

```cypher
-- Generate query embedding and search in one step
WITH CREATE_EMBEDDING("what is quantum entanglement", "openai", "text-embedding-3-small") AS qvec
CALL QUERY_VECTOR_INDEX('Document', 'doc_vec', qvec, 10)
RETURN node.title, distance ORDER BY distance;
```

```python
# Or generate in app layer and pass as parameter
import openai, real_ladybug as lb

client = openai.OpenAI()
conn = lb.Connection(lb.Database("docs.lbug"))

query = "what is quantum entanglement"
qvec = client.embeddings.create(input=query, model="text-embedding-3-small").data[0].embedding

results = conn.execute(
    "CALL QUERY_VECTOR_INDEX('Document', 'doc_vec', $vec, 10) RETURN node.title, distance",
    parameters={"vec": qvec}
).get_all()
```

## Provider comparison

| Provider | Models | Notes |
|----------|--------|-------|
| OpenAI | text-embedding-3-small/large, ada-002 | Best general quality; cloud |
| Ollama | nomic-embed-text, mxbai-embed-large | Free, runs locally; no API key |
| Google | text-embedding-004 | Good multilingual support |
| Bedrock | Titan, Cohere | AWS ecosystem integration |
| Voyage AI | voyage-3, voyage-3-lite | Strong retrieval-optimized models |
