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
    participationMode: v.optional(v.string()),
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
  categories: defineTable({
    name: v.string(),
    slug: v.string(),
  })
    .index("by_slug", ["slug"])
    .searchIndex("search_name", { searchField: "name" }),

  resources: defineTable({
    name: v.string(),
    slug: v.string(),
  })
    .index("by_slug", ["slug"])
    .searchIndex("search_name", { searchField: "name" }),

  roles: defineTable({
    name: v.string(),
    slug: v.string(),
    aliasSlugs: v.optional(v.array(v.string())),
    deletedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .searchIndex("search_name", { searchField: "name" }),

  rooms: defineTable({
    name: v.string(),
    type: v.string(),
  })
    .index("by_type", ["type"])
    .searchIndex("search_name", { searchField: "name" }),

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
    categoryId: v.optional(v.id("categories")),
    roomId: v.optional(v.id("rooms")),
    onsiteOnly: v.optional(v.boolean()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_status", ["status"])
    .index("by_category", ["categoryId"])
    .index("by_room", ["roomId"])
    .searchIndex("search_title", { searchField: "title" }),

  ideaMembers: defineTable({
    ideaId: v.id("ideas"),
    userId: v.id("users"),
    role: v.optional(v.string()),
    memberRoles: v.optional(v.array(v.string())),
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
    .index("by_tag", ["tag"])
    .index("by_resolved", ["resolved"]),

  ownershipTransferRequests: defineTable({
    ideaId: v.id("ideas"),
    requesterId: v.id("users"),
    recipientId: v.id("users"),
    leaveAfterTransfer: v.boolean(),
    status: v.string(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_idea", ["ideaId"])
    .index("by_idea_and_status", ["ideaId", "status"])
    .index("by_recipient_and_status", ["recipientId", "status"])
    .index("by_requester_and_status", ["requesterId", "status"]),

  relatedIdeas: defineTable({
    ideaIdA: v.id("ideas"),
    ideaIdB: v.id("ideas"),
    markedByUserId: v.id("users"),
    relationType: v.string(),
    mergeRequestedById: v.optional(v.id("users")),
    mergeStatus: v.optional(v.string()),
  })
    .index("by_ideaA", ["ideaIdA"])
    .index("by_ideaB", ["ideaIdB"])
    .index("by_ideaA_and_type", ["ideaIdA", "relationType"])
    .index("by_ideaB_and_type", ["ideaIdB", "relationType"])
    .index("by_merge_status", ["mergeStatus"]),

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
