// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IdeaStatusBadge, IdeaStatusDot, IdeaStatusLabel } from "./IdeaStatus";

describe("idea status fallbacks", () => {
  it.each(["future_status", "constructor", "toString"])(
    "keeps unknown status %s readable with a neutral badge and dot",
    (status) => {
      const badge = renderToStaticMarkup(<IdeaStatusBadge status={status} />);
      expect(badge).toContain(`>${status}</div>`);
      expect(badge).toContain("bg-muted");
      expect(renderToStaticMarkup(<IdeaStatusLabel status={status} />)).toBe(
        status,
      );
      const dot = renderToStaticMarkup(<IdeaStatusDot status={status} />);
      expect(dot).toContain(`aria-label="${status}"`);
      expect(dot).toContain("bg-zinc-400");
    },
  );

  it("keeps the chosen badge variant for an unknown status", () => {
    const badge = renderToStaticMarkup(
      <IdeaStatusBadge status="future_status" variant="default" />,
    );
    expect(badge).toContain("bg-primary");
    expect(badge).not.toContain("bg-muted");
  });
});

describe("status dot accessibility", () => {
  it("names a standalone dot and hides a dot accompanied by text", () => {
    const standalone = renderToStaticMarkup(
      <IdeaStatusDot status="forming_team" />,
    );
    expect(standalone).toContain('role="img"');
    expect(standalone).toContain('aria-label="Forming Team"');

    const decorative = renderToStaticMarkup(
      <IdeaStatusDot status="forming_team" decorative />,
    );
    expect(decorative).toContain('aria-hidden="true"');
    expect(decorative).not.toContain("aria-label");
    expect(decorative).not.toContain("role=");
  });
});
