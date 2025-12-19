# ⚡ Nevr

[![Beta](https://img.shields.io/badge/status-beta-orange.svg)](https://github.com/nevr-ts/nevr)
[![CI](https://github.com/nevr-ts/nevr/actions/workflows/ci.yml/badge.svg)](https://github.com/nevr-ts/nevr/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Nevr write boilerplate again.** Nevr is a Zero-API, entity-first framework that turns your domain models into a fully functional, type-safe backend instantly.

> ⚠️ **Beta Software**: Nevr is under active development. APIs may change before v1.0.

---

## 🚫 Solving the 5 Backend Nightmares

1. **The Boilerplate Trap**: Stop writing repetitive Controllers, Services, and Routes.
2. **The Type-Safety Gap**: Automatic client generation ensures your frontend build fails if the entity changes.
3. **Authorization Nightmares**: Declarative permissions (e.g., `.ownedBy('author')`) baked into the model.
4. **Inconsistent Validation**: Single source of truth for both Database constraints and Runtime validation.
5. **Documentation Drift**: Your schema *is* the documentation. OpenAPI specs are always in sync.

---

Nevr lets you describe your domain once with a tiny, fluent DSL and get:
- REST CRUD endpoints with ownership-aware authorization
- Input validation and clear error responses
- Clean framework adapters (Express, Hono)
- Database drivers (Prisma) with pluggable backend
- Optional plugins (auth, timestamps) without lock‑in
- Generated Prisma schema, shared TS types, and a typed API client

Docs live in  docs/ (VitePress). Quick start below; full guides cover every keyword.



## Quick Start

```bash
npm create nevr@latest my-api
cd my-api
npm run generate && npm run dev
```

## Core Idea: Define once, get everything.

```ts
import { entity, string, text, belongsTo } from "nevr"

export const post = entity("post", {
  title: string.min(1).max(200),
  body: text,
  author: belongsTo(() => user),
}).ownedBy("author")
```

From this, you get CRUD endpoints, validation, auth rules, Prisma schema, TS types, and a client.

## Use With Express + Prisma

```ts
import express from "express"
import { PrismaClient } from "@prisma/client"
import { zapi } from "nevr" 
import { prisma } from "nevr/drivers/prisma"
import { expressAdapter } from "nevr/adapters/express"
import { user, post } from "./entities"

const db = new PrismaClient()

const api = zapi({ // Consistent naming
  entities: [user, post],
  driver: prisma(db),
  cors: { origin: true },
})

const app = express()
app.use(express.json())
app.use("/api", expressAdapter(api))
app.listen(3000)
```

## Concepts At A Glance

- Entities: `entity(name, { fields })` → `.ownedBy(field)` `.rules({...})` `.noTimestamps()`
- Fields: `string`, `text`, `int`, `float`, `boolean`/`bool`, `datetime`, `json`, `email`
- Relations: `belongsTo(entity)`, `hasMany(entity)`, `hasOne(entity)` with `.foreignKey()`, `.onDelete()`, `.optional()`
- Rules: `everyone`, `authenticated`, `admin`, `owner`, `ownerOrAdmin`
- Validation: automatic by field definitions (min/max/optional/unique/email)
- Driver: implements data access (`nevr/drivers/prisma`)
- Adapter: bridges HTTP (`nevr/adapters/express`, `nevr/adapters/hono`)
- Plugins: extend fields, hooks, routes, middleware
- Generator: `@nevr/generator` or CLI `@nevr/cli`

## Generator & Client

Generate schema, types, and a typed client:

```ts
import { generate } from "@nevr/generator"
import { user, post } from "./entities"

generate([user, post], { outDir: "./generated", prismaProvider: "sqlite" })
```

Use the client in your frontend:

```ts
import { createClient } from "./generated/client"
const api = createClient({ baseUrl: "/api", headers: { "X-User-Id": "u_123" } })
const posts = await api.posts.list({ filter: { published: true }, limit: 10 })
```

## Reference Cheatsheet

Fields
- `string.text.int.float.boolean.datetime.json.email`
- Modifiers: `.optional() .unique() .default(v) .min(n) .max(n)`

Relations
- `belongsTo(() => User).foreignKey("userId").onDelete("cascade").optional()`
- `hasMany(() => Post)` • `hasOne(() => Profile)`

Entity builder
- `.ownedBy("author")` sets default CRUD rules around ownership
- `.rules({ create: ["authenticated"], update: ["owner"] })`
- `.noTimestamps()` disables createdAt/updatedAt

Rules (built-ins)
- `everyone`, `authenticated`, `admin`, `owner`, `ownerOrAdmin`

Adapter helpers (Express)
- `expressAdapter(api, { getUser, cors, debugLogs })`
<!-- - `expressDevAuth(req)` → reads `X-User-Id`, `X-User-Role` -->
- `expressJwtAuth(verify)` → parse Bearer token and verify

## Documentation

- Developer docs live in  docs/ (VitePress). Start with docs/guide/getting-started.md
- To run docs locally:

```bash
cd "docs"
npm install
npm run docs:dev
```

## Contributing

PRs welcome! Please see CONTRIBUTING.md and open an issue with your proposal.

| `string` | Short text |
| `text` | Long text |
| `int` | Integer |
| `float` | Decimal |
| `bool` | Boolean |
| `datetime` | Date & time |
| `json` | JSON data |
| `email` | Email with validation |

### Modifiers

```typescript
string              // Required
string.optional()   // Nullable
string.unique()     // Unique constraint
string.default("x") // Default value
int.min(0).max(100) // Validation
```

### Relations

```typescript
author: belongsTo(user)  // Many-to-one
posts: hasMany(post)     // One-to-many
```

### Authorization Rules

```typescript
// Built-in rules
everyone        // Anyone can access
authenticated   // Must be logged in
owner           // Must own the resource
admin           // Must be admin role

// Usage
entity("post", { ... }).rules({
  create: ["authenticated"],
  read: ["everyone"],
  update: ["owner"],
  delete: ["owner", "admin"],
})

// Shorthand
entity("post", { ... }).ownedBy("author")
```

### Query Parameters

| Parameter | Example | Description |
|-----------|---------|-------------|
| filter | `?filter[published]=true` | Filter results |
| sort | `?sort=-createdAt` | Sort (- for desc) |
| limit | `?limit=10` | Limit results |
| offset | `?offset=20` | Skip results |
| include | `?include=author` | Include relations |

## Advanced Usage

### Context Injection

Inject dependencies (like database clients or services) into every request:

```typescript
const api = zapi({
  // ...
  context: async (req) => ({
    db: new PrismaClient(),
    currentUser: req.user
  })
})
```

### Error Handling

Nevr automatically handles errors and returns standardized JSON responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "Invalid email" }
    ]
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        NEVR CORE                            │
│  Entity DSL │ Validation │ Rules │ Plugin System │ Router   │
└──────────────────────────┬──────────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
       ▼                   ▼                   ▼
 ┌───────────┐      ┌───────────┐      ┌─────────────┐
 │  Adapter  │      │  Driver   │      │   Plugin    │
 └───────────┘      └───────────┘      └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
   Express             Prisma            timestamps
   (Hono)             (Drizzle)          soft-delete
   (Next.js)          (Kysely)            auth
    ...                 ...               payment
                                           ...
```                                        

## Packages

| Package | Description |
|---------|-------------|
| `nevr` | Core library |
| `@nevr/generator` | Code generators |
| `@nevr/cli` | CLI tool |
| `create-nevr` | Project scaffolder |

## Plugin System

Extend nevr with plugins:

```typescript
const api = zapi({
  entities: [...],
  driver: prisma(db),
  plugins: [
    timestamps(),    // Auto createdAt/updatedAt
    softDelete(),    // Soft delete support
  ],
})
```

## Roadmap

### Current (MVP)
- ✅ Entity DSL
- ✅ Field types & validation
- ✅ Relations (belongsTo, hasMany)
- ✅ Authorization rules
- ✅ CRUD operations
- ✅ Filtering, sorting, pagination
- ✅ Include relations
- ✅ Prisma driver
- ✅ Express adapter
- ✅ Hono adapter
- ✅ Dev & JWT auth helpers
- ✅ Timestamps plugin
- ✅ Generator for Prisma schema & TS types
- ✅ Code generators
- ✅ CLI & scaffolder


### Coming Soon
- Next.js adapter
- Kysely driver
- Drizzle driver
- Soft delete plugin
- Rate limiting plugin
- OpenAPI generator
- GraphQL support
- File upload plugin
- Email plugin
- Payment plugin
- More field types & modifiers
- More built-in rules
- Improved docs & examples
- more adapters & drivers
- more plugins ....
## License

MIT
