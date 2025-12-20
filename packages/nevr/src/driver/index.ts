// =============================================================================
// DRIVER SYSTEM
// Database abstraction layer - inspired by Better Auth's adapter pattern
// =============================================================================

import type { Where, QueryOptions } from "../types.js"

// -----------------------------------------------------------------------------
// Driver Types
// -----------------------------------------------------------------------------

export type DriverDebugLogOption =
  | boolean
  | {
      logCondition?: (() => boolean) | undefined
      create?: boolean | undefined
      update?: boolean | undefined
      findOne?: boolean | undefined
      findMany?: boolean | undefined
      delete?: boolean | undefined
      count?: boolean | undefined
    }

export interface DriverFactoryConfig {
  /**
   * Unique identifier for the driver
   */
  driverId: string

  /**
   * Human-readable name
   */
  driverName?: string | undefined

  /**
   * Use plural table names
   * @default false
   */
  usePlural?: boolean | undefined

  /**
   * Enable debug logs
   * @default false
   */
  debugLogs?: DriverDebugLogOption | undefined

  /**
   * Database supports JSON columns natively
   * @default false
   */
  supportsJSON?: boolean | undefined

  /**
   * Database supports Date objects natively
   * @default true
   */
  supportsDates?: boolean | undefined

  /**
   * Database supports boolean natively
   * @default true
   */
  supportsBooleans?: boolean | undefined

  /**
   * Database supports transactions
   * @default false
   */
  supportsTransactions?: boolean | undefined

  /**
   * Custom ID generator
   */
  generateId?: (() => string) | undefined

  /**
   * Transform model name (e.g., pluralize, case conversion)
   */
  transformModelName?: ((model: string) => string) | undefined

  /**
   * Transform field name (e.g., snake_case to camelCase)
   */
  transformFieldName?: ((field: string, model: string) => string) | undefined
}

// -----------------------------------------------------------------------------
// Driver Interface (What drivers must implement)
// -----------------------------------------------------------------------------

export interface Driver {
  /**
   * Unique identifier for the driver
   */
  id: string

  /**
   * Human-readable name
   */
  name: string

  /**
   * Find a single record
   */
  findOne<T>(entity: string, where: Where): Promise<T | null>

  /**
   * Find multiple records with filtering, sorting, pagination
   */
  findMany<T>(entity: string, options?: QueryOptions): Promise<T[]>

  /**
   * Create a new record
   */
  create<T>(entity: string, data: Record<string, unknown>): Promise<T>

  /**
   * Update an existing record
   */
  update<T>(entity: string, where: Where, data: Record<string, unknown>): Promise<T>

  /**
   * Delete a record
   */
  delete(entity: string, where: Where): Promise<void>

  /**
   * Count records matching a condition
   */
  count(entity: string, where?: Where): Promise<number>

  /**
   * Execute multiple operations in a transaction
   */
  transaction?<R>(callback: (driver: Driver) => Promise<R>): Promise<R>

  /**
   * Get the raw database client (for advanced use cases)
   */
  getClient(): unknown
}

// -----------------------------------------------------------------------------
// Custom Driver Creator Interface
// -----------------------------------------------------------------------------

export interface CustomDriverMethods {
  create<T extends Record<string, unknown>>(data: {
    model: string
    data: T
    select?: string[] | undefined
  }): Promise<T>

  findOne<T>(data: {
    model: string
    where: Where
    select?: string[] | undefined
  }): Promise<T | null>

  findMany<T>(data: {
    model: string
    where?: Where | undefined
    limit?: number | undefined
    offset?: number | undefined
    orderBy?: Record<string, "asc" | "desc"> | undefined
  }): Promise<T[]>

  update<T>(data: {
    model: string
    where: Where
    update: Record<string, unknown>
  }): Promise<T | null>

  delete(data: { model: string; where: Where }): Promise<void>

  count(data: { model: string; where?: Where | undefined }): Promise<number>
}

// -----------------------------------------------------------------------------
// Driver Factory
// -----------------------------------------------------------------------------

export interface DriverFactoryOptions<TClient = unknown> {
  config: DriverFactoryConfig
  client: TClient
  createCustomDriver: (client: TClient, config: DriverFactoryConfig) => CustomDriverMethods
}

/**
 * Create a driver using the factory pattern
 * This allows consistent driver creation across different database adapters
 */
export function createDriverFactory<TClient = unknown>(
  options: DriverFactoryOptions<TClient>
): Driver {
  const { config, client, createCustomDriver } = options
  const customDriver = createCustomDriver(client, config)

  const shouldLog = (operation: string): boolean => {
    if (!config.debugLogs) return false
    if (config.debugLogs === true) return true
    if (typeof config.debugLogs === "object") {
      if (config.debugLogs.logCondition && !config.debugLogs.logCondition()) {
        return false
      }
      return (config.debugLogs as Record<string, boolean>)[operation] !== false
    }
    return false
  }

  const log = (operation: string, data: unknown): void => {
    if (shouldLog(operation)) {
      console.log(`[${config.driverName || config.driverId}] ${operation}:`, data)
    }
  }

  const getModelName = (model: string): string => {
    if (config.transformModelName) {
      return config.transformModelName(model)
    }
    return model
  }

  return {
    id: config.driverId,
    name: config.driverName || config.driverId,

    async findOne<T>(entity: string, where: Where): Promise<T | null> {
      const model = getModelName(entity)
      log("findOne", { model, where })
      return customDriver.findOne<T>({ model, where })
    },

    async findMany<T>(entity: string, options: QueryOptions = {}): Promise<T[]> {
      const model = getModelName(entity)
      log("findMany", { model, options })
      return customDriver.findMany<T>({
        model,
        where: options.where,
        limit: options.take,
        offset: options.skip,
        orderBy: options.orderBy,
      })
    },

    async create<T>(entity: string, data: Record<string, unknown>): Promise<T> {
      const model = getModelName(entity)
      log("create", { model, data })
      return customDriver.create<T & Record<string, unknown>>({ model, data: data as T & Record<string, unknown> }) as Promise<T>
    },

    async update<T>(entity: string, where: Where, data: Record<string, unknown>): Promise<T> {
      const model = getModelName(entity)
      log("update", { model, where, data })
      const result = await customDriver.update<T>({ model, where, update: data })
      if (!result) {
        throw new Error(`Record not found for update: ${model}`)
      }
      return result
    },

    async delete(entity: string, where: Where): Promise<void> {
      const model = getModelName(entity)
      log("delete", { model, where })
      return customDriver.delete({ model, where })
    },

    async count(entity: string, where?: Where): Promise<number> {
      const model = getModelName(entity)
      log("count", { model, where })
      return customDriver.count({ model, where })
    },

    getClient(): TClient {
      return client
    },
  }
}

// -----------------------------------------------------------------------------
// Re-exports
// -----------------------------------------------------------------------------

export type { Where, QueryOptions } from "../types.js"
