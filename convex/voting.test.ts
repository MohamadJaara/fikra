/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import {
  asUser,
  DOMAIN,
  initTest,
  insertUser,
  makeIdeaArgs,
  seedCategory,
} from "./testHelpers.test";

describe("Voting", () => {
  test("admins start voting and participants see only unshelved ideas", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);
    const adminId = await insertUser(t, {
      name: "Admin",
      email: `voting-admin@${DOMAIN}`,
      isAdmin: true,
    });
    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `voting-owner@${DOMAIN}`,
    });
    const voterId = await insertUser(t, {
      name: "Voter",
      email: `voting-voter@${DOMAIN}`,
    });

    const asOwner = asUser(t, ownerId, `voting-owner@${DOMAIN}`);
    const activeIdeaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      title: "Active Ballot Idea",
    });
    const shelvedIdeaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      title: "Shelved Ballot Idea",
    });

    const asAdmin = asUser(t, adminId, `voting-admin@${DOMAIN}`);
    const asVoter = asUser(t, voterId, `voting-voter@${DOMAIN}`);

    expect(await asVoter.query(api.voting.ballot, {})).toEqual([]);
    await asAdmin.mutation(api.admin.updateIdeaStatus, {
      ideaId: shelvedIdeaId,
      status: "shelved",
    });
    await asAdmin.mutation(api.voting.start, {});

    const ballot = await asVoter.query(api.voting.ballot, {});
    expect(ballot.map((idea) => idea._id)).toEqual([activeIdeaId]);
    expect(ballot[0]).toMatchObject({
      title: "Active Ballot Idea",
      userVoted: false,
    });
  });

  test("participants can toggle votes while only admins can see results", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);
    const adminId = await insertUser(t, {
      name: "Admin",
      email: `results-admin@${DOMAIN}`,
      isAdmin: true,
    });
    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `results-owner@${DOMAIN}`,
    });
    const voterId = await insertUser(t, {
      name: "Voter",
      email: `results-voter@${DOMAIN}`,
    });

    const ideaId = await asUser(
      t,
      ownerId,
      `results-owner@${DOMAIN}`,
    ).mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      title: "Vote Magnet",
    });
    const asAdmin = asUser(t, adminId, `results-admin@${DOMAIN}`);
    const asVoter = asUser(t, voterId, `results-voter@${DOMAIN}`);

    await expect(asVoter.query(api.voting.results, {})).rejects.toThrow(
      "Admin access required",
    );
    await expect(asVoter.mutation(api.voting.toggleVote, { ideaId })).rejects.toThrow(
      "Voting is not open",
    );

    await asAdmin.mutation(api.voting.start, {});
    await expect(
      asVoter.mutation(api.voting.toggleVote, { ideaId }),
    ).resolves.toMatchObject({ voted: true });

    const status = await asVoter.query(api.voting.status, {});
    expect(status.viewerVoteCount).toBe(1);
    const adminResults = await asAdmin.query(api.voting.results, {});
    expect(adminResults[0]).toMatchObject({
      title: "Vote Magnet",
      voteCount: 1,
    });

    await asVoter.mutation(api.voting.toggleVote, { ideaId });
    const updatedResults = await asAdmin.query(api.voting.results, {});
    expect(updatedResults[0].voteCount).toBe(0);
  });

  test("a new voting round does not reuse previous votes", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);
    const adminId = await insertUser(t, {
      name: "Admin",
      email: `round-admin@${DOMAIN}`,
      isAdmin: true,
    });
    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `round-owner@${DOMAIN}`,
    });
    const voterId = await insertUser(t, {
      name: "Voter",
      email: `round-voter@${DOMAIN}`,
    });

    const ideaId = await asUser(t, ownerId, `round-owner@${DOMAIN}`).mutation(
      api.ideas.create,
      {
        ...makeIdeaArgs(categoryId),
        title: "Fresh Round Idea",
      },
    );
    const asAdmin = asUser(t, adminId, `round-admin@${DOMAIN}`);
    const asVoter = asUser(t, voterId, `round-voter@${DOMAIN}`);

    await asAdmin.mutation(api.voting.start, {});
    await asVoter.mutation(api.voting.toggleVote, { ideaId });
    expect((await asAdmin.query(api.voting.adminOverview, {})).totalVotes).toBe(
      1,
    );

    await asAdmin.mutation(api.voting.stop, {});
    await asAdmin.mutation(api.voting.start, {});

    const overview = await asAdmin.query(api.voting.adminOverview, {});
    expect(overview.currentRound).toBe(2);
    expect(overview.totalVotes).toBe(0);
    expect((await asVoter.query(api.voting.status, {})).viewerVoteCount).toBe(
      0,
    );
  });

  test("active voting locks direct idea browsing and creation", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);
    const adminId = await insertUser(t, {
      name: "Admin",
      email: `lock-admin@${DOMAIN}`,
      isAdmin: true,
    });
    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `lock-owner@${DOMAIN}`,
    });
    const voterId = await insertUser(t, {
      name: "Voter",
      email: `lock-voter@${DOMAIN}`,
    });

    const asOwner = asUser(t, ownerId, `lock-owner@${DOMAIN}`);
    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      title: "Locked Idea",
    });
    await asUser(t, adminId, `lock-admin@${DOMAIN}`).mutation(
      api.voting.start,
      {},
    );

    const asVoter = asUser(t, voterId, `lock-voter@${DOMAIN}`);
    await expect(
      asVoter.mutation(api.ideas.create, {
        ...makeIdeaArgs(categoryId),
        title: "Late Idea",
      }),
    ).rejects.toThrow("Voting is active");
    await expect(
      asVoter.query(api.ideas.get, { ideaId }),
    ).rejects.toThrow("Voting is active");
    await expect(
      asVoter.query(api.ideas.list, {
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow("Voting is active");

    const ballot = await asVoter.query(api.voting.ballot, {});
    expect(ballot).toHaveLength(1);
    expect(ballot[0]).toMatchObject({ title: "Locked Idea" });
  });
});
