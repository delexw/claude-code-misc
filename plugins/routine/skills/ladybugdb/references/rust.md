# LadybugDB Rust API

```toml
# Cargo.toml
[dependencies]
lbug = "0.11"
```

## Connection setup

```rust
use lbug::{Database, Connection, Value};

fn main() -> lbug::Result<()> {
    let db = Database::new("mydb.lbug")?;
    // let db = Database::new(":memory:")?;
    // let db = Database::open_read_only("mydb.lbug")?;

    let conn = Connection::new(&db)?;
    // ...
    Ok(())
}
```

## Executing queries

```rust
// DDL
conn.execute("CREATE NODE TABLE User(name STRING PRIMARY KEY, age INT64)", &[])?;
conn.execute("CREATE REL TABLE Follows(FROM User TO User, since INT64)", &[])?;

// Parameterized insert
conn.execute(
    "CREATE (u:User {name: $name, age: $age})",
    &[("name", Value::String("Alice".into())), ("age", Value::Int64(30))],
)?;

// Query and iterate
let result = conn.query("MATCH (u:User) RETURN u.name, u.age", &[])?;
for row in result {
    let row = row?;
    println!("{:?} {:?}", row.get("u.name"), row.get("u.age"));
}

// Collect all rows
let rows: Vec<_> = conn.query("MATCH (u:User) RETURN u.*", &[])?.collect::<lbug::Result<_>>()?;
```

## Transactions

```rust
conn.execute("BEGIN TRANSACTION", &[])?;
conn.execute("CREATE (u:User {name: $name, age: $age})",
    &[("name", Value::String("Bob".into())), ("age", Value::Int64(25))])?;
conn.execute("COMMIT", &[])?;
```

## Value types

```rust
Value::Bool(true)
Value::Int64(42)
Value::Float64(3.14)
Value::String("hello".into())
Value::Null
Value::List(vec![Value::Int64(1), Value::Int64(2)])
```

## Concurrency

- `Database` is `Send + Sync`; wrap in `Arc` to share across threads
- Multiple `Connection` objects from one `Database` are safe
- One write transaction at a time; reads are concurrent
