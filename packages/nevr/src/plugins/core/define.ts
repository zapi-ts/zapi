// =============================================================================
// DEFINE PLUGIN
// Helper function for creating type-safe plugins
// =============================================================================

import type { ZapiPlugin, PluginMeta, PluginFactory, PluginExtension, EntityRoutesConfig } from "./contract.js"
import { registerPluginFactory, validatePlugin } from "./registry.js"

// -----------------------------------------------------------------------------
// Plugin Definition Options
// -----------------------------------------------------------------------------

export interface DefinePluginOptions<TOptions = any> {
  /** Plugin metadata */
  meta: PluginMeta

  /** Factory function that creates the plugin given options */
  factory: (options: TOptions, extension?: PluginExtension) => Omit<ZapiPlugin<TOptions>, "meta" | "options" | "extension">

  /** Default options */
  defaults?: Partial<TOptions>

  /** Validate options before creating plugin */
  validate?: (options: TOptions) => string[] | void

  /** Auto-register the factory globally */
  register?: boolean
}

// -----------------------------------------------------------------------------
// Extension Builder Types (for fluent API)
// -----------------------------------------------------------------------------

export interface PluginExtensionBuilder {
  /** Set base path for plugin routes */
  basePath(path: string | false): this

  /** Modify an entity */
  entity(name: string, config: PluginExtension["entities"][string]): this

  /** Add a new entity */
  addEntity(name: string, config: NonNullable<PluginExtension["addEntities"]>[string]): this

  /** Disable a route */
  disableRoute(path: string): this

  /** Override a route with custom handler */
  overrideRoute(path: string, handler: NonNullable<PluginExtension["routes"]>[string]): this

  /** Configure entity routes */
  entityRoutes(entityName: string, config: EntityRoutesConfig): this

  /** Build the extension */
  build(): PluginExtension
}

/** Create extension builder for fluent API */
export function createExtensionBuilder(): PluginExtensionBuilder {
  const ext: PluginExtension = {}

  return {
    basePath(path) {
      ext.basePath = path
      return this
    },

    entity(name, config) {
      if (!ext.entities) ext.entities = {}
      ext.entities[name] = config
      return this
    },

    addEntity(name, config) {
      if (!ext.addEntities) ext.addEntities = {}
      ext.addEntities[name] = config
      return this
    },

    disableRoute(path) {
      if (!ext.routes) ext.routes = {}
      ext.routes[path] = "disable"
      return this
    },

    overrideRoute(path, handler) {
      if (!ext.routes) ext.routes = {}
      ext.routes[path] = handler
      return this
    },

    entityRoutes(entityName, config) {
      if (!ext.entityRoutes) ext.entityRoutes = {}
      ext.entityRoutes[entityName] = config
      return this
    },

    build() {
      return ext
    },
  }
}

// -----------------------------------------------------------------------------
// Define Plugin
// Creates a type-safe plugin factory
// -----------------------------------------------------------------------------

export function definePlugin<TOptions = {}>(
  options: DefinePluginOptions<TOptions>
): PluginFactory<TOptions> {
  const { meta, factory, defaults, validate, register = true } = options
  
  // Create the factory function
  const pluginFactory: PluginFactory<TOptions> = (userOptions) => {
    // Merge options with defaults
    const mergedOptions = {
      ...defaults,
      ...userOptions,
    } as TOptions & { extend?: PluginExtension }
    
    // Extract extension from options
    const extension = mergedOptions.extend
    delete (mergedOptions as any).extend
    
    // Validate options
    if (validate) {
      const errors = validate(mergedOptions)
      if (errors && errors.length > 0) {
        throw new Error(`[${meta.id}] Invalid options: ${errors.join(", ")}`)
      }
    }
    
    // Create the plugin
    const pluginDef = factory(mergedOptions, extension)
    
    const plugin: ZapiPlugin<TOptions> = {
      meta,
      options: mergedOptions,
      extension,
      ...pluginDef,
    }
    
    // Validate the plugin
    const pluginErrors = validatePlugin(plugin)
    if (pluginErrors.length > 0) {
      throw new Error(`[${meta.id}] Invalid plugin: ${pluginErrors.join(", ")}`)
    }
    
    return plugin
  }
  
  // Register globally if requested
  if (register) {
    registerPluginFactory(meta.id, pluginFactory)
  }
  
  return pluginFactory
}

// -----------------------------------------------------------------------------
// Simple Plugin Helper
// For plugins that don't need complex options
// -----------------------------------------------------------------------------

export function simplePlugin(
  meta: PluginMeta,
  plugin: Omit<ZapiPlugin, "meta" | "options" | "extension">
): PluginFactory<{}> {
  return definePlugin({
    meta,
    factory: () => plugin,
    register: true,
  })
}
