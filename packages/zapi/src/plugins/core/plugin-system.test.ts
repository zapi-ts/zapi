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
} from "./index.js"
import type { ZapiInstance } from "../../types.js"

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
})
