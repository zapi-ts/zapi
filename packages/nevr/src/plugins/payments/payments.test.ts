import { describe, it, expect, beforeEach } from "vitest"
import { payments } from "./index.js"
import { resolvePlugin } from "../core/resolver.js"

describe("Payments Plugin", () => {
  it("should create default configuration", () => {
    const instance = payments({
      stripe: { secretKey: "sk_test_123" }
    })
    
    expect(instance.meta.id).toBe("payments")
    expect(instance.options?.provider).toBe("stripe")
    expect(instance.options?.currency).toBe("usd")
  })

  it("should validate required options", () => {
    expect(() => payments({} as any)).toThrow("Stripe secret key is required")
  })

  it("should generate correct schema", () => {
    const instance = payments({
      stripe: { secretKey: "sk_test_123" }
    })
    
    const resolved = resolvePlugin(instance)
    
    // Check entities
    const customer = resolved.entities.find(e => e.name === "customer")
    const subscription = resolved.entities.find(e => e.name === "subscription")
    const payment = resolved.entities.find(e => e.name === "payment")
    
    expect(customer).toBeDefined()
    expect(subscription).toBeDefined()
    expect(payment).toBeDefined()
    
    // Check fields
    expect(customer?.config.fields.stripeCustomerId).toBeDefined()
    expect(subscription?.config.fields.status).toBeDefined()
  })

  it("should allow extending schema", () => {
    const instance = payments({
      stripe: { secretKey: "sk_test_123" },
      extend: {
        entities: {
          customer: {
            fields: {
              // Add a field to customer
              notes: { add: { type: "text", required: false } }
            }
          }
        }
      }
    })
    
    const resolved = resolvePlugin(instance)
    const customer = resolved.entities.find(e => e.name === "customer")
    
    expect(customer?.config.fields.notes).toBeDefined()
    expect(customer?.config.fields.notes.type).toBe("text")
  })
})
