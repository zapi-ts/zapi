import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  definePlugin,
  registerPluginFactory,
  createFromFactory,
  registerPluginInstance,
  getPluginInstance,
  resolvePlugin,
  clearPluginRegistry,
  clearPluginFactories,
  plugin,
  resolveEntityRef,
  clearEntityCache,
  initializeAllPlugins,
  createExtensionBuilder,
  getEntityRoutePath,
  isEntityRouteDisabled,
  getEntityRouteHandler,
  type ResolvedEntityMeta,
} from "./index.js"
import type { ZapiInstance, ZapiResponse, ZapiRequest } from "../../types.js"

describe("Plugin System", () => {
  beforeEach(() => {
    clearPluginRegistry()
    clearPluginFactories()
    clearEntityCache()
  })

  describe("definePlugin", () => {
    it("should create a valid plugin factory", () => {
      const myPlugin = definePlugin({
        meta: {
          id: "test-plugin",
          name: "Test Plugin",
          version: "1.0.0",
        },
        factory: (options) => ({
          schema: {
            entities: {
              item: {
                fields: {
                  name: { type: "string", required: true },
                },
              },
            },
          },
        }),
      })

      const instance = myPlugin({})
      expect(instance.meta.id).toBe("test-plugin")
      expect(instance.schema?.entities?.item).toBeDefined()
    })

    it("should validate options", () => {
      const myPlugin = definePlugin<{ required: boolean }>({
        meta: { id: "test", name: "Test", version: "1.0.0" },
        validate: (opts) => {
          if (!opts.required) return ["Required option missing"]
        },
        factory: () => ({}),
      })

      expect(() => myPlugin({ required: false })).toThrow("Invalid options: Required option missing")
      expect(() => myPlugin({ required: true })).not.toThrow()
    })

    it("should handle extensions", () => {
      const myPlugin = definePlugin({
        meta: { id: "test", name: "Test", version: "1.0.0" },
        factory: (opts, ext) => ({
          schema: {
            entities: {
              user: {
                fields: {
                  name: { type: "string", required: true },
                },
              },
            },
          },
        }),
      })

      const instance = myPlugin({
        extend: {
          entities: {
            user: {
              fields: {
                name: { rename: "fullName" },
                age: { add: { type: "int", required: true } },
              },
            },
          },
        },
      })

      expect(instance.extension).toBeDefined()
      
      // Resolve to check if extension is applied
      const resolved = resolvePlugin(instance)
      const userEntity = resolved.entities.find(e => e.name === "user")
      
      expect(userEntity).toBeDefined()
      expect(userEntity?.config.fields.fullName).toBeDefined() // Renamed
      expect(userEntity?.config.fields.name).toBeUndefined() // Original gone
      expect(userEntity?.config.fields.age).toBeDefined() // Added
    })
  })

  describe("Registry", () => {
    it("should register and retrieve plugin factories", () => {
      const factory = definePlugin({
        meta: { id: "test", name: "Test", version: "1.0.0" },
        factory: () => ({}),
      })

      // definePlugin auto-registers by default
      expect(createFromFactory("test")).toBeDefined()
    })

    it("should register and retrieve plugin instances", () => {
      const plugin = definePlugin({
        meta: { id: "test", name: "Test", version: "1.0.0" },
        factory: () => ({}),
      })({})

      registerPluginInstance(plugin)
      expect(getPluginInstance("test")).toBe(plugin)
    })
  })

  describe("Reference System", () => {
    it("should create lazy entity references", () => {
      const ref = plugin("auth").user
      expect(typeof ref).toBe("function")
      
      // Should throw if plugin not registered when accessed
      expect(() => ref()).toThrow('Plugin "auth" not found')
    })

    it("should resolve entity references", () => {
      // Register a dummy auth plugin
      const authPlugin = definePlugin({
        meta: { id: "auth", name: "Auth", version: "1.0.0" },
        factory: () => ({
          schema: {
            entities: {
              user: { fields: {} },
            },
          },
        }),
      })({})
      registerPluginInstance(authPlugin)

      const ref = plugin("auth").user
      const entity = ref()
      
      expect(entity.name).toBe("user")
    })
  })

  describe("Initialization", () => {
    it("should initialize plugins in dependency order", async () => {
      const callOrder: string[] = []

      const pluginA = definePlugin({
        meta: { id: "a", name: "A", version: "1.0.0", dependencies: ["b"] },
        factory: () => ({
          lifecycle: {
            onInit: async () => { callOrder.push("a") },
          },
        }),
      })({})

      const pluginB = definePlugin({
        meta: { id: "b", name: "B", version: "1.0.0" },
        factory: () => ({
          lifecycle: {
            onInit: async () => { callOrder.push("b") },
          },
        }),
      })({})

      registerPluginInstance(pluginA)
      registerPluginInstance(pluginB)

      const mockZapi = {} as ZapiInstance
      await initializeAllPlugins(mockZapi)

      expect(callOrder).toEqual(["b", "a"])
    })

    it("should detect circular dependencies", async () => {
      const pluginA = definePlugin({
        meta: { id: "a", name: "A", version: "1.0.0", dependencies: ["b"] },
        factory: () => ({}),
      })({})

      const pluginB = definePlugin({
        meta: { id: "b", name: "B", version: "1.0.0", dependencies: ["a"] },
        factory: () => ({}),
      })({})

      registerPluginInstance(pluginA)
      registerPluginInstance(pluginB)

      const mockZapi = {} as ZapiInstance
      await expect(initializeAllPlugins(mockZapi)).rejects.toThrow("Circular plugin dependency")
    })
  })

  describe("Base Path", () => {
    it("should use default base path from plugin id", () => {
      const myPlugin = definePlugin({
        meta: { id: "auth", name: "Auth", version: "1.0.0" },
        factory: () => ({
          schema: {
            entities: {
              user: { fields: { email: { type: "string", required: true } } },
            },
          },
        }),
      })({})

      const resolved = resolvePlugin(myPlugin)
      expect(resolved.basePath).toBe("/auth")

      const userMeta = resolved.entityMeta.get("user")
      expect(userMeta?.basePath).toBe("/auth")
    })

    it("should allow custom base path in meta", () => {
      const myPlugin = definePlugin({
        meta: { id: "auth", name: "Auth", version: "1.0.0", basePath: "/api/v2/auth" },
        factory: () => ({
          schema: {
            entities: {
              user: { fields: { email: { type: "string", required: true } } },
            },
          },
        }),
      })({})

      const resolved = resolvePlugin(myPlugin)
      expect(resolved.basePath).toBe("/api/v2/auth")
    })

    it("should allow extension to override base path", () => {
      const myPlugin = definePlugin({
        meta: { id: "auth", name: "Auth", version: "1.0.0", basePath: "/auth" },
        factory: () => ({
          schema: {
            entities: {
              user: { fields: { email: { type: "string", required: true } } },
            },
          },
        }),
      })({
        extend: {
          basePath: "/api/auth",
        },
      })

      const resolved = resolvePlugin(myPlugin)
      expect(resolved.basePath).toBe("/api/auth")
    })

    it("should allow disabling base path with false", () => {
      const myPlugin = definePlugin({
        meta: { id: "auth", name: "Auth", version: "1.0.0", basePath: false },
        factory: () => ({
          schema: {
            entities: {
              user: { fields: { email: { type: "string", required: true } } },
            },
          },
        }),
      })({})

      const resolved = resolvePlugin(myPlugin)
      expect(resolved.basePath).toBe("")
    })
  })

  describe("Entity Rename", () => {
    it("should rename entities via extension", () => {
      const myPlugin = definePlugin({
        meta: { id: "auth", name: "Auth", version: "1.0.0" },
        factory: () => ({
          schema: {
            entities: {
              user: { fields: { email: { type: "string", required: true } } },
            },
          },
        }),
      })({
        extend: {
          entities: {
            user: { rename: "member" },
          },
        },
      })

      const resolved = resolvePlugin(myPlugin)
      const memberEntity = resolved.entities.find(e => e.name === "member")
      const userEntity = resolved.entities.find(e => e.name === "user")

      expect(memberEntity).toBeDefined()
      expect(userEntity).toBeUndefined()

      // Should track original name in metadata
      const memberMeta = resolved.entityMeta.get("member")
      expect(memberMeta?.originalName).toBe("user")
    })

    it("should allow custom route path for entity", () => {
      const myPlugin = definePlugin({
        meta: { id: "auth", name: "Auth", version: "1.0.0" },
        factory: () => ({
          schema: {
            entities: {
              user: { fields: { email: { type: "string", required: true } } },
            },
          },
        }),
      })({
        extend: {
          entities: {
            user: { routePath: "team-members" },
          },
        },
      })

      const resolved = resolvePlugin(myPlugin)
      const userMeta = resolved.entityMeta.get("user")
      expect(userMeta?.routePath).toBe("team-members")
    })
  })

  describe("Route Overrides", () => {
    it("should allow disabling entity routes via extension", () => {
      const myPlugin = definePlugin({
        meta: { id: "auth", name: "Auth", version: "1.0.0" },
        factory: () => ({
          schema: {
            entities: {
              user: { fields: { email: { type: "string", required: true } } },
            },
          },
        }),
      })({
        extend: {
          entityRoutes: {
            user: {
              delete: "disable",
            },
          },
        },
      })

      const resolved = resolvePlugin(myPlugin)
      expect(resolved.entityRoutes?.user?.delete).toBe("disable")

      // Test helper function
      expect(isEntityRouteDisabled("user", "delete", resolved.entityMeta)).toBe(true)
      expect(isEntityRouteDisabled("user", "create", resolved.entityMeta)).toBe(false)
    })

    it("should allow custom handlers for entity routes", () => {
      const customHandler = async (req: ZapiRequest, zapi: ZapiInstance): Promise<ZapiResponse> => {
        return { status: 200, body: { custom: true } }
      }

      const myPlugin = definePlugin({
        meta: { id: "auth", name: "Auth", version: "1.0.0" },
        factory: () => ({
          schema: {
            entities: {
              user: { fields: { email: { type: "string", required: true } } },
            },
          },
        }),
      })({
        extend: {
          entityRoutes: {
            user: {
              list: customHandler,
            },
          },
        },
      })

      const resolved = resolvePlugin(myPlugin)
      const handler = getEntityRouteHandler("user", "list", resolved.entityMeta)
      expect(handler).toBe(customHandler)
    })

    it("should mark entity as internal (no CRUD routes)", () => {
      const myPlugin = definePlugin({
        meta: { id: "auth", name: "Auth", version: "1.0.0" },
        factory: () => ({
          schema: {
            entities: {
              session: { fields: { token: { type: "string", required: true } }, internal: true },
            },
          },
        }),
      })({})

      const resolved = resolvePlugin(myPlugin)
      const sessionMeta = resolved.entityMeta.get("session")
      expect(sessionMeta?.internal).toBe(true)

      // All operations should be disabled for internal entities
      expect(isEntityRouteDisabled("session", "list", resolved.entityMeta)).toBe(true)
      expect(isEntityRouteDisabled("session", "create", resolved.entityMeta)).toBe(true)
    })
  })

  describe("Extension Builder (Fluent API)", () => {
    it("should build extensions using fluent API", () => {
      const extension = createExtensionBuilder()
        .basePath("/api/auth")
        .entity("user", { rename: "member" })
        .entityRoutes("member", { delete: "disable" })
        .disableRoute("/auth/legacy")
        .build()

      expect(extension.basePath).toBe("/api/auth")
      expect(extension.entities?.user?.rename).toBe("member")
      expect(extension.entityRoutes?.member?.delete).toBe("disable")
      expect(extension.routes?.["/auth/legacy"]).toBe("disable")
    })
  })

  describe("Hooks as Escape Hatch", () => {
    it("should provide hooks for lifecycle events", () => {
      const onInitCalled = vi.fn()
      const onRequestCalled = vi.fn()
      const onErrorCalled = vi.fn()

      const myPlugin = definePlugin({
        meta: { id: "test", name: "Test", version: "1.0.0" },
        factory: () => ({
          lifecycle: {
            onInit: onInitCalled,
            onRequest: onRequestCalled,
            onError: onErrorCalled,
          },
        }),
      })({})

      expect(myPlugin.lifecycle?.onInit).toBe(onInitCalled)
      expect(myPlugin.lifecycle?.onRequest).toBe(onRequestCalled)
      expect(myPlugin.lifecycle?.onError).toBe(onErrorCalled)
    })

    it("should provide entity-level hooks", () => {
      const beforeCreate = vi.fn()
      const afterCreate = vi.fn()

      const myPlugin = definePlugin({
        meta: { id: "test", name: "Test", version: "1.0.0" },
        factory: () => ({
          hooks: {
            beforeCreate,
            afterCreate,
          },
        }),
      })({})

      expect(myPlugin.hooks?.beforeCreate).toBe(beforeCreate)
      expect(myPlugin.hooks?.afterCreate).toBe(afterCreate)
    })

    it("should allow complete route override via routes extension", () => {
      const customHandler = async (req: ZapiRequest): Promise<ZapiResponse> => {
        return { status: 200, body: { overridden: true } }
      }

      const myPlugin = definePlugin({
        meta: { id: "auth", name: "Auth", version: "1.0.0" },
        factory: () => ({
          routes: [
            { method: "POST", path: "/auth/login", handler: async () => ({ status: 200, body: {} }) },
          ],
        }),
      })({
        extend: {
          routes: {
            "/auth/login": customHandler,
          },
        },
      })

      const resolved = resolvePlugin(myPlugin)
      expect(resolved.routeOverrides?.["/auth/login"]).toBe(customHandler)
    })
  })

  describe("Route Path Helper", () => {
    it("should compute full route path for plugin entities", () => {
      const entityMeta = new Map<string, ResolvedEntityMeta>([
        ["user", { originalName: "user", pluginId: "auth", basePath: "/auth", internal: false }],
        ["post", { originalName: "post", pluginId: "blog", basePath: "/blog", routePath: "articles", internal: false }],
      ])

      const pluralize = (s: string) => s + "s"

      expect(getEntityRoutePath("user", entityMeta, pluralize)).toBe("/auth/users")
      expect(getEntityRoutePath("post", entityMeta, pluralize)).toBe("/blog/articles")
      expect(getEntityRoutePath("comment", entityMeta, pluralize)).toBe("/comments") // Not in meta, root path
    })
  })

  describe("Plugin Entity Metadata", () => {
    it("should attach plugin metadata to resolved entities", () => {
      const myPlugin = definePlugin({
        meta: { id: "auth", name: "Auth", version: "1.0.0", basePath: "/api/auth" },
        factory: () => ({
          schema: {
            entities: {
              user: { fields: { email: { type: "string", required: true } } },
            },
          },
        }),
      })({})

      const resolved = resolvePlugin(myPlugin)
      const userEntity = resolved.entities.find(e => e.name === "user")

      expect(userEntity?.plugin).toBeDefined()
      expect(userEntity?.plugin?.id).toBe("auth")
      expect(userEntity?.plugin?.basePath).toBe("/api/auth")
    })
  })
})
