// =============================================================================
// PAYMENTS PLUGIN SCHEMA
// Defines the schema for payments plugin entities
// =============================================================================

import type { PluginSchema } from "../core/contract.js"

/**
 * Payments plugin schema definition
 * These are the tables needed for payment/subscription management
 */
export const paymentsSchema: PluginSchema = {
  // -------------------------------------------------------------------------
  // Plugin's own entities
  // -------------------------------------------------------------------------
  entities: {
    customer: {
      description: "Customer record linked to payment provider",
      internal: false, // Can be accessed via CRUD
      fields: {
        userId: {
          type: "string",
          required: true,
          unique: true,
          locked: true,
          references: { entity: "user", field: "id" },
          description: "Reference to user",
        },
        stripeCustomerId: {
          type: "string",
          required: true,
          unique: true,
          locked: true,
          description: "Stripe customer ID",
        },
        email: {
          type: "string",
          required: true,
          description: "Customer email (synced from Stripe)",
        },
        defaultPaymentMethod: {
          type: "string",
          required: false,
          description: "Default payment method ID",
        },
      },
    },
    
    subscription: {
      description: "Active subscriptions",
      internal: false,
      fields: {
        customerId: {
          type: "string",
          required: true,
          locked: true,
          references: { entity: "customer", field: "id" },
          description: "Reference to customer",
        },
        stripeSubscriptionId: {
          type: "string",
          required: true,
          unique: true,
          locked: true,
          description: "Stripe subscription ID",
        },
        status: {
          type: "string",
          required: true,
          locked: true,
          description: "Subscription status",
        },
        priceId: {
          type: "string",
          required: true,
          references: { entity: "price", field: "id" },
          description: "Reference to price",
        },
        currentPeriodStart: {
          type: "datetime",
          required: true,
          description: "Current billing period start",
        },
        currentPeriodEnd: {
          type: "datetime",
          required: true,
          description: "Current billing period end",
        },
        cancelAtPeriodEnd: {
          type: "boolean",
          required: false,
          default: false,
          description: "Cancel at end of period",
        },
        trialEnd: {
          type: "datetime",
          required: false,
          description: "Trial end date",
        },
      },
    },
    
    payment: {
      description: "One-time payments",
      internal: false,
      fields: {
        customerId: {
          type: "string",
          required: true,
          locked: true,
          references: { entity: "customer", field: "id" },
          description: "Reference to customer",
        },
        stripePaymentIntentId: {
          type: "string",
          required: true,
          unique: true,
          locked: true,
          description: "Stripe payment intent ID",
        },
        amount: {
          type: "int",
          required: true,
          locked: true,
          description: "Amount in cents",
        },
        currency: {
          type: "string",
          required: true,
          description: "Currency code (e.g., usd)",
        },
        status: {
          type: "string",
          required: true,
          description: "Payment status",
        },
        description: {
          type: "string",
          required: false,
          description: "Payment description",
        },
        metadata: {
          type: "json",
          required: false,
          description: "Additional metadata",
        },
      },
    },
    
    product: {
      description: "Products available for purchase",
      internal: false,
      fields: {
        stripeProductId: {
          type: "string",
          required: true,
          unique: true,
          locked: true,
          description: "Stripe product ID",
        },
        name: {
          type: "string",
          required: true,
          description: "Product name",
        },
        description: {
          type: "text",
          required: false,
          description: "Product description",
        },
        active: {
          type: "boolean",
          required: false,
          default: true,
          description: "Is product active",
        },
        metadata: {
          type: "json",
          required: false,
          description: "Additional metadata",
        },
      },
    },
    
    price: {
      description: "Pricing for products",
      internal: false,
      fields: {
        stripePriceId: {
          type: "string",
          required: true,
          unique: true,
          locked: true,
          description: "Stripe price ID",
        },
        productId: {
          type: "string",
          required: true,
          references: { entity: "product", field: "id" },
          description: "Reference to product",
        },
        amount: {
          type: "int",
          required: true,
          description: "Price amount in cents",
        },
        currency: {
          type: "string",
          required: true,
          description: "Currency code",
        },
        interval: {
          type: "string",
          required: false,
          description: "Billing interval (month, year) for subscriptions",
        },
        intervalCount: {
          type: "int",
          required: false,
          default: 1,
          description: "Number of intervals between billings",
        },
        active: {
          type: "boolean",
          required: false,
          default: true,
          description: "Is price active",
        },
      },
    },
    
    webhook: {
      description: "Processed webhook events",
      internal: true, // No public CRUD
      fields: {
        stripeEventId: {
          type: "string",
          required: true,
          unique: true,
          locked: true,
          description: "Stripe event ID (for deduplication)",
        },
        type: {
          type: "string",
          required: true,
          description: "Event type",
        },
        processed: {
          type: "boolean",
          required: false,
          default: true,
          description: "Whether event was processed",
        },
        error: {
          type: "text",
          required: false,
          description: "Error message if processing failed",
        },
      },
    },
  },
  
  // -------------------------------------------------------------------------
  // Fields added to user entity
  // -------------------------------------------------------------------------
  extend: {
    user: {
      stripeCustomerId: {
        type: "string",
        required: false,
        unique: true,
        description: "Stripe customer ID (convenience field)",
      },
      subscriptionStatus: {
        type: "string",
        required: false,
        description: "Current subscription status (denormalized for quick access)",
      },
      subscriptionPlan: {
        type: "string",
        required: false,
        description: "Current subscription plan name",
      },
    },
  },
}
