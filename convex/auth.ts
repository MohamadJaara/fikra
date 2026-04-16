import Resend from "@auth/core/providers/resend";
import { convexAuth } from "@convex-dev/auth/server";
import { getUserDisplayName, isEmailAllowed } from "./lib";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Resend({
      from: process.env.AUTH_RESEND_FROM ?? "onboarding@resend.dev",
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const email = args.profile.email;
      if (!email || !isEmailAllowed(email)) {
        throw new Error("Access denied: email address is not allowed");
      }

      const existingUser = args.existingUserId
        ? await ctx.db.get(args.existingUserId)
        : null;

      const normalizedName =
        args.profile.name?.trim() ||
        getUserDisplayName(existingUser, "").trim();

      const safeProfile = {
        email,
        ...(normalizedName ? { name: normalizedName } : {}),
        ...(args.profile.image ? { image: args.profile.image } : {}),
        ...(args.profile.emailVerified
          ? { emailVerificationTime: Date.now() }
          : {}),
      };

      if (args.existingUserId) {
        await ctx.db.patch(args.existingUserId, safeProfile);
        return args.existingUserId;
      }

      return ctx.db.insert("users", safeProfile);
    },
  },
});
