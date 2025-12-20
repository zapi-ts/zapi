// =============================================================================
// PLUGIN SYSTEM
// Load, merge, and execute plugins - inspired by Better Auth
// =============================================================================

import type {
  Plugin,
  Entity,
  FieldDef,
  Middleware,
  Hooks,
  HookContext,
  HookFn,
  ZapiInstance,
  Route,
  ZapiRequest,
  ZapiResponse,
  Operation,
  User,
  Driver,
  Where,
} from "./types.js"

// -----------------------------------------------------------------------------
// Plugin Registry
// -----------------------------------------------------------------------------

const pluginRegistry = new Map<string, Plugin>()

/**
 * Register a plugin globally
 */
export function registerPlugin(plugin: Plugin): void {
  const id = plugin.id || plugin.name
  if (pluginRegistry.has(id)) {
    throw new Error(`[Zapi] Plugin "${id}" is already registered.`)
  }
  pluginRegistry.set(id, plugin)
}

/**
 * Unregister a plugin by ID
 */
export function unregisterPlugin(id: string): boolean {
  return pluginRegistry.delete(id)
}

/**
 * Get a registered plugin by ID
 */
export function getPlugin(id: string): Plugin | undefined {
  return pluginRegistry.get(id)
}

/**
 * List all registered plugins
 */
export function listPlugins(): Plugin[] {
  return Array.from(pluginRegistry.values())
}

/**
 * Clear the plugin registry (useful for testing)
 */
export function clearPluginRegistry(): void {
  pluginRegistry.clear()
}

/**
 * Check for plugin conflicts (same routes, same entities, same middleware names)
 */
export function checkPluginConflicts(plugins: Plugin[]): string[] {
  const conflicts: string[] = []
  const routeRegistry = new Map<string, string>() // path -> plugin name
  const middlewareRegistry = new Map<string, string>() // name -> plugin name
  const entityRegistry = new Map<string, string>() // entity name -> plugin name

  for (const plugin of plugins) {
    const pluginId = plugin.id || plugin.name

    // Check routes
    if (plugin.routes) {
      const routes = typeof plugin.routes === "function" ? [] : plugin.routes
      for (const route of routes) {
        const key = `${route.method}:${route.path}`
        if (routeRegistry.has(key)) {
          conflicts.push(
            `Route conflict: "${key}" is defined by both "${routeRegistry.get(key)}" and "${pluginId}"`
          )
        } else {
          routeRegistry.set(key, pluginId)
        }
      }
    }

    // Check middleware names
    if (plugin.middleware) {
      const middleware = typeof plugin.middleware === "function" ? [] : plugin.middleware
      for (const mw of middleware) {
        if (middlewareRegistry.has(mw.name)) {
          conflicts.push(
            `Middleware conflict: "${mw.name}" is defined by both "${middlewareRegistry.get(mw.name)}" and "${pluginId}"`
          )
        } else {
          middlewareRegistry.set(mw.name, pluginId)
        }
      }
    }

    // Check entity names
    if (plugin.entities) {
      for (const entity of plugin.entities) {
        if (entityRegistry.has(entity.name)) {
          conflicts.push(
            `Entity conflict: "${entity.name}" is defined by both "${entityRegistry.get(entity.name)}" and "${pluginId}"`
          )
        } else {
          entityRegistry.set(entity.name, pluginId)
        }
      }
    }
  }

  return conflicts
}

// -----------------------------------------------------------------------------
// Plugin Loading
// -----------------------------------------------------------------------------

/**
 * Merge plugins into entities (add fields)
 */
export function applyPluginFields(
  entities: Map<string, Entity>,
  plugins: Plugin[]
): void {
  for (const plugin of plugins) {
    if (!plugin.fields) continue

    // Apply to all entities
    if (plugin.fields.all) {
      for (const [, entity] of entities) {
        Object.assign(entity.config.fields, plugin.fields.all)
      }
    }

    // Apply to specific entities
    for (const [entityName, fields] of Object.entries(plugin.fields)) {
      if (entityName === "all" || !fields) continue

      const entity = entities.get(entityName)
      if (entity) {
        Object.assign(entity.config.fields, fields)
      }
    }
  }
}

/**
 * Collect all middleware from plugins
 */
export function collectMiddleware(plugins: Plugin[], zapi: ZapiInstance): Middleware[] {
  const middleware: Middleware[] = []

  for (const plugin of plugins) {
    if (plugin.middleware) {
      if (typeof plugin.middleware === "function") {
        middleware.push(...plugin.middleware(zapi))
      } else {
        middleware.push(...plugin.middleware)
      }
    }
  }

  return middleware
}

/**
 * Collect all routes from plugins
 */
export function collectRoutes(plugins: Plugin[], zapi: ZapiInstance): Route[] {
  const routes: Route[] = []

  for (const plugin of plugins) {
    if (plugin.routes) {
      if (typeof plugin.routes === "function") {
        routes.push(...plugin.routes(zapi))
      } else {
        routes.push(...plugin.routes)
      }
    }
  }

  return routes
}

/**
 * Add plugin entities to entity map
 */
export function applyPluginEntities(
  entities: Map<string, Entity>,
  plugins: Plugin[]
): void {
  for (const plugin of plugins) {
    if (!plugin.entities) continue

    for (const entity of plugin.entities) {
      entities.set(entity.name, entity)
    }
  }
}

/**
 * Initialize plugins
 */
export async function initializePlugins(
  plugins: Plugin[],
  zapi: ZapiInstance
): Promise<void> {
  for (const plugin of plugins) {
    if (plugin.setup) {
      await plugin.setup(zapi)
    }
  }
}

// -----------------------------------------------------------------------------
// Hook Execution
// -----------------------------------------------------------------------------

/**
 * Execute a hook across all plugins
 */
export async function executeHook(
  hookName: keyof Hooks,
  ctx: HookContext,
  plugins: Plugin[]
): Promise<void> {
  for (const plugin of plugins) {
    if (ctx.stopped) break

    const hooks = plugin.hooks as Hooks | undefined
    const hook = hooks?.[hookName]
    if (hook && hookName !== "onError") {
      await (hook as HookFn)(ctx)
    }
  }
}

/**
 * Execute error hook across all plugins
 */
export async function executeErrorHook(
  error: Error,
  ctx: HookContext,
  plugins: Plugin[]
): Promise<void> {
  for (const plugin of plugins) {
    const hooks = plugin.hooks as Hooks | undefined
    const hook = hooks?.onError
    if (hook) {
      await hook(error, ctx)
    }
  }
}

// -----------------------------------------------------------------------------
// Hook Context Factory
// -----------------------------------------------------------------------------

export function createHookContext(
  entity: string,
  operation: Operation,
  user: User | null,
  input: Record<string, unknown>,
  resource: Record<string, unknown> | null,
  driver: Driver
): HookContext {
  let stopped = false
  let currentInput = { ...input }
  let currentResource = resource ? { ...resource } : null
  let filters: Where = {}

  return {
    entity,
    operation,
    user,
    get input() {
      return currentInput
    },
    get resource() {
      return currentResource
    },
    driver,

    stop: () => {
      stopped = true
    },
    get stopped() {
      return stopped
    },

    setInput: (data: Record<string, unknown>) => {
      currentInput = { ...currentInput, ...data }
    },

    setResource: (data: Record<string, unknown>) => {
      currentResource = { ...currentResource, ...data }
    },

    addFilter: (filter: Where) => {
      filters = { ...filters, ...filter }
    },

    get filters() {
      return filters
    },
  }
}

// -----------------------------------------------------------------------------
// Plugin Config Interface
// -----------------------------------------------------------------------------

export interface PluginConfig {
  id: string
  name: string
  version?: string
  description?: string
  entities?: Entity[]
  middleware?: Middleware[] | ((zapi: ZapiInstance) => Middleware[])
  routes?: Route[] | ((zapi: ZapiInstance) => Route[])
  fields?: Plugin["fields"]
  hooks?: Plugin["hooks"]
  context?: Plugin["context"]
  setup?: Plugin["setup"]
}

/**
 * Create a plugin from config object
 */
export function createPlugin(config: PluginConfig): Plugin {
  return {
    id: config.id,
    name: config.id, // Use id as name for backwards compatibility
    version: config.version,
    description: config.description,
    entities: config.entities,
    middleware: config.middleware,
    routes: config.routes,
    fields: config.fields,
    hooks: config.hooks,
    context: config.context,
    setup: config.setup,
  }
}

// -----------------------------------------------------------------------------
// Plugin Builder Class (Fluent API for creating plugins)
// -----------------------------------------------------------------------------

export class PluginBuilder {
  private plugin: Plugin

  constructor(id: string) {
    this.plugin = {
      id,
      name: id,
      middleware: [],
      routes: [],
      entities: [],
      hooks: {},
    }
  }

  version(version: string): this {
    this.plugin.version = version
    return this
  }

  description(description: string): this {
    this.plugin.description = description
    return this
  }

  addEntity(entity: Entity): this {
    if (!this.plugin.entities) {
      this.plugin.entities = []
    }
    this.plugin.entities.push(entity)
    return this
  }

  addMiddleware(middleware: Middleware): this {
    if (!Array.isArray(this.plugin.middleware)) {
      this.plugin.middleware = []
    }
    ;(this.plugin.middleware as Middleware[]).push(middleware)
    return this
  }

  addRoute(route: Route): this {
    if (!Array.isArray(this.plugin.routes)) {
      this.plugin.routes = []
    }
    ;(this.plugin.routes as Route[]).push(route)
    return this
  }

  fields(config: Plugin["fields"]): this {
    this.plugin.fields = config
    return this
  }

  onInit(fn: (zapi: ZapiInstance) => void | Promise<void>): this {
    if (!this.plugin.hooks) {
      this.plugin.hooks = {}
    }
    ;(this.plugin.hooks as any).onInit = fn
    return this
  }

  onRequest(fn: (req: ZapiRequest, zapi: ZapiInstance) => void | Promise<void>): this {
    if (!this.plugin.hooks) {
      this.plugin.hooks = {}
    }
    ;(this.plugin.hooks as any).onRequest = fn
    return this
  }

  onError(fn: (error: Error, req: ZapiRequest, zapi: ZapiInstance) => void | Promise<void>): this {
    if (!this.plugin.hooks) {
      this.plugin.hooks = {}
    }
    ;(this.plugin.hooks as any).onError = fn
    return this
  }

  setup(fn: (zapi: ZapiInstance) => void | Promise<void>): this {
    this.plugin.setup = fn
    return this
  }

  context(ctx: Record<string, unknown> | ((req: ZapiRequest) => Record<string, unknown>)): this {
    this.plugin.context = ctx
    return this
  }

  build(): Plugin {
    return this.plugin
  }
}

// -----------------------------------------------------------------------------
// Plugin Schema (for Better Auth compatibility)
// -----------------------------------------------------------------------------

export interface PluginSchema {
  [model: string]: {
    fields: Record<string, {
      type: "string" | "number" | "boolean" | "date" | "json"
      required?: boolean
      unique?: boolean
      defaultValue?: unknown
      references?: { model: string; field: string }
    }>
    disableMigrations?: boolean
  }
}

/**
 * Convert Plugin Schema to Zapi Entities
 */
export function schemaToEntities(schema: PluginSchema): Entity[] {
  const entities: Entity[] = []

  for (const [modelName, modelDef] of Object.entries(schema)) {
    const fields: Record<string, FieldDef> = {}

    for (const [fieldName, fieldDef] of Object.entries(modelDef.fields)) {
      fields[fieldName] = {
        type: fieldDef.type === "number" ? "int" 
            : fieldDef.type === "date" ? "datetime" 
            : fieldDef.type,
        optional: !fieldDef.required,
        unique: fieldDef.unique || false,
        default: fieldDef.defaultValue,
        relation: fieldDef.references ? {
          type: "belongsTo",
          entity: () => ({ name: fieldDef.references!.model, config: { fields: {}, rules: {}, timestamps: false } }),
          foreignKey: fieldName,
          references: fieldDef.references.field,
        } : undefined,
      }
    }

    entities.push({
      name: modelName,
      config: {
        fields,
        rules: {},
        timestamps: true,
      },
    })
  }

  return entities
}
