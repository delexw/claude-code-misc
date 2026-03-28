# @a2a-js/sdk API Reference

Complete API reference for the A2A JavaScript/TypeScript SDK.

## Table of Contents

1. [Installation & Imports](#installation--imports)
2. [Server API](#server-api)
3. [Client API](#client-api)
4. [Type Definitions](#type-definitions)
5. [Express Handlers](#express-handlers)
6. [gRPC Integration](#grpc-integration)

---

## Installation & Imports

```bash
npm install @a2a-js/sdk
npm install express          # For Express server
npm install @grpc/grpc-js @bufbuild/protobuf  # For gRPC
```

### Import Paths

```typescript
// Core types and constants
import {
  AgentCard,
  AgentSkill,
  AgentInterface,
  Message,
  Task,
  TaskStatus,
  TaskState,
  Part,
  Artifact,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  PushNotificationConfig,
  SendMessageConfiguration,
  AGENT_CARD_PATH,          // "/.well-known/agent-card.json"
} from '@a2a-js/sdk';

// Server components
import {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
  DefaultRequestHandler,
  InMemoryTaskStore,
  TaskStore,
} from '@a2a-js/sdk/server';

// Express integration
import {
  agentCardHandler,
  jsonRpcHandler,
  restHandler,
  UserBuilder,
} from '@a2a-js/sdk/server/express';

// Client components
import {
  ClientFactory,
  A2AClient,
} from '@a2a-js/sdk/client';

// gRPC (Node.js only)
import { GrpcTransportFactory } from '@a2a-js/sdk/client/grpc';
import { GrpcServer } from '@a2a-js/sdk/server/grpc';
```

---

## Server API

### AgentExecutor (Interface)

The core interface for implementing agent logic.

```typescript
interface AgentExecutor {
  execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void>;

  cancelTask(): Promise<void>;
}
```

**`execute(requestContext, eventBus)`**
- Called when a message is received for this agent
- `requestContext` contains the incoming message, task state, and identifiers
- `eventBus` is used to publish response events
- Must call `eventBus.finished()` before returning

**`cancelTask()`**
- Called when a client requests task cancellation
- Clean up any in-flight resources

### RequestContext

```typescript
interface RequestContext {
  taskId: string;           // Unique task ID (server-generated)
  contextId: string;        // Conversation context ID
  userMessage: Message;     // The incoming user message
  task?: Task;              // Existing task (undefined for new tasks)
}
```

### ExecutionEventBus

```typescript
interface ExecutionEventBus {
  publish(event: Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent): void;
  finished(): void;
}
```

**`publish(event)`** — Emit an event. Accepted event types:
- `Message` — a direct message response
- `Task` — full task state (typically for initialization)
- `TaskStatusUpdateEvent` — status/state change
- `TaskArtifactUpdateEvent` — output artifact

**`finished()`** — Signal that execution is complete. Always call this.

### DefaultRequestHandler

Orchestrates the full request lifecycle.

```typescript
class DefaultRequestHandler {
  constructor(
    agentCard: AgentCard,
    taskStore: TaskStore,
    executor: AgentExecutor
  );
}
```

Handles:
- Incoming request routing
- Task creation and state management
- Executor invocation
- Event bus lifecycle
- Agent card serving

### TaskStore (Interface)

```typescript
interface TaskStore {
  getTask(taskId: string): Promise<Task | undefined>;
  createTask(task: Task): Promise<void>;
  updateTask(task: Task): Promise<void>;
  listTasks(filters: ListTasksRequest): Promise<ListTasksResponse>;
}
```

### InMemoryTaskStore

Built-in implementation of `TaskStore` that stores tasks in memory. Suitable for development and testing.

```typescript
const store = new InMemoryTaskStore();
```

---

## Client API

### ClientFactory

Creates A2A clients with automatic transport selection.

```typescript
class ClientFactory {
  constructor(options?: {
    transports?: TransportFactory[];  // Override default transports
  });

  createFromUrl(baseUrl: string): Promise<A2AClient>;
}
```

**`createFromUrl(baseUrl)`**
1. Fetches the Agent Card from `baseUrl/.well-known/agent-card.json`
2. Inspects `additionalInterfaces` for available transports
3. Creates a client using the best matching transport

### A2AClient

```typescript
interface A2AClient {
  // Core operations
  sendMessage(request: SendMessageRequest): Promise<Task | Message>;
  sendStreamingMessage(request: SendMessageRequest): AsyncIterable<StreamResponse>;

  // Task management
  getTask(request: GetTaskRequest): Promise<Task>;
  listTasks(request: ListTasksRequest): Promise<ListTasksResponse>;
  cancelTask(request: CancelTaskRequest): Promise<Task>;

  // Streaming subscription
  subscribeToTask(request: SubscribeToTaskRequest): AsyncIterable<StreamResponse>;

  // Push notifications
  createPushConfig(request: CreatePushConfigRequest): Promise<PushNotificationConfig>;
  getPushConfig(request: GetPushConfigRequest): Promise<PushNotificationConfig>;
  listPushConfigs(request: ListPushConfigsRequest): Promise<ListPushConfigsResponse>;
  deletePushConfig(request: DeletePushConfigRequest): Promise<void>;

  // Discovery
  getExtendedAgentCard(): Promise<AgentCard>;
}
```

### SendMessageRequest

```typescript
interface SendMessageRequest {
  message: Message;
  taskId?: string;                     // Continue existing task
  contextId?: string;                  // Continue existing context
  configuration?: SendMessageConfiguration;
}
```

### StreamResponse

```typescript
type StreamResponse =
  | { kind: 'task'; task: Task }
  | { kind: 'message'; message: Message }
  | { kind: 'status-update'; statusUpdate: TaskStatusUpdateEvent }
  | { kind: 'artifact-update'; artifactUpdate: TaskArtifactUpdateEvent };
```

---

## Express Handlers

### agentCardHandler

Serves the Agent Card at the well-known path.

```typescript
function agentCardHandler(options: {
  agentCardProvider: DefaultRequestHandler;
}): express.RequestHandler;
```

Usage:
```typescript
app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: handler }));
```

### jsonRpcHandler

Handles JSON-RPC 2.0 transport.

```typescript
function jsonRpcHandler(options: {
  requestHandler: DefaultRequestHandler;
  userBuilder: UserBuilder;
}): express.RequestHandler;
```

### restHandler

Handles HTTP+JSON/REST transport.

```typescript
function restHandler(options: {
  requestHandler: DefaultRequestHandler;
  userBuilder: UserBuilder;
}): express.RequestHandler;
```

### UserBuilder

Authentication configuration.

```typescript
class UserBuilder {
  static noAuthentication: UserBuilder;  // No auth (development only)
  // Custom implementations for production auth
}
```

---

## gRPC Integration

### GrpcServer (Server-Side)

```typescript
class GrpcServer {
  constructor(handler: DefaultRequestHandler);
  start(port: number): void;
}
```

### GrpcTransportFactory (Client-Side)

```typescript
class GrpcTransportFactory implements TransportFactory {
  // Pass to ClientFactory to force gRPC transport
}
```

Usage:
```typescript
const factory = new ClientFactory({
  transports: [new GrpcTransportFactory()],
});
```

---

## Type Definitions

### Full Type Listing

```typescript
// Agent Card types
interface AgentCard { ... }       // See protocol-spec.md
interface AgentSkill { ... }
interface AgentInterface { ... }
interface AgentCapabilities { ... }

// Message types
interface Message {
  kind: 'message';
  messageId: string;
  role: 'user' | 'agent';
  parts: Part[];
  contextId?: string;
  referenceTaskIds?: string[];
  metadata?: Record<string, unknown>;
}

type Part =
  | TextPart
  | FilePart
  | DataPart;

interface TextPart {
  kind: 'text';
  text: string;
}

interface FilePart {
  kind: 'file';
  file: {
    url?: string;
    data?: string;        // base64
    mimeType: string;
    name?: string;
  };
}

interface DataPart {
  kind: 'data';
  data: Record<string, unknown>;
}

// Task types
interface Task {
  kind: 'task';
  id: string;
  contextId: string;
  status: TaskStatus;
  history?: Message[];
  artifacts?: Artifact[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

interface TaskStatus {
  state: TaskState;
  message?: string;
  progress?: number;      // 0-100
  metadata?: Record<string, unknown>;
}

type TaskState =
  | 'working'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'rejected'
  | 'input_required'
  | 'auth_required';

// Artifact
interface Artifact {
  artifactId: string;
  name?: string;
  mimeType?: string;
  parts: Part[];
  metadata?: Record<string, unknown>;
}

// Events
interface TaskStatusUpdateEvent {
  kind: 'status-update';
  taskId: string;
  contextId: string;
  status: TaskStatus;
  final?: boolean;
}

interface TaskArtifactUpdateEvent {
  kind: 'artifact-update';
  taskId: string;
  contextId: string;
  artifact: Artifact;
}

// Configuration
interface SendMessageConfiguration {
  acceptedOutputModes?: string[];
  pushNotificationConfig?: PushNotificationConfig;
  historyLength?: number;
  blocking?: boolean;
}

interface PushNotificationConfig {
  id?: string;
  url: string;
  authenticationInfo?: {
    scheme: string;
    credentials: Record<string, unknown>;
  };
  eventTypes?: string[];
  retryPolicy?: Record<string, unknown>;
  active?: boolean;
}

// Constants
const AGENT_CARD_PATH = '.well-known/agent-card.json';
```
