# Idea status and participation displays

`components/IdeaStatus.tsx` provides `IdeaStatusBadge`, `IdeaStatusDot`, and
`IdeaStatusLabel`. They accept the string values returned by the existing backend
types. Known statuses use `lib/constants.ts`; unknown statuses display their raw
value, with a neutral dot and the badge's existing variant fallback. Use
`colored={false}` for the existing neutral badges in navigation, related ideas,
and voting. Dots have an accessible name by default; use `decorative` when the
status is already visible as text.

`components/ParticipationDisplay.tsx` provides `ParticipationBadge` and
`ParticipationIndicator`. Both hide missing or unknown modes. Badges use the
existing participation labels and colors. Indicators show a named icon by
default, or visible text with `showLabel`. Size and spacing can be adjusted using
`className` and `iconClassName` for compact displays.

The interactive `ParticipationModePicker` keeps its existing input behavior.
Hackathon lifecycle, team formation, room requests, and merge statuses remain
separate domains. The detail page's status stripe, masonry borders, activity
accent text, admin summary counts, and filter options retain their specialized
presentation using constants. People currently displays role badges only.

## Follow-up integration

These files belong to parallel refactors and were intentionally left unchanged:

- `components/idea-detail/TeamSection.tsx`: replace the member's guarded
  participation badge with `ParticipationBadge`, preserving
  `className="text-[10px] px-1.5 py-0"` and
  `iconClassName="h-2.5 w-2.5 mr-0.5"`. Keep the on-site eligibility warning and
  join behavior intact.
- `app/product/admin/ideas/page.tsx`: use `IdeaStatusBadge` only for passive
  status badges and `ParticipationIndicator` for passive on-site text. Keep
  status selectors and on-site switches interactive. Exported text and filter
  labels should continue to use constants.
- `components/IdeaForm.tsx`, `app/product/onboarding/page.tsx`,
  `app/product/settings/page.tsx`, and `lib/hooks.ts`: no passive status or
  participation badge migration is needed in the inspected versions. Keep form
  controls and the participation picker intact.
