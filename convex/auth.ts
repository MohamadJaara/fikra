import Resend from "@auth/core/providers/resend";
import { convexAuth } from "@convex-dev/auth/server";
import { isEmailAllowed } from "./lib";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Resend],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const email = args.profile.email;
      if (!email || !isEmailAllowed(email)) {
        throw new Error("Access denied: email address is not allowed");
      }

      if (args.existingUserId) {
        const { emailVerified, ...profile } = args.profile;
        await ctx.db.patch(args.existingUserId, {
          ...(emailVerified ? { emailVerificationTime: Date.now() } : null),
          ...profile,
        });
        return args.existingUserId;
      }

      const { emailVerified, ...profile } = args.profile;
      return ctx.db.insert("users", {
        ...(emailVerified ? { emailVerificationTime: Date.now() } : null),
        ...profile,
      });
    },
  },
});
