import { internal } from "./_generated/api.js";
import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api.js";
import { DataModel } from "./_generated/dataModel.js";
import { generateUniqueHandle, mergeUniqueStringArrays } from "./lib.js";

export const migrations = new Migrations<DataModel>(components.migrations);

export const backfillMemberRoles = migrations.define({
  table: "ideaMembers",
  migrateOne: async (ctx, doc) => {
    if (doc.role === undefined) return;
    await ctx.db.patch(doc._id, {
      memberRoles: mergeUniqueStringArrays(doc.memberRoles, [doc.role]),
      role: undefined,
    });
  },
});

export const backfillHandles = migrations.define({
  table: "users",
  migrateOne: async (ctx, user) => {
    if (user.handle !== undefined) return;
    if (!user.email) return;
    const handle = await generateUniqueHandle(ctx, user.email, user._id);
    if (handle) {
      await ctx.db.patch(user._id, { handle });
    }
  },
});

export const backfillTeamSize = migrations.define({
  table: "ideas",
  migrateOne: async (ctx, idea) => {
    if (idea.teamSize !== undefined) return;
    const legacy = idea.teamSizeWanted ?? 3;
    const teamSize: "solo" | "small" | "medium" | "large" =
      legacy <= 1
        ? "solo"
        : legacy <= 3
          ? "small"
          : legacy <= 6
            ? "medium"
            : "large";
    await ctx.db.patch(idea._id, { teamSize, teamSizeWanted: undefined });
  },
});

// Not wired to a cron or HTTP endpoint. Run manually:
//   npx convex run migrations:runAll
export const runAll = migrations.runner([
  internal.migrations.backfillMemberRoles,
  internal.migrations.backfillHandles,
  internal.migrations.backfillTeamSize,
]);
