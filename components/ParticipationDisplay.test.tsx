// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ParticipationBadge,
  ParticipationIndicator,
} from "./ParticipationDisplay";

describe("participation display", () => {
  it.each([undefined, "", "future_mode", "constructor", "toString"])(
    "hides missing or unknown mode %s without implying a preference",
    (mode) => {
      expect(renderToStaticMarkup(<ParticipationBadge mode={mode} />)).toBe("");
      expect(renderToStaticMarkup(<ParticipationIndicator mode={mode} />)).toBe(
        "",
      );
    },
  );

  it.each([
    ["onsite", "On-site"],
    ["remote", "Remote"],
  ])("gives the %s icon an accessible name", (mode, label) => {
    const indicator = renderToStaticMarkup(
      <ParticipationIndicator mode={mode} />,
    );
    expect(indicator).toContain('role="img"');
    expect(indicator).toContain(`aria-label="${label}"`);
    expect(indicator).toContain(`title="${label}"`);
    expect(indicator).toContain('aria-hidden="true"');
  });

  it("uses visible text for labeled indicators and badges", () => {
    const indicator = renderToStaticMarkup(
      <ParticipationIndicator mode="onsite" showLabel />,
    );
    const badge = renderToStaticMarkup(<ParticipationBadge mode="onsite" />);
    expect(indicator).toContain("On-site</span>");
    expect(badge).toContain("On-site</div>");
    for (const markup of [indicator, badge]) {
      expect(markup).not.toContain("aria-label");
      expect(markup).toContain('aria-hidden="true"');
    }
  });
});
