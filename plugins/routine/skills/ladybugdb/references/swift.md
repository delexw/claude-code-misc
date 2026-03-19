# LadybugDB Swift API

```swift
// Package.swift
.package(url: "https://github.com/LadybugDB/ladybug-swift.git", from: "0.11.0")

// Target dependency
.product(name: "LadybugDB", package: "ladybug-swift")
```

**Platforms**: macOS 11+, iOS 14+, Linux (no Windows support)

## Connection setup

```swift
import LadybugDB

let db = try Database(path: "mydb.lbug")
// let db = try Database(path: ":memory:")
// let db = try Database(path: "mydb.lbug", readOnly: true)

let conn = try Connection(database: db)
```

## Executing queries

```swift
// DDL
try conn.execute("CREATE NODE TABLE User(name STRING PRIMARY KEY, age INT64)")
try conn.execute("CREATE REL TABLE Follows(FROM User TO User, since INT64)")

// Parameterized
try conn.execute(
    "CREATE (u:User {name: $name, age: $age})",
    parameters: ["name": "Alice", "age": 30]
)

// Query
let result = try conn.query("MATCH (u:User) RETURN u.name, u.age")
for row in result {
    print(row["u.name"]!, row["u.age"]!)
}

// Collect all rows
let rows = try conn.query("MATCH (u:User) RETURN u.*").getAll()
```

## Transactions

```swift
try conn.execute("BEGIN TRANSACTION")
do {
    try conn.execute("CREATE (u:User {name: $name, age: $age})",
                     parameters: ["name": "Bob", "age": 25])
    try conn.execute("COMMIT")
} catch {
    try conn.execute("ROLLBACK")
    throw error
}
```

## Async/await (Swift concurrency)

```swift
// If the SDK provides async variants:
let result = try await conn.queryAsync("MATCH (u:User) RETURN u.*")
```

## Concurrency

- One `READ_WRITE` `Database` per file at a time
- Multiple `Connection` objects are safe on different threads
- Use Swift actors or `DispatchQueue` to serialize write access if needed
