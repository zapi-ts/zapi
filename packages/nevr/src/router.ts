// =============================================================================
// REQUEST ROUTER
// Routes requests to appropriate handlers
// =============================================================================

import type { ZapiRequest, ZapiResponse, Entity, Plugin, Route } from "./types.js"

// -----------------------------------------------------------------------------
// Route Matching
// -----------------------------------------------------------------------------

export interface RouteMatch {
  type: "entity" | "plugin" | "health" | "notFound"
  entity?: Entity
  entityName?: string
  resourceId?: string
  operation?: "list" | "read" | "create" | "update" | "delete"
  pluginRoute?: Route
}

/**
 * Pluralize entity name for URL
 */
export function pluralize(str: string): string {
  if (str.endsWith("y") && !/[aeiou]y$/.test(str)) {
    return str.slice(0, -1) + "ies"
  }
  if (/[sxz]$/.test(str) || /[cs]h$/.test(str)) {
    return str + "es"
  }
  return str + "s"
}

/**
 * Get singular from plural
 */
export function singularize(str: string): string {
  if (str.endsWith("ies")) {
    return str.slice(0, -3) + "y"
  }
  if (str.endsWith("es") && /[sxz]es$|[cs]hes$/.test(str)) {
    return str.slice(0, -2)
  }
  if (str.endsWith("s")) {
    return str.slice(0, -1)
  }
  return str
}

/**
 * Match a request to a route
 */
export function matchRoute(
  req: ZapiRequest,
  entities: Map<string, Entity>,
  pluginRoutes?: Route[]
): RouteMatch {
  const path = req.path.replace(/^\/+|\/+$/g, "") // Remove leading/trailing slashes
  const parts = path.split("/").filter(Boolean)

  // Health check
  if (path === "health" || path === "_health") {
    return { type: "health" }
  }

  // Empty path
  if (parts.length === 0) {
    return { type: "notFound" }
  }

  // Check plugin routes first
  if (pluginRoutes) {
    for (const route of pluginRoutes) {
      if (matchPluginRoute(req.method, `/${path}`, route.method, route.path)) {
        return { type: "plugin", pluginRoute: route }
      }
    }
  }

  // Entity routes
  const resourceName = parts[0]
  const resourceId = parts[1]

  // Find entity by plural name
  let entity: Entity | undefined

  for (const [name, e] of entities) {
    if (pluralize(name) === resourceName || name === resourceName) {
      entity = e
      break
    }
  }

  if (!entity) {
    return { type: "notFound" }
  }

  // Determine operation
  const method = req.method
  let operation: RouteMatch["operation"]

  if (method === "GET" && !resourceId) {
    operation = "list"
  } else if (method === "GET" && resourceId) {
    operation = "read"
  } else if (method === "POST" && !resourceId) {
    operation = "create"
  } else if ((method === "PUT" || method === "PATCH") && resourceId) {
    operation = "update"
  } else if (method === "DELETE" && resourceId) {
    operation = "delete"
  } else {
    return { type: "notFound" }
  }

  return {
    type: "entity",
    entity,
    entityName: entity.name,
    resourceId,
    operation,
  }
}

/**
 * Match plugin route with path params
 */
function matchPluginRoute(
  reqMethod: string,
  reqPath: string,
  routeMethod: string,
  routePath: string
): boolean {
  if (reqMethod !== routeMethod) return false

  const reqParts = reqPath.split("/").filter(Boolean)
  const routeParts = routePath.split("/").filter(Boolean)

  if (reqParts.length !== routeParts.length) return false

  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i]
    const reqPart = reqParts[i]

    // Path parameter (e.g., :id)
    if (routePart.startsWith(":")) {
      continue
    }

    // Exact match required
    if (routePart !== reqPart) {
      return false
    }
  }

  return true
}

/**
 * Extract path parameters
 */
export function extractParams(reqPath: string, routePath: string): Record<string, string> {
  const params: Record<string, string> = {}

  const reqParts = reqPath.split("/").filter(Boolean)
  const routeParts = routePath.split("/").filter(Boolean)

  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i]
    const reqPart = reqParts[i]

    if (routePart.startsWith(":")) {
      const paramName = routePart.slice(1)
      params[paramName] = reqPart
    }
  }

  return params
}
