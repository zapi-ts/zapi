// =============================================================================
// PAYMENTS PLUGIN TYPES
// =============================================================================

import type { PluginExtension } from "../core/contract.js"

// -----------------------------------------------------------------------------
// Stripe Configuration
// -----------------------------------------------------------------------------

export interface StripeConfig {
  /** Stripe secret key */
  secretKey: string
  /** Stripe publishable key (optional, for client) */
  publishableKey?: string
  /** Stripe webhook secret */
  webhookSecret?: string
}

// -----------------------------------------------------------------------------
// Main Plugin Options
// -----------------------------------------------------------------------------

export interface PaymentsPluginOptions {
  /**
   * Payment provider
   * Currently only Stripe is supported
   */
  provider: "stripe"
  
  /**
   * Stripe configuration
   */
  stripe?: StripeConfig
  
  /**
   * Base path for payment routes
   * Default: "/payments"
   */
  basePath?: string
  
  /**
   * Enable subscription support
   * Default: true
   */
  subscriptions?: boolean
  
  /**
   * Enable one-time payments
   * Default: true
   */
  oneTimePayments?: boolean
  
  /**
   * Currency code
   * Default: "usd"
   */
  currency?: string
  
  /**
   * Plugin extension
   */
  extend?: PluginExtension
}

// -----------------------------------------------------------------------------
// Payment Entities
// -----------------------------------------------------------------------------

export interface Customer {
  id: string
  userId: string
  stripeCustomerId: string
  email: string
  createdAt: Date
  updatedAt: Date
}

export interface Subscription {
  id: string
  customerId: string
  stripeSubscriptionId: string
  status: "active" | "canceled" | "past_due" | "trialing" | "unpaid"
  priceId: string
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Payment {
  id: string
  customerId: string
  stripePaymentIntentId: string
  amount: number
  currency: string
  status: "pending" | "succeeded" | "failed" | "refunded"
  createdAt: Date
  updatedAt: Date
}

export interface Price {
  id: string
  stripePriceId: string
  productId: string
  amount: number
  currency: string
  interval?: "month" | "year"
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Product {
  id: string
  stripeProductId: string
  name: string
  description?: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}
