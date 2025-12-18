// =============================================================================
// PAYMENTS PLUGIN
// Stripe-based payments and subscriptions plugin
// 
// Philosophy:
// - Stripe handles ALL payment logic
// - Zapi controls schema generation
// - Plugin provides routes and webhooks
// =============================================================================

import { definePlugin } from "../core/define.js"
import type { ZapiPlugin, PluginSchema, PluginExtension } from "../core/contract.js"
import type { Route, Middleware, ZapiInstance, ZapiRequest } from "../../types.js"
import type { PaymentsPluginOptions } from "./types.js"
import { paymentsSchema } from "./schema.js"

// -----------------------------------------------------------------------------
// Re-export types
// -----------------------------------------------------------------------------

export * from "./types.js"

// -----------------------------------------------------------------------------
// Payments Plugin Factory
// -----------------------------------------------------------------------------

export const payments = definePlugin<PaymentsPluginOptions>({
  meta: {
    id: "payments",
    name: "Payments",
    version: "1.0.0",
    description: "Stripe-based payments and subscriptions plugin",
    dependencies: ["auth"], // Requires auth plugin for user reference
  },
  
  defaults: {
    provider: "stripe",
    basePath: "/payments",
    subscriptions: true,
    oneTimePayments: true,
    currency: "usd",
  },
  
  validate: (options) => {
    const errors: string[] = []
    
    if (options.provider !== "stripe") {
      errors.push("Only 'stripe' provider is currently supported")
    }
    
    if (options.provider === "stripe" && !options.stripe?.secretKey) {
      errors.push("Stripe secret key is required")
    }
    
    return errors
  },
  
  factory: (options, extension) => {
    const basePath = options.basePath || "/payments"
    
    // Get or validate Stripe
    const stripeSecretKey = options.stripe?.secretKey || process.env.STRIPE_SECRET_KEY
    const stripeWebhookSecret = options.stripe?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET
    
    // Lazy load Stripe
    let stripeInstance: any = null
    const getStripe = () => {
      if (stripeInstance) return stripeInstance
      try {
        // Dynamic import would be: const Stripe = (await import('stripe')).default
        // For now, we just create a placeholder
        console.log("[Payments] Stripe initialized")
        stripeInstance = { secretKey: stripeSecretKey }
        return stripeInstance
      } catch {
        throw new Error("[Payments] Failed to initialize Stripe. Make sure 'stripe' package is installed.")
      }
    }
    
    return {
      schema: paymentsSchema,
      
      // -----------------------------------------------------------------------
      // Routes
      // -----------------------------------------------------------------------
      routes: ((zapi: ZapiInstance): Route[] => {
        const routes: Route[] = []
        
        // Create checkout session
        routes.push({
          method: "POST",
          path: `${basePath}/checkout`,
          handler: async (req: ZapiRequest) => {
            if (!req.user) {
              return { status: 401, body: { error: "Unauthorized" } }
            }
            
            const body = req.body as { priceId?: string; successUrl?: string; cancelUrl?: string }
            
            if (!body.priceId) {
              return { status: 400, body: { error: "priceId is required" } }
            }
            
            // TODO: Implement Stripe checkout session creation
            // const stripe = getStripe()
            // const session = await stripe.checkout.sessions.create(...)
            
            return {
              status: 200,
              body: {
                url: `https://checkout.stripe.com/placeholder`,
                sessionId: "placeholder_session_id",
              },
            }
          },
        })
        
        // Get customer portal URL
        routes.push({
          method: "POST",
          path: `${basePath}/portal`,
          handler: async (req: ZapiRequest) => {
            if (!req.user) {
              return { status: 401, body: { error: "Unauthorized" } }
            }
            
            // TODO: Implement Stripe customer portal
            
            return {
              status: 200,
              body: {
                url: `https://billing.stripe.com/placeholder`,
              },
            }
          },
        })
        
        // Get subscription status
        routes.push({
          method: "GET",
          path: `${basePath}/subscription`,
          handler: async (req: ZapiRequest) => {
            if (!req.user) {
              return { status: 401, body: { error: "Unauthorized" } }
            }
            
            // TODO: Fetch subscription from database
            
            return {
              status: 200,
              body: {
                status: "none",
                subscription: null,
              },
            }
          },
        })
        
        // Webhook handler
        routes.push({
          method: "POST",
          path: `${basePath}/webhook`,
          handler: async (req: ZapiRequest) => {
            const signature = req.headers["stripe-signature"]
            
            if (!signature) {
              return { status: 400, body: { error: "Missing signature" } }
            }
            
            // TODO: Verify webhook signature and process events
            // - customer.subscription.created
            // - customer.subscription.updated
            // - customer.subscription.deleted
            // - invoice.paid
            // - invoice.payment_failed
            
            return { status: 200, body: { received: true } }
          },
        })
        
        // List products
        routes.push({
          method: "GET",
          path: `${basePath}/products`,
          handler: async (req: ZapiRequest) => {
            // TODO: Fetch products from database
            
            return {
              status: 200,
              body: {
                products: [],
              },
            }
          },
        })
        
        // List prices
        routes.push({
          method: "GET",
          path: `${basePath}/prices`,
          handler: async (req: ZapiRequest) => {
            // TODO: Fetch prices from database
            
            return {
              status: 200,
              body: {
                prices: [],
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
          console.log(`[Payments] Plugin initialized`)
          console.log(`[Payments] Provider: ${options.provider}`)
          console.log(`[Payments] Routes: ${basePath}/*`)
          console.log(`[Payments] Subscriptions: ${options.subscriptions ? "enabled" : "disabled"}`)
          console.log(`[Payments] One-time payments: ${options.oneTimePayments ? "enabled" : "disabled"}`)
          console.log(`[Payments] Currency: ${options.currency}`)
        },
      },
    }
  },
})

// -----------------------------------------------------------------------------
// Default export
// -----------------------------------------------------------------------------

export default payments
