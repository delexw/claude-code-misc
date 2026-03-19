# LadybugDB Graph Algorithms (`algo` extension)

Graph algorithms operate on **projected graphs** — lightweight in-memory views of selected node/rel tables. You must project a graph first before running any algorithm.

## Project a graph

```cypher
-- Basic projection
CALL PROJECT_GRAPH('G', ['User'], ['Follows']);

-- Multiple node/rel types
CALL PROJECT_GRAPH('G', ['User', 'City'], ['Follows', 'LivesIn']);

-- Filtered projection (only nodes/rels matching a condition)
CALL PROJECT_GRAPH('G',
    {'User': 'n.active = true'},
    {'Follows': 'r.weight > 0.5'}
);
```

## PageRank

Measures node importance based on link structure.

```cypher
CALL PROJECT_GRAPH('G', ['User'], ['Follows']);
CALL page_rank('G') RETURN node.name, rank ORDER BY rank DESC LIMIT 10;

-- Custom parameters
CALL page_rank('G', damping_factor:=0.85, max_iterations:=50)
RETURN node.name, rank;
```

## Louvain Community Detection

Finds clusters/communities in the graph.

```cypher
CALL PROJECT_GRAPH('G', ['User'], ['Follows']);
CALL louvain('G') RETURN node.name, community_id ORDER BY community_id;

-- Count members per community
CALL louvain('G')
WITH community_id, collect(node.name) AS members
RETURN community_id, size(members) AS size ORDER BY size DESC;
```

## Weakly / Strongly Connected Components

```cypher
-- WCC: ignores edge direction — groups nodes reachable by any path
CALL PROJECT_GRAPH('G', ['User'], ['Follows']);
CALL wcc('G') RETURN node.name, component_id;

-- SCC: respects direction — groups nodes where every node reaches every other
CALL scc('G') RETURN node.name, component_id;
```

## K-Core Decomposition

Finds the most tightly connected "core" of the graph. A node's `core_number` is the largest k such that it belongs to a subgraph where every node has at least k neighbors.

```cypher
CALL PROJECT_GRAPH('G', ['User'], ['Follows']);
CALL k_core('G') RETURN node.name, core_number ORDER BY core_number DESC;

-- Get just the dense core (e.g., k ≥ 5)
CALL k_core('G')
WHERE core_number >= 5
RETURN node.name, core_number;
```

## Shortest Paths

```cypher
-- Single-source BFS from a node
CALL PROJECT_GRAPH('G', ['User'], ['Follows']);
CALL shortest_path('G', source:='Alice') RETURN node.name, distance;

-- Shortest path between two specific nodes (Cypher pattern)
MATCH p = shortestPath((a:User {name:'Alice'})-[:Follows*]->(b:User {name:'Charlie'}))
RETURN p, length(p);

-- All shortest paths between two nodes
MATCH p = allShortestPaths((a:User {name:'Alice'})-[:Follows*]->(b:User {name:'Charlie'}))
RETURN p;
```

## Tips

- Projected graphs are in-memory and temporary — re-project if the underlying data changes
- Use filtered projections to focus algorithms on relevant subgraphs, which also speeds up computation
- Graph algorithms run in parallel automatically using all available CPU cores
