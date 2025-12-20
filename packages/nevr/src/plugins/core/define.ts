// =============================================================================
// DEFINE PLUGIN
// Helper function for creating type-safe plugins
// =============================================================================

import type { ZapiPlugin, PluginMeta, PluginFactory, PluginExtension } from "./contract.js"
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
