// =============================================================================
// AUTHORIZATION RULES
// Built-in rules and rule checking
// =============================================================================

import type { RuleContext, RuleFn, RuleDef, BuiltInRule, Entity, Operation } from "./types.js"

// -----------------------------------------------------------------------------
// Built-in Rules
// -----------------------------------------------------------------------------

/** Anyone can access (no auth required) */
export const everyone: RuleFn = () => true

/** Must be logged in */
export const authenticated: RuleFn = (ctx) => ctx.user !== null

/** Must be admin role */
export const admin: RuleFn = (ctx) => ctx.user?.role === "admin"

/**
 * Must own the resource
 * Uses entity's ownerField to check ownership
 */
export function owner(ownerField: string): RuleFn {
  return (ctx) => {
    // Must be logged in
    if (!ctx.user) return false

    // For create, allow (owner will be set)
    if (!ctx.resource) return true

    // Check ownership
    return ctx.resource[ownerField] === ctx.user.id
  }
}

/**
 * Must be owner OR admin
 */
export function ownerOrAdmin(ownerField: string): RuleFn {
  return (ctx) => {
    if (!ctx.user) return false
    if (ctx.user.role === "admin") return true
    if (!ctx.resource) return true
    return ctx.resource[ownerField] === ctx.user.id
  }
}

// -----------------------------------------------------------------------------
// Rule Resolution
// -----------------------------------------------------------------------------

/**
 * Resolve a rule definition to a rule function
 */
export function resolveRule(rule: RuleDef, ownerField: string): RuleFn {
  if (typeof rule === "function") {
    return rule
  }

  switch (rule as BuiltInRule) {
    case "everyone":
      return everyone
    case "authenticated":
      return authenticated
    case "admin":
      return admin
    case "owner":
      return owner(ownerField)
    default:
      return everyone
  }
}

// -----------------------------------------------------------------------------
// Rule Checking
// -----------------------------------------------------------------------------

/**
 * Check if an operation is allowed
 */
export async function checkRules(
  entity: Entity,
  operation: Operation,
  ctx: Omit<RuleContext, "entity" | "operation">
): Promise<{ allowed: boolean; error?: string }> {
  const rules = entity.config.rules[operation]
  const ownerField = entity.config.ownerField || "authorId"

  // If no rules defined, default to everyone
  if (!rules || rules.length === 0) {
    return { allowed: true }
  }

  const fullCtx: RuleContext = {
    ...ctx,
    entity: entity.name,
    operation,
  }

  // All rules must pass
  for (const ruleDef of rules) {
    const rule = resolveRule(ruleDef, ownerField)

    try {
      const result = await rule(fullCtx)
      if (!result) {
        // Determine appropriate error message
        if (ctx.user === null) {
          return { allowed: false, error: "Authentication required" }
        }
        return { allowed: false, error: "Permission denied" }
      }
    } catch (e) {
      return { allowed: false, error: (e as Error).message }
    }
  }

  return { allowed: true }
}

/**
 * Get all rules for an operation as functions
 */
export function getRulesForOperation(entity: Entity, operation: Operation): RuleFn[] {
  const rules = entity.config.rules[operation] || []
  const ownerField = entity.config.ownerField || "authorId"

  return rules.map((rule) => resolveRule(rule, ownerField))
}
