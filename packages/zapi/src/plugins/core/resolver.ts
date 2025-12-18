// =============================================================================
// PLUGIN RESOLVER
// Resolves plugin extensions and merges schemas
// =============================================================================

import type { Entity, FieldDef, Route, Middleware } from "../../types.js"
import type {
  ZapiPlugin,
  PluginSchema,
  PluginExtension,
  PluginFieldDef,
  PluginEntityDef,
  ResolvedPlugin,
  PluginLifecycleHooks,
} from "./contract.js"

// -----------------------------------------------------------------------------
// Convert Plugin Field to Zapi Field
// -----------------------------------------------------------------------------

function toZapiField(field: PluginFieldDef): FieldDef {
  return {
    type: field.type,
    optional: !field.required,
    unique: field.unique || false,
    default: field.default,
    relation: field.references ? {
      type: "belongsTo",
      entity: () => ({ name: field.references!.entity, config: { fields: {}, rules: {}, timestamps: false } }),
      foreignKey: field.references.entity + "Id",
      references: field.references.field || "id",
    } : undefined,
  }
}

// -----------------------------------------------------------------------------
// Convert Plugin Entity to Zapi Entity
// -----------------------------------------------------------------------------

function toZapiEntity(name: string, def: PluginEntityDef): Entity {
  const fields: Record<string, FieldDef> = {}
  
  for (const [fieldName, fieldDef] of Object.entries(def.fields)) {
    fields[fieldName] = toZapiField(fieldDef)
  }
  
  return {
    name,
    config: {
      fields,
      rules: {
        // Internal entities have no public CRUD routes
        create: def.internal ? [] : undefined,
        read: def.internal ? [] : undefined,
        update: def.internal ? [] : undefined,
        delete: def.internal ? [] : undefined,
        list: def.internal ? [] : undefined,
      },
      timestamps: true,
    },
  }
}

// -----------------------------------------------------------------------------
// Apply Extension to Schema
// -----------------------------------------------------------------------------

function applyExtension(
  schema: PluginSchema,
  extension: PluginExtension,
  pluginId: string
): PluginSchema {
  const result: PluginSchema = {
    entities: { ...schema.entities },
    extend: { ...schema.extend },
  }
  
  // Apply entity modifications
  if (extension.entities && result.entities) {
    for (const [entityName, entityExt] of Object.entries(extension.entities)) {
      const entity = result.entities[entityName]
      
      if (!entity) {
        console.warn(`[${pluginId}] Cannot extend non-existent entity: ${entityName}`)
        continue
      }
      
      // Remove entity if requested (and allowed)
      if (entityExt.remove) {
        if (entity.required) {
          console.warn(`[${pluginId}] Cannot remove required entity: ${entityName}`)
        } else {
          delete result.entities[entityName]
          continue
        }
      }
      
      // Add new fields directly
      if (entityExt.addFields) {
        for (const [fieldName, fieldDef] of Object.entries(entityExt.addFields)) {
          entity.fields[fieldName] = fieldDef
        }
      }
      
      // Modify existing fields
      if (entityExt.fields) {
        for (const [fieldName, fieldExt] of Object.entries(entityExt.fields)) {
          const field = entity.fields[fieldName]
          
          // Add new field
          if (fieldExt.add) {
            entity.fields[fieldName] = fieldExt.add
            continue
          }
          
          // Field operations require field to exist
          if (!field) {
            console.warn(`[${pluginId}] Cannot modify non-existent field: ${entityName}.${fieldName}`)
            continue
          }
          
          // Remove field (if not locked)
          if (fieldExt.remove) {
            if (field.locked) {
              console.warn(`[${pluginId}] Cannot remove locked field: ${entityName}.${fieldName}`)
            } else {
              delete entity.fields[fieldName]
            }
            continue
          }
          
          // Rename field
          if (fieldExt.rename) {
            entity.fields[fieldExt.rename] = field
            delete entity.fields[fieldName]
          }
          
          // Override field properties
          if (fieldExt.override) {
            Object.assign(field, fieldExt.override)
          }
        }
      }
    }
  }
  
  // Add new entities
  if (extension.addEntities) {
    if (!result.entities) result.entities = {}
    for (const [entityName, entityDef] of Object.entries(extension.addEntities)) {
      // Namespace the entity name
      result.entities[`${pluginId}_${entityName}`] = entityDef
    }
  }
  
  return result
}

// -----------------------------------------------------------------------------
// Resolve Plugin
// Applies extension and converts to Zapi-compatible format
// -----------------------------------------------------------------------------

export function resolvePlugin(plugin: ZapiPlugin): ResolvedPlugin {
  const { meta, schema, extension, routes, middleware, hooks, lifecycle } = plugin
  
  // Apply extension if provided
  let resolvedSchema = schema || { entities: {}, extend: {} }
  if (extension) {
    resolvedSchema = applyExtension(resolvedSchema, extension, meta.id)
  }
  
  // Convert plugin entities to Zapi entities
  const entities: Entity[] = []
  if (resolvedSchema.entities) {
    for (const [name, def] of Object.entries(resolvedSchema.entities)) {
      entities.push(toZapiEntity(name, def))
    }
  }
  
  // Resolve routes (can be array or factory)
  const resolvedRoutes: Route[] = []
  // Routes are resolved later when ZapiInstance is available
  
  // Resolve middleware (can be array or factory)
  const resolvedMiddleware: Middleware[] = []
  // Middleware is resolved later when ZapiInstance is available
  
  return {
    meta,
    entities,
    routes: resolvedRoutes,
    middleware: resolvedMiddleware,
    hooks: hooks || {},
    lifecycle: lifecycle || {},
  }
}

// -----------------------------------------------------------------------------
// Get Plugin Field Extensions
// Returns fields to add to developer's entities
// -----------------------------------------------------------------------------

export function getPluginFieldExtensions(
  plugin: ZapiPlugin
): Map<string, Record<string, FieldDef>> {
  const extensions = new Map<string, Record<string, FieldDef>>()
  
  const schema = plugin.schema
  if (!schema?.extend) return extensions
  
  for (const [entityName, fields] of Object.entries(schema.extend)) {
    const zapiFields: Record<string, FieldDef> = {}
    
    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      zapiFields[fieldName] = toZapiField(fieldDef)
    }
    
    extensions.set(entityName, zapiFields)
  }
  
  return extensions
}

// -----------------------------------------------------------------------------
// Merge Multiple Plugin Resolutions
// -----------------------------------------------------------------------------

export function mergeResolvedPlugins(plugins: ResolvedPlugin[]): {
  entities: Entity[]
  routes: Route[]
  middleware: Middleware[]
} {
  const entities: Entity[] = []
  const routes: Route[] = []
  const middleware: Middleware[] = []
  
  for (const plugin of plugins) {
    entities.push(...plugin.entities)
    routes.push(...plugin.routes)
    middleware.push(...plugin.middleware)
  }
  
  return { entities, routes, middleware }
}
