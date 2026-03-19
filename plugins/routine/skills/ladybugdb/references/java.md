# LadybugDB Java API

```xml
<!-- Maven -->
<dependency>
  <groupId>com.ladybugdb</groupId>
  <artifactId>lbug</artifactId>
  <version>0.11.0</version>
</dependency>
```

## Connection setup

```java
import com.ladybugdb.Database;
import com.ladybugdb.Connection;
import com.ladybugdb.QueryResult;

Database db = new Database("mydb.lbug");
// Database db = new Database(":memory:");
// Database db = new Database("mydb.lbug", DatabaseConfig.builder().readOnly(true).build());

Connection conn = new Connection(db);
```

## Executing queries

```java
// DDL
conn.execute("CREATE NODE TABLE User(name STRING PRIMARY KEY, age INT64)");
conn.execute("CREATE REL TABLE Follows(FROM User TO User, since INT64)");

// Parameterized query
QueryResult result = conn.execute(
    "MATCH (u:User {name: $name}) RETURN u.age",
    Map.of("name", "Alice")
);

// Iterate results
while (result.hasNext()) {
    Map<String, Object> row = result.next();
    System.out.println(row.get("u.age"));
}

// Collect all rows
List<Map<String, Object>> rows = result.getAll();
```

## Transactions

```java
conn.execute("BEGIN TRANSACTION");
try {
    conn.execute("CREATE (u:User {name: 'Alice', age: 30})");
    conn.execute("COMMIT");
} catch (Exception e) {
    conn.execute("ROLLBACK");
    throw e;
}
```

## Cleanup

```java
conn.close();
db.close();
```

## Concurrency

- One `READ_WRITE` `Database` per file at a time
- Multiple `Connection` objects from one `Database` are thread-safe
- Use a connection pool for high-throughput servers
