// =============================================================================
// STORAGE PLUGIN
// File storage plugin supporting S3, R2, and local storage
// =============================================================================

import { definePlugin } from "../core/define.js"
import type { Route, ZapiInstance, ZapiRequest } from "../../types.js"
import type { StoragePluginOptions } from "./types.js"
import { storageSchema } from "./schema.js"

// -----------------------------------------------------------------------------
// Re-export types
// -----------------------------------------------------------------------------

export * from "./types.js"

// -----------------------------------------------------------------------------
// Storage Plugin Factory
// -----------------------------------------------------------------------------

export const storage = definePlugin<StoragePluginOptions>({
  meta: {
    id: "storage",
    name: "Storage",
    version: "1.0.0",
    description: "File storage plugin supporting S3, R2, and local storage",
    dependencies: [], // Optional: ["auth"] if you want user-based uploads
  },
  
  defaults: {
    provider: "local",
    basePath: "/storage",
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ["image/*", "application/pdf"],
    uniqueFilenames: true,
  },
  
  validate: (options) => {
    const errors: string[] = []
    
    if (options.provider === "s3" && !options.s3?.bucket) {
      errors.push("S3 bucket is required for s3 provider")
    }
    
    if (options.provider === "r2" && !options.r2?.bucket) {
      errors.push("R2 bucket is required for r2 provider")
    }
    
    if (options.provider === "local" && !options.local?.directory) {
      errors.push("Directory is required for local provider")
    }
    
    return errors
  },
  
  factory: (options, extension) => {
    const basePath = options.basePath || "/storage"
    const maxFileSize = options.maxFileSize || 10 * 1024 * 1024
    
    return {
      schema: storageSchema,
      
      // -----------------------------------------------------------------------
      // Routes
      // -----------------------------------------------------------------------
      routes: ((zapi: ZapiInstance): Route[] => {
        const routes: Route[] = []
        
        // Upload file (get presigned URL)
        routes.push({
          method: "POST",
          path: `${basePath}/upload`,
          handler: async (req: ZapiRequest) => {
            const body = req.body as {
              filename?: string
              mimeType?: string
              size?: number
              folder?: string
            }
            
            if (!body.filename || !body.mimeType) {
              return {
                status: 400,
                body: { error: "filename and mimeType are required" },
              }
            }
            
            if (body.size && body.size > maxFileSize) {
              return {
                status: 400,
                body: { error: `File size exceeds maximum (${maxFileSize} bytes)` },
              }
            }
            
            // TODO: Generate presigned URL based on provider
            // For S3/R2: Generate presigned PUT URL
            // For local: Return direct upload endpoint
            
            return {
              status: 200,
              body: {
                uploadUrl: `${basePath}/direct-upload`,
                key: `${Date.now()}-${body.filename}`,
                expires: 3600,
              },
            }
          },
        })
        
        // Get file info
        routes.push({
          method: "GET",
          path: `${basePath}/files/:id`,
          handler: async (req: ZapiRequest) => {
            const { id } = req.params
            
            // TODO: Fetch file from database
            
            return {
              status: 200,
              body: {
                file: null,
              },
            }
          },
        })
        
        // List files
        routes.push({
          method: "GET",
          path: `${basePath}/files`,
          handler: async (req: ZapiRequest) => {
            const folder = req.query.folder as string | undefined
            
            // TODO: Fetch files from database
            
            return {
              status: 200,
              body: {
                files: [],
                folder: folder || "/",
              },
            }
          },
        })
        
        // Delete file
        routes.push({
          method: "DELETE",
          path: `${basePath}/files/:id`,
          handler: async (req: ZapiRequest) => {
            const { id } = req.params
            
            // TODO: Delete file from storage and database
            
            return {
              status: 200,
              body: { deleted: true },
            }
          },
        })
        
        // Create folder
        routes.push({
          method: "POST",
          path: `${basePath}/folders`,
          handler: async (req: ZapiRequest) => {
            const body = req.body as { name?: string; parent?: string }
            
            if (!body.name) {
              return { status: 400, body: { error: "name is required" } }
            }
            
            // TODO: Create folder in database
            
            return {
              status: 201,
              body: {
                folder: {
                  name: body.name,
                  path: body.parent ? `${body.parent}/${body.name}` : `/${body.name}`,
                },
              },
            }
          },
        })
        
        // Get download URL
        routes.push({
          method: "GET",
          path: `${basePath}/download/:id`,
          handler: async (req: ZapiRequest) => {
            const { id } = req.params
            
            // TODO: Generate presigned download URL
            
            return {
              status: 200,
              body: {
                downloadUrl: `${basePath}/files/${id}/download`,
                expires: 3600,
              },
            }
          },
        })
        
        return routes
      }) as unknown as Route[],
      
      // -----------------------------------------------------------------------
      // Lifecycle Hooks
      // -----------------------------------------------------------------------
      lifecycle: {
        onInit: async (zapi: ZapiInstance) => {
          console.log(`[Storage] Plugin initialized`)
          console.log(`[Storage] Provider: ${options.provider}`)
          console.log(`[Storage] Routes: ${basePath}/*`)
          console.log(`[Storage] Max file size: ${maxFileSize} bytes`)
          console.log(`[Storage] Allowed types: ${options.allowedMimeTypes?.join(", ")}`)
        },
      },
    }
  },
})

// -----------------------------------------------------------------------------
// Default export
// -----------------------------------------------------------------------------

export default storage
