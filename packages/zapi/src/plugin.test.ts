// =============================================================================
// PLUGIN SYSTEM TESTS
// Tests for the plugin factory and registry
// =============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  createPlugin,
  registerPlugin,
  unregisterPlugin,
  getPlugin,
  listPlugins,
  clearPluginRegistry,
  checkPluginConflicts,
  schemaToEntities,
  PluginBuilder,
} from "./plugin"
import { entity } from "./entity"
import { string, int } from "./fields"
import type { Plugin, ZapiInstance, Entity } from "./types"

// -----------------------------------------------------------------------------
// Setup
// -----------------------------------------------------------------------------

beforeEach(() => {
  clearPluginRegistry()
})

// -----------------------------------------------------------------------------
// createPlugin Tests
// -----------------------------------------------------------------------------

describe("createPlugin()", () => {
  it("should create a basic plugin", () => {
    const plugin = createPlugin({
      id: "test",
      name: "Test Plugin",
    })

    expect(plugin).toBeDefined()
    expect(plugin.name).toBe("test")
  })

  it("should create a plugin with version and description", () => {
    const plugin = createPlugin({
      id: "test",
      name: "Test Plugin",
      version: "1.0.0",
      description: "A test plugin",
    })

    expect(plugin.id).toBe("test")
    expect(plugin.version).toBe("1.0.0")
    expect(plugin.description).toBe("A test plugin")
  })

  it("should create a plugin with entities", () => {
    const testEntity = entity("testEntity", {
      name: string,
    }).build()

    const plugin = createPlugin({
      id: "test",
      name: "Test Plugin",
      entities: [testEntity],
    })

    expect(plugin.entities).toHaveLength(1)
    expect(plugin.entities![0].name).toBe("testEntity")
  })

  it("should create a plugin with middleware", () => {
    const middleware = {
      name: "test-middleware",
      handler: async (ctx: any, next: () => Promise<void>) => {
        await next()
      },
    }

    const plugin = createPlugin({
      id: "test",
      name: "Test Plugin",
      middleware: [middleware],
    })

    expect(plugin.middleware).toBeDefined()
    expect(Array.isArray(plugin.middleware)).toBe(true)
    expect((plugin.middleware as any[])[0].name).toBe("test-middleware")
  })

  it("should create a plugin with hooks", () => {
    const onInitSpy = vi.fn()

    const plugin = createPlugin({
      id: "test",
      name: "Test Plugin",
      hooks: {
        onInit: onInitSpy,
      },
    })

    expect(plugin.hooks).toBeDefined()
    expect((plugin.hooks as any).onInit).toBe(onInitSpy)
  })

  it("should create a plugin with routes", () => {
    const routes = [
      {
        method: "GET" as const,
        path: "/test",
        handler: async () => ({ status: 200, body: { ok: true } }),
      },
    ]

    const plugin = createPlugin({
      id: "test",
      name: "Test Plugin",
      routes,
    })

    expect(plugin.routes).toBeDefined()
    expect(Array.isArray(plugin.routes)).toBe(true)
    expect((plugin.routes as any[])[0].path).toBe("/test")
  })

  it("should create a plugin with fields", () => {
    const plugin = createPlugin({
      id: "test",
      name: "Test Plugin",
      fields: {
        user: {
          customField: { type: "string", optional: false, unique: false },
        },
      },
    })

    expect(plugin.fields).toBeDefined()
    expect(plugin.fields!.user).toBeDefined()
    expect(plugin.fields!.user!.customField).toBeDefined()
  })
})

// -----------------------------------------------------------------------------
// Plugin Registry Tests
// -----------------------------------------------------------------------------

describe("Plugin Registry", () => {
  describe("registerPlugin()", () => {
    it("should register a plugin", () => {
      const plugin = createPlugin({ id: "test", name: "Test" })
      registerPlugin(plugin)

      const retrieved = getPlugin("test")
      expect(retrieved).toBe(plugin)
    })

    it("should throw when registering duplicate plugin ID", () => {
      const plugin1 = createPlugin({ id: "test", name: "Test 1" })
      const plugin2 = createPlugin({ id: "test", name: "Test 2" })

      registerPlugin(plugin1)

      expect(() => registerPlugin(plugin2)).toThrow(/already registered/)
    })
  })

  describe("unregisterPlugin()", () => {
    it("should unregister a plugin", () => {
      const plugin = createPlugin({ id: "test", name: "Test" })
      registerPlugin(plugin)

      const removed = unregisterPlugin("test")
      expect(removed).toBe(true)

      const retrieved = getPlugin("test")
      expect(retrieved).toBeUndefined()
    })

    it("should return false when unregistering non-existent plugin", () => {
      const removed = unregisterPlugin("nonexistent")
      expect(removed).toBe(false)
    })
  })

  describe("listPlugins()", () => {
    it("should list all registered plugins", () => {
      const plugin1 = createPlugin({ id: "plugin1", name: "Plugin 1" })
      const plugin2 = createPlugin({ id: "plugin2", name: "Plugin 2" })

      registerPlugin(plugin1)
      registerPlugin(plugin2)

      const plugins = listPlugins()
      expect(plugins).toHaveLength(2)
      expect(plugins.map((p) => p.id)).toContain("plugin1")
      expect(plugins.map((p) => p.id)).toContain("plugin2")
    })

    it("should return empty array when no plugins registered", () => {
      const plugins = listPlugins()
      expect(plugins).toHaveLength(0)
    })
  })
})

// -----------------------------------------------------------------------------
// checkPluginConflicts Tests
// -----------------------------------------------------------------------------

describe("checkPluginConflicts()", () => {
  it("should return empty array when no conflicts", () => {
    const plugin1 = createPlugin({
      id: "plugin1",
      name: "Plugin 1",
      entities: [entity("entity1", { name: string }).build()],
    })

    const plugin2 = createPlugin({
      id: "plugin2",
      name: "Plugin 2",
      entities: [entity("entity2", { name: string }).build()],
    })

    const conflicts = checkPluginConflicts([plugin1, plugin2])
    expect(conflicts).toHaveLength(0)
  })

  it("should detect entity name conflicts", () => {
    const plugin1 = createPlugin({
      id: "plugin1",
      name: "Plugin 1",
      entities: [entity("user", { name: string }).build()],
    })

    const plugin2 = createPlugin({
      id: "plugin2",
      name: "Plugin 2",
      entities: [entity("user", { email: string }).build()],
    })

    const conflicts = checkPluginConflicts([plugin1, plugin2])
    expect(conflicts.length).toBeGreaterThan(0)
    expect(conflicts[0]).toContain("user")
  })

  it("should detect route path conflicts", () => {
    const plugin1 = createPlugin({
      id: "plugin1",
      name: "Plugin 1",
      routes: [
        {
          method: "GET",
          path: "/users",
          handler: async () => ({ status: 200, body: {} }),
        },
      ],
    })

    const plugin2 = createPlugin({
      id: "plugin2",
      name: "Plugin 2",
      routes: [
        {
          method: "GET",
          path: "/users",
          handler: async () => ({ status: 200, body: {} }),
        },
      ],
    })

    const conflicts = checkPluginConflicts([plugin1, plugin2])
    expect(conflicts.length).toBeGreaterThan(0)
    expect(conflicts[0]).toContain("/users")
  })
})

// -----------------------------------------------------------------------------
// schemaToEntities Tests
// -----------------------------------------------------------------------------

describe("schemaToEntities()", () => {
  it("should convert a simple schema to entities", () => {
    const schema = {
      user: {
        fields: {
          name: { type: "string" as const, required: true },
          email: { type: "string" as const, required: true },
        },
      },
      session: {
        fields: {
          token: { type: "string" as const, required: true },
          expiresAt: { type: "date" as const, required: true },
        },
      },
    }

    const entities = schemaToEntities(schema)

    expect(entities).toHaveLength(2)
    expect(entities.find((e) => e.name === "user")).toBeDefined()
    expect(entities.find((e) => e.name === "session")).toBeDefined()
  })

  it("should handle optional fields", () => {
    const schema = {
      profile: {
        fields: {
          bio: { type: "string" as const, required: false },
          avatar: { type: "string" as const, required: false },
        },
      },
    }

    const entities = schemaToEntities(schema)
    const profile = entities[0]

    expect(profile.config.fields.bio.optional).toBe(true)
    expect(profile.config.fields.avatar.optional).toBe(true)
  })

  it("should handle unique fields", () => {
    const schema = {
      user: {
        fields: {
          email: { type: "string" as const, required: true, unique: true },
        },
      },
    }

    const entities = schemaToEntities(schema)
    const user = entities[0]

    expect(user.config.fields.email.unique).toBe(true)
  })

  it("should handle different field types", () => {
    const schema = {
      item: {
        fields: {
          name: { type: "string" as const, required: true },
          count: { type: "number" as const, required: true },
          active: { type: "boolean" as const, required: true },
          createdAt: { type: "date" as const, required: true },
        },
      },
    }

    const entities = schemaToEntities(schema)
    const item = entities[0]

    expect(item.config.fields.name.type).toBe("string")
    expect(item.config.fields.count.type).toBe("int")
    expect(item.config.fields.active.type).toBe("boolean")
    expect(item.config.fields.createdAt.type).toBe("datetime")
  })
})

// -----------------------------------------------------------------------------
// PluginBuilder Tests
// -----------------------------------------------------------------------------

describe("PluginBuilder", () => {
  it("should build a plugin using fluent API", () => {
    const builder = new PluginBuilder("myPlugin")

    const plugin = builder
      .version("1.0.0")
      .description("My awesome plugin")
      .build()

    expect(plugin.id).toBe("myPlugin")
    expect(plugin.version).toBe("1.0.0")
    expect(plugin.description).toBe("My awesome plugin")
  })

  it("should add entities", () => {
    const testEntity = entity("test", { name: string }).build()

    const plugin = new PluginBuilder("myPlugin")
      .addEntity(testEntity)
      .build()

    expect(plugin.entities).toHaveLength(1)
    expect(plugin.entities![0].name).toBe("test")
  })

  it("should add middleware", () => {
    const middleware = {
      name: "test",
      handler: async (ctx: any, next: () => Promise<void>) => {
        await next()
      },
    }

    const plugin = new PluginBuilder("myPlugin")
      .addMiddleware(middleware)
      .build()

    expect(plugin.middleware).toBeDefined()
  })

  it("should add routes", () => {
    const route = {
      method: "GET" as const,
      path: "/test",
      handler: async () => ({ status: 200, body: {} }),
    }

    const plugin = new PluginBuilder("myPlugin")
      .addRoute(route)
      .build()

    expect(plugin.routes).toBeDefined()
  })

  it("should set hooks", () => {
    const onInit = vi.fn()

    const plugin = new PluginBuilder("myPlugin")
      .onInit(onInit)
      .build()

    expect(plugin.hooks).toBeDefined()
    expect((plugin.hooks as any).onInit).toBe(onInit)
  })

  it("should chain all methods", () => {
    const testEntity = entity("test", { name: string }).build()

    const plugin = new PluginBuilder("fullPlugin")
      .version("2.0.0")
      .description("Full featured plugin")
      .addEntity(testEntity)
      .addRoute({
        method: "GET",
        path: "/test",
        handler: async () => ({ status: 200, body: {} }),
      })
      .addMiddleware({
        name: "test",
        handler: async (ctx, next) => await next(),
      })
      .onInit(async () => console.log("Init"))
      .build()

    expect(plugin.id).toBe("fullPlugin")
    expect(plugin.version).toBe("2.0.0")
    expect(plugin.entities).toHaveLength(1)
    expect(plugin.routes).toBeDefined()
    expect(plugin.middleware).toBeDefined()
    expect(plugin.hooks).toBeDefined()
  })
})
