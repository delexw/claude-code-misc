# LadybugDB Node.js API (`@ladybugdb/core`)

```bash
npm install @ladybugdb/core
# nightly: npm i lbug@next
```

## Connection setup

```javascript
import { Database } from "@ladybugdb/core";

const db = await Database.create("mydb.lbug");      // on-disk
const db = await Database.create(":memory:");        // in-memory
const db = await Database.create("mydb.lbug", { readOnly: true });

const conn = await db.connect();
```

## Executing queries

```javascript
// Basic query
const result = await conn.query("MATCH (u:User) RETURN u.name, u.age");
console.log(result.getAll());   // array of objects

// Parameterized
const result = await conn.query(
  "MATCH (u:User {name: $name}) RETURN u",
  { name: "Alice" }
);

// Streaming large results
const stream = await conn.queryStream("MATCH (u:User) RETURN u.*");
for await (const row of stream) {
  console.log(row);
}
```

## Transactions

```javascript
const tx = await conn.beginTransaction();
try {
  await tx.query("CREATE (u:User {name: 'Alice', age: 30})");
  await tx.query("CREATE (u:User {name: 'Bob', age: 25})");
  await tx.commit();
} catch (err) {
  await tx.rollback();
  throw err;
}
```

## Schema

```javascript
await conn.query("CREATE NODE TABLE User(name STRING PRIMARY KEY, age INT64)");
await conn.query("CREATE REL TABLE Follows(FROM User TO User, since INT64)");
await conn.query("ALTER TABLE User ADD COLUMN email STRING");
```

## Cleanup

```javascript
await conn.close();
await db.close();
```

## Concurrency

- One `READ_WRITE` database per file at a time; multiple `READ_ONLY` ok
- Multiple connections from one `Database` are safe
- For Express/Fastify: open `Database` at startup, create/close `Connection` per request
