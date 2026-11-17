# Culinary Craft — UI/UX redesign

## Scope and direction

The redesign builds on the existing React/Spring application and the initial source
audit. The owner explicitly requested a complete UI/UX pass, including administrative
workflows, rather than the initially suggested visual polish.

Method: **unslop by Damir Sokolovsky (@heydamir), CC BY 4.0**.
Skill source: https://github.com/heydamir/unslop/tree/main/skills/unslop.
This audit and its application follow that method; the product identity is Culinary Craft.

- **Product:** a personal recipe book and a community for home cooks.
- **Character:** warm, assured, thoughtful.
- **World:** a culinary publication and a working home kitchen.
- **Moments:** food photography and readable, numbered cooking instructions.
- **Signature:** recipe-book numbering and fine rules, reused in the editor and recipe.

The public interface uses editorial headings and photographs. The administration
workspace uses neutral surfaces, compact navigation and structured tables. The
existing green accent remains. No paid services or generated images were used.

## Audit: observed signs and locations

Baseline screenshots were captured in Chromium at 1280, 768 and 375 px before edits.
The audit covered catalog, recipe, editor, profile, settings, authentication,
verification, reports, moderation and administration.

- Catalog hero: a sticker, stars, floating card and decorative statistics compete with food.
- Catalog hero: “100% inspiration” and “infinite ideas” have no measurable product meaning.
- Catalog hero: the headline and several subheadings do not describe a concrete task.
- Catalog categories and empty states: emoji mixed with Lucide icons.
- Recipe, editor and profile: decorative emoji and old demo-account instructions.
- Styles: many weights from 700 to 900; small labels often 10–11 px.
- Styles: uppercase tracked labels compete with page titles.
- Styles: arbitrary 19/21/27/35 px spacing; cards and controls use inconsistent padding.
- Styles: tinted shadows and gradient image fallbacks add color to interface chrome.
- Cards: lift by 5 px and image zoom on hover; controls use `transition: all`.
- Header: redundant administrative links and “My reports” crowd the primary navigation.
- Header: avatar opens the login form rather than account navigation; tooltip refers to demos.
- Mobile header: a horizontal nav hides links beyond the visible area.
- Reports: inline form interrupts the recipe, with no dedicated review context.
- Administration: cards obscure the relationship between records and their fields.
- Administration: default filters and empty lists leave large gaps; pagination has no total or size choice.
- Administration: technical audit codes appear directly in the UI.
- Settings: verification link is shown even for an already verified account.
- Verification: registration and email changes automatically issue mail; success requires manual refresh.
- Images: external photographs are unreliable; the historical lemonade URL returns 404.

## Nine passes

1. **Spacing:** common 4 px rhythm, consistent page padding, grouped fields and sections,
   dense administrative navigation, aligned table cells and action areas.
2. **Color:** neutral light surfaces, three text roles, one green action accent;
   semantic colors retained for statuses and destructive operations. No hue gradients.
3. **Icons:** Lucide with a shared 18 px/1.5 stroke default; decorative emoji removed
   from visible UI. Existing recipe emoji metadata remains compatible with the API.
4. **Copy:** specific task labels, Russian audit names, explicit email steps and
   operation-specific confirmations; obsolete demo references removed from screens.
5. **Type:** Manrope 400/500/600 for controls and body; Georgia for editorial headings;
   readable captions and tabular numbers; no tracked uppercase decoration.
6. **Layout:** simplified header, mobile menu, asymmetric recipe hero, real quick-recipe
   collection, administration sidebar, stable tables, structured editor and account pages.
7. **Details:** reusable dialog/confirmation/table/pagination/status components;
   account keyboard navigation, focus return, internal table scrolling, empty/error states.
8. **Visuals:** eight original seed photographs bundled as local WebP assets; user
   media continues through the original media API. No invented recipe data or substitute
   photographs for missing user uploads.
9. **Motion:** no card lift, image zoom, decorative loops or catch-all transitions;
   short control color changes and `prefers-reduced-motion` support.

## Functional decisions

- Account menu supports click, arrows, Home/End, Escape, outside click and logout.
  Cookie/CSRF and server session revocation are preserved.
- Personal reports are absent from primary navigation and profile; `/reports` and
  its existing private API remain available.
- Recipe complaints open a native modal dialog. Reason is required; description is
  optional, 10–1000 characters when supplied. Active duplicates and rate limits remain
  server enforced; internal comments are never returned to the reporter.
- Reports, users and audit use database pagination with 10/20/50 rows and totals.
  Reports and users support whitelisted server sorting. Users support role/status
  filters; audit remains newest first with event filters and detail dialogs.
- Report review includes current recipe metadata, reporter, description, status and
  internal notes. Closing/rejecting a report requires confirmation. User access and
  recipe publication are separate operations.
- Published recipes can return to `PENDING` through an ADMIN-only operation with a
  reason and an audit event. Ordinary pending moderation is unchanged; unpublishing
  never deletes the recipe or its content.
- Registration, login, email change, page opening and reload never send verification
  mail. Only the explicit request button does. Server throttling and one-use hashed
  tokens remain unchanged. The UI persists its resend timer per address/purpose.
- Confirmation refreshes `/auth/me` before navigating to profile. Already verified
  accounts are redirected from both verification screens. Backend verification remains
  authoritative even if React state is manipulated.
- Native `dialog` provides modal focus containment. Destructive actions use reusable
  confirmations; backdrop dismissal and Escape respect in-flight requests.

## Verification and artifacts

Run the commands documented in README. Backend integration tests use Testcontainers;
browser tests require a fresh isolated PostgreSQL database and local Mailpit.
The redesign does not alter CI configuration or coverage thresholds.

- Source images and provenance: `frontend/public/images/recipes/README.md`.
- Original screenshots: `reports/ui/before-*.png`.
- Final screenshots: `frontend/test-results/redesign-*/after-*.png`.
- Comparison artifacts and validation logs: `reports/ui/`.
- Tests: `frontend/tests/e2e/redesign.spec.js`, existing user journeys, component
  tests alongside pages/components, `AccountEmailTest`, `AdministrationApiTest`.
- Full changed-file inventory: [ui-redesign-files.txt](ui-redesign-files.txt).

The automated layout check covers 375, 768, 1280 and 1920 px, and the screenshots
are visually inspected. This is not a formal WCAG certification or a cross-browser
Safari/Firefox audit. Existing personal recipe lists and the pending queue retain
their previous unpaginated backend contracts. External user image URLs can still fail;
missing images use a neutral fallback. SMTP delivery still has its documented
post-commit failure window; there is no plaintext-token outbox.

Validated on 17 November 2026:

- ESLint: passed, zero warnings.
- Vitest with coverage: 72 tests passed; line coverage 85.38%, thresholds unchanged.
- Vite production build: passed.
- Gradle `check bootJar`: passed; 73 backend tests, zero failures; Checkstyle and
  JaCoCo verification passed.
- Playwright with real isolated PostgreSQL/Mailpit: 12 scenarios passed.
- 59 final viewport screenshots captured; no page overflow at the four requested
  widths, no JavaScript runtime errors during the visual test.
- Modal review and account-menu screenshots accompany the viewport set. Browser
  tests check focus containment, Escape and restoration of focus to the opener,
  including React StrictMode's repeated effect setup/cleanup.
- `reports/ui/comparison.html` provides before/after comparisons; final images are
  also copied into `reports/ui/after/` so later test runs do not overwrite them.
