// =============================================================================
// PLUGIN CONTRACT
// The core interface and types that ALL Nevr plugins must follow
// =============================================================================

import type { Entity, FieldDef, Route, Middleware, ZapiInstance, ZapiRequest, Hooks, ZapiResponse, Operation } from "../../types.js"

// -----------------------------------------------------------------------------
// Plugin Metadata
// -----------------------------------------------------------------------------

export interface PluginMeta {
  /** Unique plugin identifier (e.g., "auth", "payments", "storage") */
  id: string

  /** Human-readable plugin name */
  name: string

  /** Semantic version (e.g., "1.0.0") */
  version: string

  /** Plugin description */
  description?: string

  /** Author or maintainer */
  author?: string

  /** Plugin homepage or documentation URL */
  homepage?: string

  /** Required Zapi version (semver range) */
  zapiVersion?: string

  /** Plugin dependencies (other plugin IDs) */
  dependencies?: string[]

  /**
   * Base path for plugin routes (e.g., "/auth", "/payments")
   * If not provided, defaults to "/" + id (e.g., "/auth" for id="auth")
   * Set to false to disable base path (routes at root like non-plugin entities)
   */
  basePath?: string | false
}

// -----------------------------------------------------------------------------
// Plugin Schema Definition
// Defines the tables/entities a plugin provides
// -----------------------------------------------------------------------------

export interface PluginFieldDef {
  type: "string" | "text" | "int" | "float" | "boolean" | "datetime" | "json"
  required?: boolean
  unique?: boolean
  default?: unknown
  /** If true, developer MUST NOT remove this field */
  locked?: boolean
  /** Field description for documentation */
  description?: string
  /** Reference to another entity (creates foreign key) */
  references?: {
    entity: string
    field?: string  // defaults to "id"
  }
}

export interface PluginEntityDef {
  /** Entity fields */
  fields: Record<string, PluginFieldDef>

  /** If true, developer cannot remove this entity */
  required?: boolean

  /** If true, no CRUD routes are generated (plugin manages routes) */
  internal?: boolean

  /** Entity description for documentation */
  description?: string

  /**
   * Custom route path for this entity (relative to plugin basePath)
   * If not set, uses pluralized entity name
   * Example: "members" instead of default "users"
   */
  routePath?: string
}

export interface PluginSchema {
  /** 
   * Entities the plugin provides
   * Key is entity name (e.g., "session", "account")
   */
  entities?: Record<string, PluginEntityDef>
  
  /**
   * Fields to add to existing entities
   * Key is target entity name (e.g., "user")
   * Use "all" to add to all entities
   */
  extend?: Record<string, Record<string, PluginFieldDef>>
}

// -----------------------------------------------------------------------------
// Plugin Extension Options
// How developers can customize a plugin
// -----------------------------------------------------------------------------

export interface PluginExtensionFieldDef {
  /** Add a new field */
  add?: PluginFieldDef
  
  /** Rename the field (original name -> new name) */
  rename?: string
  
  /** Override field properties */
  override?: Partial<PluginFieldDef>
  
  /** Remove the field (only if not locked) */
  remove?: boolean
}

export interface PluginExtensionEntityDef {
  /** Modify existing fields */
  fields?: Record<string, PluginExtensionFieldDef>

  /** Add new fields directly */
  addFields?: Record<string, PluginFieldDef>

  /** Remove entity (only if not required) */
  remove?: boolean

  /** Rename the entity (e.g., rename "user" to "member") */
  rename?: string

  /** Override the route path for this entity */
  routePath?: string

  /** Make entity internal (no CRUD routes) */
  internal?: boolean
}

/** Route handler type for custom route implementations */
export type RouteHandler = (req: ZapiRequest, zapi: ZapiInstance) => Promise<ZapiResponse>

/** Route configuration for overriding default CRUD routes */
export interface EntityRouteConfig {
  /** Disable this operation entirely */
  disable?: boolean
  /** Custom handler for this operation */
  handler?: RouteHandler
}

/** Per-entity route customization */
export interface EntityRoutesConfig {
  /** List operation (GET /entities) */
  list?: EntityRouteConfig | "disable" | RouteHandler
  /** Create operation (POST /entities) */
  create?: EntityRouteConfig | "disable" | RouteHandler
  /** Read operation (GET /entities/:id) */
  read?: EntityRouteConfig | "disable" | RouteHandler
  /** Update operation (PUT /entities/:id) */
  update?: EntityRouteConfig | "disable" | RouteHandler
  /** Delete operation (DELETE /entities/:id) */
  delete?: EntityRouteConfig | "disable" | RouteHandler
  /** Add custom routes */
  custom?: Route[]
}

export interface PluginExtension {
  /** Modify plugin's entities */
  entities?: Record<string, PluginExtensionEntityDef>

  /** Add completely new entities under this plugin's namespace */
  addEntities?: Record<string, PluginEntityDef>

  /**
   * Override plugin routes
   * Can be used to disable routes or provide custom handlers
   */
  routes?: {
    /** Route path -> "disable" | custom handler */
    [path: string]: "disable" | RouteHandler
  }

  /**
   * Override base path for this plugin instance
   * Takes precedence over meta.basePath
   */
  basePath?: string | false

  /**
   * Custom entity route configurations
   * Key is entity name, value is route configuration
   */
  entityRoutes?: Record<string, EntityRoutesConfig>
}

// -----------------------------------------------------------------------------
// Plugin Hooks (Lifecycle Events)
// -----------------------------------------------------------------------------

export interface PluginLifecycleHooks {
  /** Called when plugin is registered */
  onRegister?: (zapi: ZapiInstance) => void | Promise<void>
  
  /** Called when Zapi instance is fully initialized */
  onInit?: (zapi: ZapiInstance) => void | Promise<void>
  
  /** Called before each request (after middleware) */
  onRequest?: (req: ZapiRequest, zapi: ZapiInstance) => void | Promise<void>
  
  /** Called when an error occurs */
  onError?: (error: Error, req: ZapiRequest, zapi: ZapiInstance) => void | Promise<void>
  
  /** Called when plugin is being shut down */
  onShutdown?: (zapi: ZapiInstance) => void | Promise<void>
}

// -----------------------------------------------------------------------------
// Full Plugin Contract
// -----------------------------------------------------------------------------

export interface ZapiPlugin<TOptions = any, TExtension = PluginExtension> {
  /** Plugin metadata */
  meta: PluginMeta
  
  /** Plugin schema (entities and field extensions) */
  schema?: PluginSchema
  
  /** Routes the plugin provides */
  routes?: Route[] | ((zapi: ZapiInstance) => Route[])
  
  /** Middleware the plugin provides */
  middleware?: Middleware[] | ((zapi: ZapiInstance) => Middleware[])
  
  /** Entity-level hooks (beforeCreate, afterUpdate, etc.) */
  hooks?: Hooks
  
  /** Lifecycle hooks */
  lifecycle?: PluginLifecycleHooks
  
  /** Options passed to plugin factory */
  options?: TOptions
  
  /** Extension applied by developer */
  extension?: TExtension
}

// -----------------------------------------------------------------------------
// Plugin Factory Type
// The function signature for creating plugins
// -----------------------------------------------------------------------------

export type PluginFactory<TOptions = any> = (
  options?: TOptions & { extend?: PluginExtension }
) => ZapiPlugin<TOptions>

// -----------------------------------------------------------------------------
// Plugin Registry Entry
// Stored in the global registry
// -----------------------------------------------------------------------------

export interface PluginRegistryEntry {
  plugin: ZapiPlugin
  initialized: boolean
  error?: Error
}

// -----------------------------------------------------------------------------
// Resolved Plugin (After Extension Applied)
// -----------------------------------------------------------------------------

/** Entity metadata including plugin and routing information */
export interface ResolvedEntityMeta {
  /** Original entity name from plugin */
  originalName: string
  /** Plugin ID that owns this entity */
  pluginId: string
  /** Base path for routes (e.g., "/auth") */
  basePath: string
  /** Custom route path (overrides pluralized name) */
  routePath?: string
  /** If true, no CRUD routes generated */
  internal: boolean
  /** Route customizations */
  routeConfig?: EntityRoutesConfig
}

export interface ResolvedPlugin {
  meta: PluginMeta
  /** Resolved base path for this plugin */
  basePath: string
  entities: Entity[]
  /** Metadata for each entity (keyed by entity name) */
  entityMeta: Map<string, ResolvedEntityMeta>
  routes: Route[]
  middleware: Middleware[]
  hooks: Hooks
  lifecycle: PluginLifecycleHooks
  /** Route overrides from extension */
  routeOverrides?: PluginExtension["routes"]
  /** Entity route configs from extension */
  entityRoutes?: PluginExtension["entityRoutes"]
}
