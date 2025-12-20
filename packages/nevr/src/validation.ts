// =============================================================================
// INPUT VALIDATION
// Validates input data against entity field definitions
// =============================================================================

import type { Entity, FieldDef, ValidationResult, ValidationError, Operation } from "./types.js"

// -----------------------------------------------------------------------------
// Email Validation
// -----------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value)
}

// -----------------------------------------------------------------------------
// Field Validation
// -----------------------------------------------------------------------------

function validateField(
  fieldName: string,
  value: unknown,
  field: FieldDef,
  operation: Operation
): ValidationError[] {
  const errors: ValidationError[] = []

  // Skip validation for undefined optional fields
  if (value === undefined) {
    // Required check (not optional and no default)
    if (!field.optional && field.default === undefined && operation === "create") {
      errors.push({ field: fieldName, message: "Required" })
    }
    return errors
  }

  // Null check
  if (value === null) {
    if (!field.optional) {
      errors.push({ field: fieldName, message: "Cannot be null" })
    }
    return errors
  }

  // Type validation
  switch (field.type) {
    case "string":
    case "text":
      if (typeof value !== "string") {
        errors.push({ field: fieldName, message: "Must be a string" })
      } else {
        // Email validation
        if (field.isEmail && !isValidEmail(value)) {
          errors.push({ field: fieldName, message: "Invalid email format" })
        }
        // Min length
        if (field.min !== undefined && value.length < field.min) {
          errors.push({
            field: fieldName,
            message: `Must be at least ${field.min} characters`,
          })
        }
        // Max length
        if (field.max !== undefined && value.length > field.max) {
          errors.push({
            field: fieldName,
            message: `Must be at most ${field.max} characters`,
          })
        }
      }
      break

    case "int":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        errors.push({ field: fieldName, message: "Must be an integer" })
      } else {
        if (field.min !== undefined && value < field.min) {
          errors.push({ field: fieldName, message: `Must be at least ${field.min}` })
        }
        if (field.max !== undefined && value > field.max) {
          errors.push({ field: fieldName, message: `Must be at most ${field.max}` })
        }
      }
      break

    case "float":
      if (typeof value !== "number") {
        errors.push({ field: fieldName, message: "Must be a number" })
      } else {
        if (field.min !== undefined && value < field.min) {
          errors.push({ field: fieldName, message: `Must be at least ${field.min}` })
        }
        if (field.max !== undefined && value > field.max) {
          errors.push({ field: fieldName, message: `Must be at most ${field.max}` })
        }
      }
      break

    case "boolean":
      if (typeof value !== "boolean") {
        errors.push({ field: fieldName, message: "Must be a boolean" })
      }
      break

    case "datetime":
      if (!(value instanceof Date) && typeof value !== "string") {
        errors.push({ field: fieldName, message: "Must be a date" })
      } else if (typeof value === "string") {
        const date = new Date(value)
        if (isNaN(date.getTime())) {
          errors.push({ field: fieldName, message: "Invalid date format" })
        }
      }
      break

    case "json":
      // JSON accepts any value
      break
  }

  return errors
}

// -----------------------------------------------------------------------------
// Input Validation
// -----------------------------------------------------------------------------

/**
 * Validate input data against entity definition
 */
export function validateInput(
  entity: Entity,
  input: Record<string, unknown>,
  operation: Operation
): ValidationResult {
  const errors: ValidationError[] = []
  const data: Record<string, unknown> = {}

  // Get allowed fields (exclude relations for hasMany)
  const allowedFields = new Set<string>()
  const foreignKeys = new Set<string>()

  for (const [name, field] of Object.entries(entity.config.fields)) {
    if (field.relation?.type === "hasMany") {
      // Skip hasMany relations in input
      continue
    }

    if (field.relation) {
      // For belongsTo, allow the foreign key
      foreignKeys.add(field.relation.foreignKey)
      allowedFields.add(name)
    } else {
      allowedFields.add(name)
    }
  }

  // Add foreign keys to allowed fields
  for (const fk of foreignKeys) {
    allowedFields.add(fk)
  }

  // Validate each field in input
  for (const [key, value] of Object.entries(input)) {
    // Skip unknown fields (mass assignment protection)
    if (!allowedFields.has(key)) {
      continue
    }

    // Find field definition
    let field = entity.config.fields[key]

    // Check if it's a foreign key
    if (!field) {
      // Find the relation that uses this foreign key
      for (const [, f] of Object.entries(entity.config.fields)) {
        if (f.relation?.foreignKey === key) {
          // Treat as string field for validation
          field = { type: "string", optional: f.optional, unique: false }
          break
        }
      }
    }

    if (field) {
      const fieldErrors = validateField(key, value, field, operation)
      errors.push(...fieldErrors)

      if (fieldErrors.length === 0 && value !== undefined) {
        data[key] = value
      }
    }
  }

  // For create, check required fields
  if (operation === "create") {
    for (const [name, field] of Object.entries(entity.config.fields)) {
      // Skip relations (hasMany) and auto-generated
      if (field.relation?.type === "hasMany") continue

      // Skip owner field (auto-set)
      if (entity.config.ownerField && field.relation?.foreignKey === entity.config.ownerField) {
        continue
      }

      // Check if required field is missing
      const fieldName = field.relation ? field.relation.foreignKey : name
      if (!field.optional && field.default === undefined && !(fieldName in input)) {
        errors.push({ field: fieldName, message: "Required" })
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data,
  }
}

/**
 * Validate query parameters for list endpoints
 * 
 * Supported query parameters:
 * - filter[field]=value         Exact match
 * - filter[field][eq]=value     Equals
 * - filter[field][ne]=value     Not equals
 * - filter[field][gt]=value     Greater than
 * - filter[field][gte]=value    Greater than or equal
 * - filter[field][lt]=value     Less than
 * - filter[field][lte]=value    Less than or equal
 * - filter[field][contains]=value    String contains
 * - filter[field][startsWith]=value  String starts with
 * - filter[field][endsWith]=value    String ends with
 * - filter[field][in]=a,b,c     In array
 * - sort=field,-field2          Sort (prefix with - for desc)
 * - limit=20                    Max results (default: 20, max: 100)
 * - offset=0                    Skip results
 * - page=1                      Page number (alternative to offset)
 * - include=relation1,relation2 Include relations
 */
export function validateQueryParams(query: Record<string, unknown>): {
  filter: Record<string, unknown>
  sort: Record<string, "asc" | "desc">
  take: number
  skip: number
  include: Record<string, boolean>
} {
  const filter: Record<string, unknown> = {}
  const sort: Record<string, "asc" | "desc"> = {}
  let take = 20
  let skip = 0
  const include: Record<string, boolean> = {}

  // Parse filter - support both simple and operator syntax
  for (const [key, value] of Object.entries(query)) {
    // Simple filter: filter[field]=value
    if (key.startsWith("filter[") && key.endsWith("]") && !key.includes("][")) {
      const fieldName = key.slice(7, -1)
      filter[fieldName] = parseFilterValue(value)
    }
    
    // Operator filter: filter[field][operator]=value
    const operatorMatch = key.match(/^filter\[(\w+)\]\[(\w+)\]$/)
    if (operatorMatch) {
      const [, fieldName, operator] = operatorMatch
      const parsedValue = parseFilterValue(value)
      
      // Map operators to Prisma-style where clause
      switch (operator) {
        case "eq":
        case "equals":
          filter[fieldName] = { equals: parsedValue }
          break
        case "ne":
        case "not":
          filter[fieldName] = { not: parsedValue }
          break
        case "gt":
          filter[fieldName] = { gt: parsedValue }
          break
        case "gte":
          filter[fieldName] = { gte: parsedValue }
          break
        case "lt":
          filter[fieldName] = { lt: parsedValue }
          break
        case "lte":
          filter[fieldName] = { lte: parsedValue }
          break
        case "contains":
          filter[fieldName] = { contains: parsedValue }
          break
        case "startsWith":
          filter[fieldName] = { startsWith: parsedValue }
          break
        case "endsWith":
          filter[fieldName] = { endsWith: parsedValue }
          break
        case "in":
          // Handle comma-separated values
          const inValues = typeof value === "string" 
            ? value.split(",").map(v => parseFilterValue(v.trim()))
            : Array.isArray(value) ? value.map(parseFilterValue) : [parsedValue]
          filter[fieldName] = { in: inValues }
          break
        case "notIn":
          const notInValues = typeof value === "string"
            ? value.split(",").map(v => parseFilterValue(v.trim()))
            : Array.isArray(value) ? value.map(parseFilterValue) : [parsedValue]
          filter[fieldName] = { notIn: notInValues }
          break
      }
    }
  }

  // Parse sort - support comma-separated, prefix with - for desc
  if (typeof query.sort === "string") {
    const sortFields = query.sort.split(",")
    for (const field of sortFields) {
      const trimmed = field.trim()
      if (trimmed.startsWith("-")) {
        sort[trimmed.slice(1)] = "desc"
      } else if (trimmed.startsWith("+")) {
        sort[trimmed.slice(1)] = "asc"
      } else {
        sort[trimmed] = "asc"
      }
    }
  }
  
  // Also support orderBy as alias for sort
  if (typeof query.orderBy === "string") {
    const sortFields = query.orderBy.split(",")
    for (const field of sortFields) {
      const trimmed = field.trim()
      if (trimmed.startsWith("-")) {
        sort[trimmed.slice(1)] = "desc"
      } else {
        sort[trimmed] = "asc"
      }
    }
  }

  // Parse pagination
  if (typeof query.limit === "string") {
    take = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 100)
  }
  if (typeof query.take === "string") {
    take = Math.min(Math.max(1, parseInt(query.take, 10) || 20), 100)
  }
  
  if (typeof query.offset === "string") {
    skip = Math.max(0, parseInt(query.offset, 10) || 0)
  }
  if (typeof query.skip === "string") {
    skip = Math.max(0, parseInt(query.skip, 10) || 0)
  }
  
  // Support page-based pagination
  if (typeof query.page === "string") {
    const page = Math.max(1, parseInt(query.page, 10) || 1)
    skip = (page - 1) * take
  }

  // Parse include - comma-separated relation names
  if (typeof query.include === "string") {
    const includes = query.include.split(",")
    for (const inc of includes) {
      const trimmed = inc.trim()
      if (trimmed) {
        include[trimmed] = true
      }
    }
  }

  return { filter, sort, take, skip, include }
}

/**
 * Parse filter value to correct type
 */
function parseFilterValue(value: unknown): unknown {
  if (typeof value !== "string") return value
  
  // Boolean
  if (value === "true") return true
  if (value === "false") return false
  
  // Null
  if (value === "null") return null
  
  // Number
  if (/^-?\d+$/.test(value)) return parseInt(value, 10)
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value)
  
  // String
  return value
}
