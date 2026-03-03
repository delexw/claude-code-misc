---
name: a2a-js-dev
description: "Build A2A (Agent-to-Agent) protocol applications using the @a2a-js/sdk TypeScript/JavaScript SDK. Use this skill whenever the user wants to create an A2A agent server, build an A2A client, implement agent-to-agent communication, set up agent discovery, handle A2A tasks/streaming, or write any TypeScript/JavaScript code that imports from @a2a-js/sdk. Also triggers when the user mentions 'A2A protocol', 'agent-to-agent', 'agent card', 'AgentExecutor', or references the a2a-js repository — even if they don't explicitly say 'A2A SDK'. Covers both server and client development, all three transport bindings (JSON-RPC, HTTP+JSON/REST, gRPC), and the full task lifecycle."
---

# A2A JavaScript/TypeScript SDK Development Guide

Build standards-compliant agent-to-agent applications using the `@a2a-js/sdk`. This guide covers server agents, clients, task management, streaming, and all three transport bindings.

## Quick Reference

```bash
# Install the SDK
npm install @a2a-js/sdk

# For Express server integration
npm install express

# For gRPC support (Node.js only)
npm install @grpc/grpc-js @bufbuild/protobuf
```

**Import paths:**
```typescript
import { AgentCard, Message, Task, AGENT_CARD_PATH } from '@a2a-js/sdk';
import { AgentExecutor, DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, restHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import { ClientFactory } from '@a2a-js/sdk/client';
import { GrpcTransportFactory } from '@a2a-js/sdk/client/grpc';
```

The SDK implements **A2A Protocol Specification v0.3.0**.

---

## Architecture Overview

An A2A application has two sides:

1. **Server (Agent)** — exposes capabilities via an Agent Card, handles incoming messages, manages tasks, and publishes events
2. **Client (Consumer)** — discovers agents, sends messages, tracks tasks, and consumes streaming updates

The protocol supports three transport bindings. Each transport provides the same operations — pick based on your deployment needs:

| Transport | Client | Server | Notes |
|-----------|--------|--------|-------|
| JSON-RPC | Yes | Yes | Default, works everywhere |
| HTTP+JSON/REST | Yes | Yes | RESTful, good for web clients |
| gRPC | Yes | Yes | Node.js only, high performance |

---

## Building an A2A Server

### Step 1: Define the Agent Card

The Agent Card is the identity and capability declaration for your agent. Other agents discover it at `/.well-known/agent-card.json`.

```typescript
import { AgentCard } from '@a2a-js/sdk';

const agentCard: AgentCard = {
  name: 'My Agent',
  description: 'Describe what your agent does clearly.',
  protocolVersion: '0.3.0',
  version: '1.0.0',
  url: 'http://localhost:4000/a2a/jsonrpc',
  skills: [
    {
      id: 'skill-id',
      name: 'Skill Name',
      description: 'What this skill does',
      tags: ['relevant', 'tags'],
    },
  ],
  capabilities: {
    pushNotifications: false,
    streaming: true,
  },
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  additionalInterfaces: [
    { url: 'http://localhost:4000/a2a/jsonrpc', transport: 'JSONRPC' },
    { url: 'http://localhost:4000/a2a/rest', transport: 'HTTP+JSON' },
  ],
};
```

**Key design decisions for the Agent Card:**
- `skills` — declare what your agent can do so clients can match capabilities
- `capabilities` — advertise streaming and push notification support honestly; clients check these before using those features
- `additionalInterfaces` — list all transport endpoints you support so `ClientFactory` can auto-select

### Step 2: Implement the AgentExecutor

This is where your agent's logic lives. The `execute` method receives a `RequestContext` and an `ExecutionEventBus`.

```typescript
import { AgentExecutor, RequestContext, ExecutionEventBus } from '@a2a-js/sdk/server';
import { Message, Task, TaskStatusUpdateEvent, TaskArtifactUpdateEvent } from '@a2a-js/sdk';
import { v4 as uuidv4 } from 'uuid';

class MyAgentExecutor implements AgentExecutor {
  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const { taskId, contextId, userMessage, task } = requestContext;

    // Access the user's message text
    const userText = userMessage.parts
      .filter((p) => p.kind === 'text')
      .map((p) => p.text)
      .join('\n');

    // If this is a new task (no existing task), initialize it
    if (!task) {
      const newTask: Task = {
        kind: 'task',
        id: taskId,
        contextId,
        status: { state: 'working', timestamp: new Date().toISOString() },
        history: [userMessage],
      };
      eventBus.publish(newTask);
    }

    // --- Your agent logic goes here ---
    // Call your AI model, run tools, process data, etc.
    const result = await doSomethingUseful(userText);

    // Publish an artifact if your agent produces output files/data
    const artifactUpdate: TaskArtifactUpdateEvent = {
      kind: 'artifact-update',
      taskId,
      contextId,
      artifact: {
        artifactId: uuidv4(),
        name: 'result.txt',
        parts: [{ kind: 'text', text: result }],
      },
    };
    eventBus.publish(artifactUpdate);

    // Signal task completion
    const statusUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId,
      contextId,
      status: { state: 'completed', timestamp: new Date().toISOString() },
      final: true,
    };
    eventBus.publish(statusUpdate);

    // Always call finished() to signal execution is done
    eventBus.finished();
  }

  async cancelTask(): Promise<void> {
    // Handle cancellation — clean up resources, abort in-flight work
  }
}
```

**RequestContext fields:**
- `taskId` — unique task identifier (server-generated)
- `contextId` — conversation context identifier
- `userMessage` — the incoming `Message` object
- `task` — the existing `Task` object if this continues an existing task, or `undefined` for new tasks

**ExecutionEventBus methods:**
- `publish(event)` — emit a `Message`, `Task`, `TaskStatusUpdateEvent`, or `TaskArtifactUpdateEvent`
- `finished()` — signal that execution is complete (always call this)

### Step 3: Wire Up the Server

```typescript
import express from 'express';
import { AGENT_CARD_PATH } from '@a2a-js/sdk';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import {
  agentCardHandler,
  jsonRpcHandler,
  restHandler,
  UserBuilder,
} from '@a2a-js/sdk/server/express';

const executor = new MyAgentExecutor();
const handler = new DefaultRequestHandler(
  agentCard,
  new InMemoryTaskStore(),
  executor
);

const app = express();

// Agent Card discovery endpoint
app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: handler }));

// JSON-RPC transport
app.use(
  '/a2a/jsonrpc',
  jsonRpcHandler({
    requestHandler: handler,
    userBuilder: UserBuilder.noAuthentication, // Use proper auth in production
  })
);

// REST transport
app.use(
  '/a2a/rest',
  restHandler({
    requestHandler: handler,
    userBuilder: UserBuilder.noAuthentication,
  })
);

app.listen(4000, () => {
  console.log('A2A agent running on http://localhost:4000');
});
```

**`DefaultRequestHandler`** orchestrates the full request lifecycle — it manages task creation, state transitions, executor invocation, and event routing. You don't need to handle this yourself.

**`InMemoryTaskStore`** is fine for development. For production, implement the `TaskStore` interface backed by your database.

### Adding gRPC Support

```typescript
import { GrpcServer } from '@a2a-js/sdk/server/grpc';

// Add gRPC alongside Express
const grpcServer = new GrpcServer(handler);
grpcServer.start(4001);

// Update your Agent Card's additionalInterfaces to include:
// { url: 'http://localhost:4001', transport: 'GRPC' }
```

---

## Building an A2A Client

### Auto-Discovery Client

The `ClientFactory` fetches the Agent Card and auto-selects the best transport:

```typescript
import { ClientFactory } from '@a2a-js/sdk/client';
import { v4 as uuidv4 } from 'uuid';

const factory = new ClientFactory();
const client = await factory.createFromUrl('http://localhost:4000');

// Send a message
const response = await client.sendMessage({
  message: {
    messageId: uuidv4(),
    role: 'user',
    parts: [{ kind: 'text', text: 'Hello, agent!' }],
    kind: 'message',
  },
});
```

### Explicit gRPC Client

```typescript
import { ClientFactory } from '@a2a-js/sdk/client';
import { GrpcTransportFactory } from '@a2a-js/sdk/client/grpc';

const factory = new ClientFactory({
  transports: [new GrpcTransportFactory()],
});
const client = await factory.createFromUrl('http://localhost:4000');
```

### Task Operations

```typescript
// Get a task by ID
const task = await client.getTask({ taskId: 'some-task-id' });

// Cancel a task
const canceled = await client.cancelTask({ taskId: 'some-task-id' });
```

---

## Task Lifecycle

Tasks are the core unit of work in A2A. They progress through a state machine:

```
                    ┌─── completed
                    │
working ───────────┼─── failed
                    │
                    ├─── canceled
                    │
                    ├─── rejected
                    │
                    └─── input_required ──┐
                         auth_required ───┤
                                          │
                                          └──→ (resume with new message)
                                                  ↓
                                               working → ...
```

**Terminal states:** `completed`, `failed`, `canceled`, `rejected`
**Interrupted states:** `input_required`, `auth_required` — the agent pauses and waits for the client to send more information

### Multi-Turn Conversations

Use `contextId` to group related tasks into a conversation, and `taskId` to continue a specific task:

```typescript
// Start a new conversation
const response1 = await client.sendMessage({
  message: { messageId: uuidv4(), role: 'user', parts: [{ kind: 'text', text: 'Analyze this data...' }], kind: 'message' },
});

// Continue the same task (if agent returned input_required)
const taskId = response1.id; // from the Task response
const response2 = await client.sendMessage({
  message: { messageId: uuidv4(), role: 'user', parts: [{ kind: 'text', text: 'Here is the additional info...' }], kind: 'message' },
  taskId: taskId,
});

// New task in the same conversation context
const contextId = response1.contextId;
const response3 = await client.sendMessage({
  message: { messageId: uuidv4(), role: 'user', parts: [{ kind: 'text', text: 'Now do something else...' }], kind: 'message' },
  contextId: contextId,
});
```

---

## Streaming

For long-running tasks, use streaming to get real-time updates:

### Server-Side Streaming

The executor publishes events incrementally — the SDK handles SSE/streaming transport automatically:

```typescript
class StreamingExecutor implements AgentExecutor {
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { taskId, contextId } = requestContext;

    // Publish progress updates
    eventBus.publish({
      kind: 'status-update',
      taskId,
      contextId,
      status: { state: 'working', message: 'Processing step 1...', progress: 25, timestamp: new Date().toISOString() },
      final: false,
    });

    // ... do work ...

    eventBus.publish({
      kind: 'status-update',
      taskId,
      contextId,
      status: { state: 'working', message: 'Processing step 2...', progress: 75, timestamp: new Date().toISOString() },
      final: false,
    });

    // Publish final artifact and completion
    eventBus.publish({
      kind: 'artifact-update',
      taskId,
      contextId,
      artifact: { artifactId: 'out-1', name: 'output.json', parts: [{ kind: 'text', text: JSON.stringify(result) }] },
    });

    eventBus.publish({
      kind: 'status-update',
      taskId,
      contextId,
      status: { state: 'completed', timestamp: new Date().toISOString() },
      final: true,
    });

    eventBus.finished();
  }

  async cancelTask(): Promise<void> {}
}
```

### Client-Side Streaming

```typescript
// Subscribe to streaming updates
const stream = await client.sendStreamingMessage({
  message: { messageId: uuidv4(), role: 'user', parts: [{ kind: 'text', text: 'Do a long task...' }], kind: 'message' },
});

for await (const event of stream) {
  if (event.kind === 'status-update') {
    console.log(`Status: ${event.status.state} - ${event.status.message} (${event.status.progress}%)`);
  } else if (event.kind === 'artifact-update') {
    console.log(`Artifact: ${event.artifact.name}`);
  } else if (event.kind === 'task') {
    console.log(`Task ${event.id} created`);
  }
}
```

---

## Event Types Reference

Events published through the `ExecutionEventBus`:

| Event Kind | Purpose | Key Fields |
|------------|---------|------------|
| `message` | Direct message response | `messageId`, `role`, `parts`, `contextId` |
| `task` | Task creation/full state | `id`, `contextId`, `status`, `history`, `artifacts` |
| `status-update` | Task status change | `taskId`, `contextId`, `status`, `final` |
| `artifact-update` | Task output artifact | `taskId`, `contextId`, `artifact` |

Set `final: true` on the last `status-update` to indicate the task has reached a terminal or interrupted state.

---

## Message Parts

Messages and artifacts contain `parts` — the content units:

```typescript
// Text content
{ kind: 'text', text: 'Hello world' }

// File reference
{ kind: 'file', file: { url: 'https://...', mimeType: 'application/pdf' } }

// Inline file data (base64)
{ kind: 'file', file: { data: 'base64encodeddata...', mimeType: 'image/png', name: 'chart.png' } }

// Structured data
{ kind: 'data', data: { key: 'value', nested: { field: 42 } } }
```

---

## Common Patterns

### Simple Request-Response Agent (No Tasks)

For agents that just reply to messages without creating persistent tasks:

```typescript
class SimpleAgent implements AgentExecutor {
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const responseMessage: Message = {
      kind: 'message',
      messageId: uuidv4(),
      role: 'agent',
      parts: [{ kind: 'text', text: 'Here is my response.' }],
      contextId: requestContext.contextId,
    };
    eventBus.publish(responseMessage);
    eventBus.finished();
  }

  async cancelTask(): Promise<void> {}
}
```

### Agent That Requests More Input

```typescript
class InteractiveAgent implements AgentExecutor {
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { taskId, contextId, task } = requestContext;

    if (!task) {
      // First turn — ask for clarification
      const newTask: Task = {
        kind: 'task',
        id: taskId,
        contextId,
        status: { state: 'input_required', timestamp: new Date().toISOString() },
        history: [requestContext.userMessage],
      };
      eventBus.publish(newTask);

      const question: Message = {
        kind: 'message',
        messageId: uuidv4(),
        role: 'agent',
        parts: [{ kind: 'text', text: 'Could you clarify what format you need?' }],
        contextId,
      };
      eventBus.publish(question);
      eventBus.finished();
      return;
    }

    // Second turn — we have the clarification, complete the task
    eventBus.publish({
      kind: 'status-update',
      taskId,
      contextId,
      status: { state: 'completed', timestamp: new Date().toISOString() },
      final: true,
    });
    eventBus.finished();
  }

  async cancelTask(): Promise<void> {}
}
```

---

## Protocol Details

For the full A2A protocol specification (JSON-RPC methods, REST endpoints, error codes, security schemes, push notifications), see `references/protocol-spec.md`.

For the complete SDK API surface and type definitions, see `references/sdk-api.md`.

---

## Checklist: Building an A2A Agent

1. Define your Agent Card with accurate skills and capabilities
2. Implement `AgentExecutor` with your business logic
3. Use `DefaultRequestHandler` + `InMemoryTaskStore` (or custom store)
4. Mount Express handlers for your chosen transports
5. Always call `eventBus.finished()` at the end of `execute()`
6. Set `final: true` on the last status-update event
7. Handle `cancelTask()` if your agent does long-running work
8. Test with `ClientFactory` auto-discovery
