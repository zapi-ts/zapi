// =============================================================================
// PLUGIN REGISTRY
// Global registry for managing plugins
// =============================================================================

import type { ZapiInstance } from "../../types.js"
import type { ZapiPlugin, PluginRegistryEntry, ResolvedPlugin, PluginFactory } from "./contract.js"
import { resolvePlugin, getPluginFieldExtensions } from "./resolver.js"

// -----------------------------------------------------------------------------
// Global Registry
// -----------------------------------------------------------------------------

const registry = new Map<string, PluginRegistryEntry>()
const factories = new Map<string, PluginFactory>()

// -----------------------------------------------------------------------------
// Factory Registration
// Plugins register their factory functions globally
// -----------------------------------------------------------------------------

/**
 * Register a plugin factory globally
 * This allows referencing plugins by name (e.g., "auth")
 */
export function registerPluginFactory<T>(id: string, factory: PluginFactory<T>): void {
  if (factories.has(id)) {
    throw new Error(`[Zapi] Plugin factory "${id}" is already registered`)
  }
  factories.set(id, factory as PluginFactory)
}

/**
 * Get a registered plugin factory
 */
export function getPluginFactory(id: string): PluginFactory | undefined {
  return factories.get(id)
}

/**
 * Create a plugin from a registered factory
 */
export function createFromFactory<T>(id: string, options?: T): ZapiPlugin<T> | undefined {
  const factory = factories.get(id)
  if (!factory) return undefined
  return factory(options) as ZapiPlugin<T>
}

// -----------------------------------------------------------------------------
// Instance Registry
// Track initialized plugin instances
// -----------------------------------------------------------------------------

/**
 * Register a plugin instance
 */
export function registerPluginInstance(plugin: ZapiPlugin): void {
  const id = plugin.meta.id
  
  if (registry.has(id)) {
    throw new Error(`[Zapi] Plugin "${id}" is already registered`)
  }
  
  registry.set(id, {
    plugin,
    initialized: false,
  })
}

/**
 * Get a registered plugin instance
 */
export function getPluginInstance(id: string): ZapiPlugin | undefined {
  return registry.get(id)?.plugin
}

/**
 * Get a plugin's resolved entities by plugin ID
 * Allows referencing plugin entities: belongsTo("auth.user")
 */
export function getPluginEntity(ref: string): { pluginId: string; entityName: string } | undefined {
  const [pluginId, entityName] = ref.split(".")
  if (!pluginId || !entityName) return undefined
  
  const entry = registry.get(pluginId)
  if (!entry) return undefined
  
  return { pluginId, entityName }
}

/**
 * Mark plugin as initialized
 */
export function markPluginInitialized(id: string): void {
  const entry = registry.get(id)
  if (entry) {
    entry.initialized = true
  }
}

/**
 * Check if plugin is initialized
 */
export function isPluginInitialized(id: string): boolean {
  return registry.get(id)?.initialized || false
}

/**
 * Get all registered plugins
 */
export function getAllPlugins(): ZapiPlugin[] {
  return Array.from(registry.values()).map(entry => entry.plugin)
}

/**
 * Clear registry (for testing)
 */
export function clearPluginRegistry(): void {
  registry.clear()
}

/**
 * Clear factories (for testing)
 */
export function clearPluginFactories(): void {
  factories.clear()
}

// -----------------------------------------------------------------------------
// Plugin Resolution
// -----------------------------------------------------------------------------

/**
 * Resolve all registered plugins
 */
export function resolveAllPlugins(): ResolvedPlugin[] {
  const resolved: ResolvedPlugin[] = []
  
  for (const entry of registry.values()) {
    resolved.push(resolvePlugin(entry.plugin))
  }
  
  return resolved
}

// -----------------------------------------------------------------------------
// Plugin Initialization
// -----------------------------------------------------------------------------

/**
 * Initialize all registered plugins
 */
export async function initializeAllPlugins(zapi: ZapiInstance): Promise<void> {
  // Sort by dependencies (if any)
  const sorted = topologicalSort(getAllPlugins())
  
  for (const plugin of sorted) {
    const id = plugin.meta.id
    
    try {
      // Call onRegister hook
      if (plugin.lifecycle?.onRegister) {
        await plugin.lifecycle.onRegister(zapi)
      }
      
      // Call onInit hook
      if (plugin.lifecycle?.onInit) {
        await plugin.lifecycle.onInit(zapi)
      }
      
      markPluginInitialized(id)
    } catch (error) {
      const entry = registry.get(id)
      if (entry) {
        entry.error = error as Error
      }
      throw new Error(`[Zapi] Failed to initialize plugin "${id}": ${(error as Error).message}`)
    }
  }
}

// -----------------------------------------------------------------------------
// Dependency Resolution
// -----------------------------------------------------------------------------

function topologicalSort(plugins: ZapiPlugin[]): ZapiPlugin[] {
  const sorted: ZapiPlugin[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()
  
  const pluginMap = new Map(plugins.map(p => [p.meta.id, p]))
  
  function visit(plugin: ZapiPlugin) {
    const id = plugin.meta.id
    
    if (visited.has(id)) return
    if (visiting.has(id)) {
      throw new Error(`[Zapi] Circular plugin dependency detected: ${id}`)
    }
    
    visiting.add(id)
    
    // Visit dependencies first
    for (const depId of plugin.meta.dependencies || []) {
      const dep = pluginMap.get(depId)
      if (dep) {
        visit(dep)
      } else {
        throw new Error(`[Zapi] Plugin "${id}" depends on missing plugin "${depId}"`)
      }
    }
    
    visiting.delete(id)
    visited.add(id)
    sorted.push(plugin)
  }
  
  for (const plugin of plugins) {
    visit(plugin)
  }
  
  return sorted
}

// -----------------------------------------------------------------------------
// Plugin Validation
// -----------------------------------------------------------------------------

export function validatePlugin(plugin: ZapiPlugin): string[] {
  const errors: string[] = []
  
  // Required fields
  if (!plugin.meta?.id) {
    errors.push("Plugin must have meta.id")
  }
  
  if (!plugin.meta?.name) {
    errors.push("Plugin must have meta.name")
  }
  
  if (!plugin.meta?.version) {
    errors.push("Plugin must have meta.version")
  }
  
  // ID format
  if (plugin.meta?.id && !/^[a-z][a-z0-9-]*$/.test(plugin.meta.id)) {
    errors.push("Plugin ID must be lowercase alphanumeric with hyphens, starting with a letter")
  }
  
  // Check for reserved IDs
  const reserved = ["zapi", "core", "system"]
  if (plugin.meta?.id && reserved.includes(plugin.meta.id)) {
    errors.push(`Plugin ID "${plugin.meta.id}" is reserved`)
  }
  
  return errors
}
