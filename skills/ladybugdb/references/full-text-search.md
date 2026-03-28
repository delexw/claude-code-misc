# LadybugDB Full-Text Search (BM25)

LadybugDB's FTS extension uses BM25 (Okapi) scoring with language-aware stemming. It indexes one or more `STRING` columns on a node table.

## Create an FTS index

```cypher
-- Index one or more string columns
CALL CREATE_FTS_INDEX('Book', 'book_fts', ['title', 'abstract']);

-- With a language stemmer (28+ languages supported)
CALL CREATE_FTS_INDEX('Article', 'article_fts', ['title', 'body'],
    stemmer:='english');

-- Available stemmers:
-- arabic, basque, catalan, danish, dutch, english, finnish, french,
-- german, greek, hindi, hungarian, indonesian, irish, italian,
-- lithuanian, nepali, norwegian, portuguese, romanian, russian,
-- serbian, spanish, swedish, tamil, turkish, yiddish
```

## Query the FTS index

```cypher
-- Disjunctive search (any term matches)
CALL QUERY_FTS_INDEX('Book', 'book_fts', 'quantum computing')
RETURN node.title, score ORDER BY score DESC LIMIT 10;

-- Conjunctive search (all terms must match)
CALL QUERY_FTS_INDEX('Book', 'book_fts', 'quantum machine',
    conjunctive:=true, TOP:=10)
RETURN node, score;

-- Filter results after FTS scoring
CALL QUERY_FTS_INDEX('Article', 'article_fts', 'neural networks', TOP:=50)
WITH node AS a, score
WHERE a.year >= 2020
RETURN a.title, a.year, score ORDER BY score DESC;

-- Join FTS results with graph traversal
CALL QUERY_FTS_INDEX('Paper', 'paper_fts', 'transformer attention', TOP:=20)
WITH node AS p, score
MATCH (p)-[:CITES]->(ref:Paper)
RETURN p.title, score, collect(ref.title) AS citations
ORDER BY score DESC LIMIT 10;
```

## Manage FTS indexes

```cypher
-- List all indexes (FTS and vector)
CALL SHOW_INDEXES() RETURN *;

-- Drop an FTS index
CALL DROP_FTS_INDEX('Book', 'book_fts');
```

## How BM25 scoring works

BM25 scores documents by term frequency (how often the search term appears in a document) balanced against document length (longer documents aren't unfairly favored). A higher score means a better match. The score is not normalized to any fixed range — use it for ranking, not as an absolute relevance threshold.

## Tips

- Index multiple columns to search across them in a single query
- Use `conjunctive:=true` for precision (all terms must appear); default disjunctive mode gives broader recall
- Fetch more results with `TOP:=N` then post-filter with `WHERE` for combined FTS + property filtering
- Stemming (`stemmer:='english'`) matches morphological variants: "running" matches "run", "runs"
- Stopwords (common words like "the", "is") are automatically filtered out
