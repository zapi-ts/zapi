// =============================================================================
// PLUGIN CORE
// Re-exports all plugin system components
// =============================================================================

// Contract & Types
export * from "./contract.js"

// Plugin Definition Helper
export { definePlugin, simplePlugin, createExtensionBuilder } from "./define.js"
export type { DefinePluginOptions, PluginExtensionBuilder } from "./define.js"

// Plugin Registry
export {
  registerPluginFactory,
  getPluginFactory,
  createFromFactory,
  registerPluginInstance,
  getPluginInstance,
  getPluginEntity,
  markPluginInitialized,
  isPluginInitialized,
  getAllPlugins,
  clearPluginRegistry,
  clearPluginFactories,
  resolveAllPlugins,
  initializeAllPlugins,
  validatePlugin,
} from "./registry.js"

// Plugin Resolver
export {
  resolvePlugin,
  getPluginFieldExtensions,
  mergeResolvedPlugins,
  getEntityRoutePath,
  isEntityRouteDisabled,
  getEntityRouteHandler,
} from "./resolver.js"
export type { MergedPlugins } from "./resolver.js"

// Plugin Entity Reference
export {
  plugin,
  parseEntityRef,
  resolveEntityRef,
  clearEntityCache,
  getPluginEntityFn,
} from "./reference.js"
