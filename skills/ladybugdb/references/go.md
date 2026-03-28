# LadybugDB Go API

```bash
go get github.com/LadybugDB/ladybug@v0.11.0
```

## Connection setup

```go
package main

import (
    ladybug "github.com/LadybugDB/ladybug"
)

func main() {
    db, err := ladybug.OpenDatabase("mydb.lbug", ladybug.DefaultConfig())
    // db, err := ladybug.OpenDatabase(":memory:", ladybug.DefaultConfig())
    // db, err := ladybug.OpenDatabaseReadOnly("mydb.lbug", ladybug.DefaultConfig())
    if err != nil {
        panic(err)
    }
    defer db.Close()

    conn, err := db.NewConnection()
    if err != nil {
        panic(err)
    }
    defer conn.Close()
}
```

## Executing queries

```go
// DDL
conn.Query("CREATE NODE TABLE User(name STRING PRIMARY KEY, age INT64)")
conn.Query("CREATE REL TABLE Follows(FROM User TO User, since INT64)")

// Parameterized
conn.Query("CREATE (u:User {name: $name, age: $age})",
    ladybug.Params{"name": "Alice", "age": int64(30)})

// Query and iterate
result, err := conn.Query("MATCH (u:User) RETURN u.name, u.age")
if err != nil {
    panic(err)
}
for result.HasNext() {
    row, err := result.Next()
    if err != nil {
        panic(err)
    }
    fmt.Println(row["u.name"], row["u.age"])
}

// Collect all
rows, err := result.GetAll()
```

## Transactions

```go
conn.Query("BEGIN TRANSACTION")
conn.Query("CREATE (u:User {name: $name, age: $age})",
    ladybug.Params{"name": "Bob", "age": int64(25)})
conn.Query("COMMIT")
// conn.Query("ROLLBACK")
```

## Concurrency

- Share one `Database` across goroutines (it's safe)
- Create one `Connection` per goroutine — connections are not goroutine-safe
- Multiple concurrent reads; one write at a time
