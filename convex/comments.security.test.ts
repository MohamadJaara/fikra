/// <reference types="vite/client" />
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import {
  initTest,
  insertUser,
  asUser,
  makeIdeaArgs,
  seedCategory,
  getCommentId,
  DOMAIN,
} from "./testHelpers";

describe("Comment authorization", () => {
  test("non-author cannot edit another user's comment", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const authorId = await insertUser(t, {
      name: "Author",
      email: `author@${DOMAIN}`,
    });
    const asAuthor = asUser(t, authorId, `author@${DOMAIN}`);

    const ideaId = await asAuthor.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    await asAuthor.mutation(api.comments.create, {
      ideaId,
      content: "Original comment",
    });

    const commentId = await getCommentId(t, ideaId);

    const otherId = await insertUser(t, {
      name: "Other",
      email: `commenter@${DOMAIN}`,
    });
    const asOther = asUser(t, otherId, `commenter@${DOMAIN}`);

    await expect(
      asOther.mutation(api.comments.update, {
        commentId,
        content: "Hacked!",
      }),
    ).rejects.toThrow("Can only edit your own comments");
  });

  test("idea owner can delete any comment on their idea", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `ownerc@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `ownerc@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    const commenterId = await insertUser(t, {
      name: "Commenter",
      email: `commenter2@${DOMAIN}`,
    });
    const asCommenter = asUser(t, commenterId, `commenter2@${DOMAIN}`);

    await asCommenter.mutation(api.memberships.join, { ideaId });

    await asCommenter.mutation(api.comments.create, {
      ideaId,
      content: "A comment",
    });

    const commentId = await getCommentId(t, ideaId);

    await expect(
      asOwner.mutation(api.comments.remove, { commentId }),
    ).resolves.toBeDefined();
  });

  test("non-author non-owner cannot delete a comment", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `ownerc2@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `ownerc2@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    const commenterId = await insertUser(t, {
      name: "Commenter",
      email: `commenter3@${DOMAIN}`,
    });
    const asCommenter = asUser(t, commenterId, `commenter3@${DOMAIN}`);

    await asCommenter.mutation(api.memberships.join, { ideaId });

    await asCommenter.mutation(api.comments.create, {
      ideaId,
      content: "Comment",
    });

    const commentId = await getCommentId(t, ideaId);

    const randoId = await insertUser(t, {
      name: "Rando",
      email: `rando@${DOMAIN}`,
    });
    const asRando = asUser(t, randoId, `rando@${DOMAIN}`);

    await expect(
      asRando.mutation(api.comments.remove, { commentId }),
    ).rejects.toThrow("Can only delete your own comments");
  });
});
