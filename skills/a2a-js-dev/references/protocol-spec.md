# A2A Protocol Specification Reference

Complete reference for the Agent-to-Agent protocol (v0.3.0 / RC v1.0).

## Table of Contents

1. [JSON-RPC Methods](#json-rpc-methods)
2. [REST Endpoints](#rest-endpoints)
3. [Core Data Types](#core-data-types)
4. [Task States](#task-states)
5. [Error Codes](#error-codes)
6. [Push Notifications](#push-notifications)
7. [Security Schemes](#security-schemes)
8. [Service Parameters](#service-parameters)

---

## JSON-RPC Methods

All methods use `jsonrpc: "2.0"` with the `a2a_` prefix:

| Method | Purpose | Returns |
|--------|---------|---------|
| `a2a_sendMessage` | Send a message / create or continue a task | `Task` or `Message` |
| `a2a_sendStreamingMessage` | Send message with streaming response | Stream of `Task`/`Message`/Events |
| `a2a_getTask` | Retrieve a task by ID | `Task` |
| `a2a_listTasks` | Query tasks with filters | `{ tasks, nextPageToken, pageSize, totalSize }` |
| `a2a_cancelTask` | Cancel a running task | Updated `Task` |
| `a2a_subscribeToTask` | Stream updates for an existing task | Stream of Events |
| `a2a_createTaskPushNotificationConfig` | Register a webhook | `PushNotificationConfig` |
| `a2a_getTaskPushNotificationConfig` | Get a webhook config | `PushNotificationConfig` |
| `a2a_listTaskPushNotificationConfigs` | List webhook configs for a task | Array of `PushNotificationConfig` |
| `a2a_deleteTaskPushNotificationConfig` | Remove a webhook | Confirmation |
| `a2a_getExtendedAgentCard` | Get authenticated agent card | `AgentCard` (extended) |

### JSON-RPC Request Structure

```json
{
  "jsonrpc": "2.0",
  "method": "a2a_sendMessage",
  "params": {
    "message": { ... },
    "configuration": { ... }
  },
  "id": "unique-request-id",
  "a2a-version": "0.3",
  "a2a-extensions": "ext-uri-1,ext-uri-2"
}
```

### SendMessageConfiguration

```typescript
interface SendMessageConfiguration {
  acceptedOutputModes?: string[];     // Media types client accepts
  pushNotificationConfig?: PushNotificationConfig;
  historyLength?: number;             // 0 = no history, unset = server default
  blocking?: boolean;                 // true = wait for terminal/interrupted state
}
```

**Blocking behavior:**
- `true` — response waits until task reaches terminal state (completed, failed, canceled, rejected) or interrupted state (input_required, auth_required)
- `false` — returns immediately with task in working state
- No effect on streaming operations

---

## REST Endpoints

All paths use the pattern `/v1/{tenant}/...`:

| Operation | Method | Path |
|-----------|--------|------|
| Send Message | POST | `/v1/{tenant}/agents/messages` |
| Send Streaming Message | POST | `/v1/{tenant}/agents/messages:stream` |
| Get Task | GET | `/v1/{tenant}/tasks/{id}` |
| List Tasks | GET | `/v1/{tenant}/tasks` |
| Cancel Task | POST | `/v1/{tenant}/tasks/{id}:cancel` |
| Subscribe to Task | GET | `/v1/{tenant}/tasks/{id}:subscribe` |
| Create Push Config | POST | `/v1/{tenant}/tasks/{taskId}/pushConfigs` |
| Get Push Config | GET | `/v1/{tenant}/tasks/{taskId}/pushConfigs/{id}` |
| List Push Configs | GET | `/v1/{tenant}/tasks/{taskId}/pushConfigs` |
| Delete Push Config | DELETE | `/v1/{tenant}/tasks/{taskId}/pushConfigs/{id}` |
| Extended Agent Card | GET | `/v1/{tenant}/agents/card:extended` |

**Content-Type:** `application/a2a+json`
**Streaming:** `text/event-stream` (Server-Sent Events)
**Query parameters:** camelCase for GET/list operations

---

## Core Data Types

### AgentCard

```typescript
interface AgentCard {
  name: string;
  description: string;
  version: string;
  protocolVersion: string;   // "0.3.0"
  url: string;               // Primary endpoint
  provider?: {
    name: string;
    url: string;
  };
  capabilities: {
    streaming?: boolean;
    pushNotifications?: boolean;
    extendedAgentCard?: boolean;
  };
  skills: AgentSkill[];
  defaultInputModes: string[];
  defaultOutputModes: string[];
  additionalInterfaces?: AgentInterface[];
  securitySchemes?: SecurityScheme[];
  security?: string[];
  extensions?: AgentExtension[];
  signature?: AgentCardSignature;
}

interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  inputSchema?: object;      // JSON Schema
  outputSchema?: object;     // JSON Schema
  supportedMimeTypes?: string[];
}

interface AgentInterface {
  url: string;
  transport: 'JSONRPC' | 'HTTP+JSON' | 'GRPC';
  name?: string;
  version?: string;
  methods?: string[];
}
```

**Discovery:** Agent cards are published at `/.well-known/a2a-agent-card` (well-known URI).

### Task

```typescript
interface Task {
  kind: 'task';
  id: string;               // Server-generated
  contextId: string;         // Conversation context
  status: TaskStatus;
  history?: Message[];
  artifacts?: Artifact[];
  metadata?: Record<string, unknown>;
  createdAt?: string;        // ISO 8601
  updatedAt?: string;
}

interface TaskStatus {
  state: TaskState;
  message?: string;          // Human-readable status
  progress?: number;         // 0-100
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
```

### Message

```typescript
interface Message {
  kind: 'message';
  messageId: string;
  role: 'user' | 'agent';
  parts: Part[];
  contextId?: string;
  referenceTaskIds?: string[];
  metadata?: Record<string, unknown>;
}
```

### Part (Content Unit)

```typescript
type Part =
  | { kind: 'text'; text: string }
  | { kind: 'file'; file: FileContent }
  | { kind: 'data'; data: Record<string, unknown> };

interface FileContent {
  url?: string;          // Remote file URL
  data?: string;         // Base64-encoded inline data
  mimeType: string;
  name?: string;
}
```

### Artifact

```typescript
interface Artifact {
  id?: string;
  artifactId: string;
  name?: string;
  mimeType?: string;
  parts: Part[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
}
```

### Events

```typescript
interface TaskStatusUpdateEvent {
  kind: 'status-update';
  taskId: string;
  contextId: string;
  status: TaskStatus;
  final?: boolean;        // true = terminal or interrupted state
}

interface TaskArtifactUpdateEvent {
  kind: 'artifact-update';
  taskId: string;
  contextId: string;
  artifact: Artifact;
}
```

---

## Task States

### State Transitions

```
Initial:     working → completed | failed | canceled | rejected | input_required | auth_required
Interrupted: input_required | auth_required → working (via new message) → terminal states
Terminal:    completed | failed | canceled | rejected (no further transitions)
```

### State Descriptions

| State | Meaning | Agent Action |
|-------|---------|--------------|
| `working` | Actively processing | Continue execution |
| `completed` | Successfully finished | Return results in artifacts |
| `failed` | Error during execution | Include error details in status message |
| `canceled` | Client requested cancellation | Clean up resources |
| `rejected` | Agent declined the task | Explain reason in status message |
| `input_required` | Needs more info from client | Ask via agent message, wait for client |
| `auth_required` | Needs authentication | Client sends credentials in next message |

---

## Error Codes

### A2A-Specific Errors

| Error | When |
|-------|------|
| `TaskNotFoundError` | Task ID invalid, expired, or unauthorized |
| `TaskNotCancelableError` | Task already in terminal state |
| `PushNotificationNotSupportedError` | Agent doesn't support push |
| `UnsupportedOperationError` | Operation or feature not supported |
| `ContentTypeNotSupportedError` | Unsupported media type |
| `InvalidAgentResponseError` | Response violates protocol spec |
| `ExtendedAgentCardNotConfiguredError` | Extended card not available |
| `ExtensionSupportRequiredError` | Required extension not declared by client |
| `VersionNotSupportedError` | Protocol version not supported |

### HTTP Status Code Mapping

| Code | Meaning |
|------|---------|
| 400 | Invalid request parameters |
| 401 | Authentication required |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 500 | Internal server error |
| 503 | Service unavailable |

---

## Push Notifications

For long-running tasks, clients can register webhooks to receive updates:

```typescript
interface PushNotificationConfig {
  id?: string;                    // Server-assigned
  url: string;                    // Webhook HTTPS endpoint
  authenticationInfo?: {
    scheme: string;               // "bearer", "api-key"
    credentials: object;
  };
  eventTypes?: string[];          // Filter which events to send
  retryPolicy?: object;
  active?: boolean;
}
```

**Delivery:** HTTP POST to the registered URL with `StreamResponse` objects as payload. Always uses HTTP+JSON regardless of the agent's primary transport.

---

## Security Schemes

Agent Cards declare supported authentication methods:

| Scheme | Description |
|--------|-------------|
| `APIKeySecurityScheme` | API key in header or query parameter |
| `HTTPAuthSecurityScheme` | HTTP auth (e.g., Bearer token) |
| `OAuth2SecurityScheme` | OAuth 2.0 flows (authorization code, client credentials, device code) |
| `OpenIdConnectSecurityScheme` | OpenID Connect via discovery URL |
| `MutualTlsSecurityScheme` | Mutual TLS (mTLS) |

---

## Service Parameters

Passed as headers (HTTP), metadata (gRPC), or top-level fields (JSON-RPC):

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `A2A-Version` | Protocol version | `"0.3"` |
| `A2A-Extensions` | Supported extensions | `"urn:ext:foo,urn:ext:bar"` |

---

## List Tasks Query Filters

```typescript
interface ListTasksRequest {
  contextId?: string;           // Filter by conversation
  status?: TaskState;           // Filter by state
  pageSize?: number;            // 1-100, default 50
  pageToken?: string;           // Cursor for pagination
  historyLength?: number;       // Messages to include per task
  statusTimestampAfter?: string; // ISO 8601 filter
  includeArtifacts?: boolean;   // Default false
}
```

Results sorted by status timestamp descending (most recent first). Uses cursor-based pagination via `pageToken`/`nextPageToken`.

---

## Multi-Turn Conversation Rules

| Scenario | contextId | taskId | Result |
|----------|-----------|--------|--------|
| New conversation | omitted | omitted | New task, new context |
| New task in existing conversation | provided | omitted | New task, same context |
| Continue existing task | (inferred from task) | provided | Append to existing task |
| Mismatch | provided | provided (different context) | Rejected |

---

## Idempotency

- **Get operations:** naturally idempotent
- **SendMessage:** MAY be idempotent (use `messageId` for deduplication)
- **CancelTask:** idempotent — duplicate cancellations are safe
