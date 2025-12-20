// =============================================================================
// AUTH PLUGIN SCHEMA
// Defines the schema for auth plugin entities
// =============================================================================

import type { PluginSchema } from "../core/contract.js"

/**
 * Auth plugin schema definition
 * These are the tables Better Auth needs
 */
export const authSchema: PluginSchema = {
  // -------------------------------------------------------------------------
  // Plugin's own entities
  // -------------------------------------------------------------------------
  entities: {
    session: {
      description: "Active user sessions",
      internal: true, // Managed by Better Auth, no CRUD routes
      fields: {
        token: {
          type: "string",
          required: true,
          unique: true,
          locked: true, // Cannot be removed
          description: "Session token",
        },
        userId: {
          type: "string",
          required: true,
          locked: true,
          references: { entity: "user", field: "id" },
          description: "Reference to user",
        },
        expiresAt: {
          type: "datetime",
          required: true,
          locked: true,
          description: "Session expiration time",
        },
        ipAddress: {
          type: "string",
          required: false,
          description: "Client IP address",
        },
        userAgent: {
          type: "string",
          required: false,
          description: "Client user agent",
        },
      },
    },
    
    account: {
      description: "OAuth provider accounts",
      internal: true,
      fields: {
        userId: {
          type: "string",
          required: true,
          locked: true,
          references: { entity: "user", field: "id" },
          description: "Reference to user",
        },
        accountId: {
          type: "string",
          required: true,
          locked: true,
          description: "Account ID from provider",
        },
        providerId: {
          type: "string",
          required: true,
          locked: true,
          description: "OAuth provider (google, github, etc.)",
        },
        accessToken: {
          type: "text",
          required: false,
          description: "OAuth access token",
        },
        refreshToken: {
          type: "text",
          required: false,
          description: "OAuth refresh token",
        },
        accessTokenExpiresAt: {
          type: "datetime",
          required: false,
          description: "Access token expiration",
        },
        refreshTokenExpiresAt: {
          type: "datetime",
          required: false,
          description: "Refresh token expiration",
        },
        scope: {
          type: "string",
          required: false,
          description: "OAuth scopes",
        },
        idToken: {
          type: "text",
          required: false,
          description: "OAuth ID token",
        },
        password: {
          type: "string",
          required: false,
          description: "Hashed password (for email/password auth)",
        },
      },
    },
    
    verification: {
      description: "Email verification and password reset tokens",
      internal: true,
      fields: {
        identifier: {
          type: "string",
          required: true,
          locked: true,
          description: "What is being verified (email, phone, etc.)",
        },
        value: {
          type: "string",
          required: true,
          locked: true,
          description: "Verification token",
        },
        expiresAt: {
          type: "datetime",
          required: true,
          locked: true,
          description: "Token expiration time",
        },
      },
    },
  },
  
  // -------------------------------------------------------------------------
  // Fields added to user entity
  // -------------------------------------------------------------------------
  extend: {
    user: {
      email: {
        type: "string",
        required: true,
        unique: true,
        locked: true,
        description: "User email address",
      },
      emailVerified: {
        type: "boolean",
        required: false,
        default: false,
        description: "Whether email is verified",
      },
      image: {
        type: "string",
        required: false,
        description: "User avatar URL (from OAuth)",
      },
    },
  },
}

/**
 * JWKS schema (only for JWT mode)
 */
export const jwksSchema: PluginSchema = {
  entities: {
    jwks: {
      description: "JSON Web Key Store for JWT verification",
      internal: true,
      fields: {
        publicKey: {
          type: "text",
          required: true,
          locked: true,
          description: "Public key for JWT verification",
        },
        privateKey: {
          type: "text",
          required: true,
          locked: true,
          description: "Private key for JWT signing",
        },
        expiresAt: {
          type: "datetime",
          required: false,
          description: "Key expiration time",
        },
      },
    },
  },
}
