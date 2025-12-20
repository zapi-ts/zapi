// =============================================================================
// STORAGE PLUGIN SCHEMA
// Defines the schema for storage plugin entities
// =============================================================================

import type { PluginSchema } from "../core/contract.js"

/**
 * Storage plugin schema definition
 */
export const storageSchema: PluginSchema = {
  // -------------------------------------------------------------------------
  // Plugin's own entities
  // -------------------------------------------------------------------------
  entities: {
    file: {
      description: "Stored files metadata",
      internal: false, // Can be accessed via CRUD
      fields: {
        filename: {
          type: "string",
          required: true,
          unique: true,
          locked: true,
          description: "Unique filename in storage",
        },
        originalName: {
          type: "string",
          required: true,
          description: "Original filename from upload",
        },
        mimeType: {
          type: "string",
          required: true,
          description: "File MIME type",
        },
        size: {
          type: "int",
          required: true,
          description: "File size in bytes",
        },
        url: {
          type: "string",
          required: true,
          description: "Public URL to access file",
        },
        key: {
          type: "string",
          required: true,
          locked: true,
          description: "Storage provider key/path",
        },
        uploadedBy: {
          type: "string",
          required: false,
          references: { entity: "user", field: "id" },
          description: "Reference to uploading user",
        },
        folder: {
          type: "string",
          required: false,
          description: "Virtual folder path",
        },
        metadata: {
          type: "json",
          required: false,
          description: "Additional file metadata",
        },
        isPublic: {
          type: "boolean",
          required: false,
          default: false,
          description: "Whether file is publicly accessible",
        },
      },
    },
    
    folder: {
      description: "Virtual folders for organizing files",
      internal: false,
      fields: {
        name: {
          type: "string",
          required: true,
          description: "Folder name",
        },
        path: {
          type: "string",
          required: true,
          unique: true,
          description: "Full folder path",
        },
        parentId: {
          type: "string",
          required: false,
          references: { entity: "folder", field: "id" },
          description: "Parent folder reference",
        },
        ownerId: {
          type: "string",
          required: false,
          references: { entity: "user", field: "id" },
          description: "Folder owner",
        },
      },
    },
  },
  
  // -------------------------------------------------------------------------
  // Fields added to user entity
  // -------------------------------------------------------------------------
  extend: {
    user: {
      avatarUrl: {
        type: "string",
        required: false,
        description: "User avatar URL (stored file)",
      },
      storageQuota: {
        type: "int",
        required: false,
        default: 104857600, // 100MB default
        description: "Storage quota in bytes",
      },
      storageUsed: {
        type: "int",
        required: false,
        default: 0,
        description: "Storage used in bytes",
      },
    },
  },
}
