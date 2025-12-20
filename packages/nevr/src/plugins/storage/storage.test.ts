import { describe, it, expect } from "vitest"
import { storage } from "./index.js"
import { resolvePlugin } from "../core/resolver.js"

describe("Storage Plugin", () => {
  it("should create default configuration", () => {
    const instance = storage({
      provider: "local",
      local: { directory: "./uploads" }
    })
    
    expect(instance.meta.id).toBe("storage")
    expect(instance.options?.provider).toBe("local")
  })

  it("should validate required options", () => {
    expect(() => storage({ provider: "s3" } as any)).toThrow("S3 bucket is required")
    expect(() => storage({ provider: "local" } as any)).toThrow("Directory is required")
  })

  it("should generate correct schema", () => {
    const instance = storage({
      provider: "local",
      local: { directory: "./uploads" }
    })
    
    const resolved = resolvePlugin(instance)
    
    // Check entities
    const file = resolved.entities.find(e => e.name === "file")
    const folder = resolved.entities.find(e => e.name === "folder")
    
    expect(file).toBeDefined()
    expect(folder).toBeDefined()
    
    // Check fields
    expect(file?.config.fields.filename).toBeDefined()
    expect(file?.config.fields.mimeType).toBeDefined()
    expect(file?.config.fields.url).toBeDefined()
  })

  it("should allow extending schema", () => {
    const instance = storage({
      provider: "local",
      local: { directory: "./uploads" },
      extend: {
        entities: {
          file: {
            fields: {
              // Add a field to file
              tags: { add: { type: "json", required: false } }
            }
          }
        }
      }
    })
    
    const resolved = resolvePlugin(instance)
    const file = resolved.entities.find(e => e.name === "file")
    
    expect(file?.config.fields.tags).toBeDefined()
    expect(file?.config.fields.tags.type).toBe("json")
  })
})
