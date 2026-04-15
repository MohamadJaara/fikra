import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    roles: v.optional(v.array(v.string())),
    onboardingComplete: v.optional(v.boolean()),
    handle: v.optional(v.string()),
    isAdmin: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("handle", ["handle"])
    .index("by_onboardingComplete", ["onboardingComplete"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["onboardingComplete"],
    })
    .searchIndex("search_handle", {
      searchField: "handle",
      filterFields: ["onboardingComplete"],
    }),
  ideas: defineTable({
    title: v.string(),
    pitch: v.string(),
    problem: v.string(),
    targetAudience: v.string(),
    skillsNeeded: v.array(v.string()),
    teamSizeWanted: v.number(),
    status: v.string(),
    lookingForRoles: v.array(v.string()),
    ownerId: v.id("users"),
  })
    .index("by_owner", ["ownerId"])
    .index("by_status", ["status"]),

  ideaMembers: defineTable({
    ideaId: v.id("ideas"),
    userId: v.id("users"),
    role: v.optional(v.string()),
  })
    .index("by_idea", ["ideaId"])
    .index("by_user", ["userId"])
    .index("by_idea_and_user", ["ideaId", "userId"]),

  ideaInterest: defineTable({
    ideaId: v.id("ideas"),
    userId: v.id("users"),
  })
    .index("by_idea", ["ideaId"])
    .index("by_user", ["userId"])
    .index("by_idea_and_user", ["ideaId", "userId"]),

  comments: defineTable({
    ideaId: v.id("ideas"),
    userId: v.id("users"),
    content: v.string(),
    parentId: v.optional(v.id("comments")),
    mentionedUserIds: v.optional(v.array(v.id("users"))),
  })
    .index("by_idea", ["ideaId"])
    .index("by_parent", ["parentId"]),

  reactions: defineTable({
    ideaId: v.id("ideas"),
    userId: v.id("users"),
    type: v.string(),
  })
    .index("by_idea", ["ideaId"])
    .index("by_idea_and_user", ["ideaId", "userId"]),

  resourceRequests: defineTable({
    ideaId: v.id("ideas"),
    tag: v.string(),
    notes: v.optional(v.string()),
    resolved: v.boolean(),
  })
    .index("by_idea", ["ideaId"])
    .index("by_resolved", ["resolved"]),

  notifications: defineTable({
    recipientId: v.id("users"),
    actorId: v.id("users"),
    ideaId: v.id("ideas"),
    type: v.string(),
    read: v.boolean(),
    commentId: v.optional(v.id("comments")),
  })
    .index("by_recipient", ["recipientId"])
    .index("by_recipient_and_read", ["recipientId", "read"])
    .index("by_idea", ["ideaId"]),
});
