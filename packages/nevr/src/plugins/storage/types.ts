// =============================================================================
// STORAGE PLUGIN TYPES
// =============================================================================

import type { PluginExtension } from "../core/contract.js"

// -----------------------------------------------------------------------------
// Provider Configurations
// -----------------------------------------------------------------------------

export interface S3Config {
  /** AWS region */
  region: string
  /** S3 bucket name */
  bucket: string
  /** AWS access key ID */
  accessKeyId?: string
  /** AWS secret access key */
  secretAccessKey?: string
  /** Custom endpoint (for S3-compatible services like MinIO) */
  endpoint?: string
  /** Force path style (required for some S3-compatible services) */
  forcePathStyle?: boolean
}

export interface CloudflareR2Config {
  /** R2 account ID */
  accountId: string
  /** R2 bucket name */
  bucket: string
  /** R2 access key ID */
  accessKeyId: string
  /** R2 secret access key */
  secretAccessKey: string
}

export interface LocalConfig {
  /** Local storage directory */
  directory: string
  /** Public URL prefix for serving files */
  publicUrl?: string
}

// -----------------------------------------------------------------------------
// Main Plugin Options
// -----------------------------------------------------------------------------

export interface StoragePluginOptions {
  /**
   * Storage provider
   */
  provider: "s3" | "r2" | "local"
  
  /**
   * S3 configuration
   */
  s3?: S3Config
  
  /**
   * Cloudflare R2 configuration
   */
  r2?: CloudflareR2Config
  
  /**
   * Local storage configuration
   */
  local?: LocalConfig
  
  /**
   * Base path for storage routes
   * Default: "/storage"
   */
  basePath?: string
  
  /**
   * Maximum file size in bytes
   * Default: 10MB (10 * 1024 * 1024)
   */
  maxFileSize?: number
  
  /**
   * Allowed MIME types
   * Default: ["image/*", "application/pdf"]
   */
  allowedMimeTypes?: string[]
  
  /**
   * Generate unique filenames
   * Default: true
   */
  uniqueFilenames?: boolean
  
  /**
   * Plugin extension
   */
  extend?: PluginExtension
}

// -----------------------------------------------------------------------------
// Storage Entities
// -----------------------------------------------------------------------------

export interface StoredFile {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  key: string
  uploadedBy?: string
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}
