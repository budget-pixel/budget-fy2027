# Accessibility Verification Checklist

Date: June 27, 2026

## Scope

Browser verification was run against the local static site at:

```text
http://127.0.0.1:8765/
```

No financial logic, Supabase logic, or hidden/admin-only dark mode styles were changed as part of this verification pass.

## Local Tooling Inventory

- `package.json`: present
- `package-lock.json`: present
- `node_modules`: present
- Local Playwright dependency: present
- Chromium browser binary: present
- Lighthouse dependency/config: not present
- axe dependency/config: not present
- Shell `node`: available, `v24.18.0`
- Shell `npm`: available, `11.16.0`
- Shell `npx`: available

Note: Chromium launch required unsandboxed command execution in this environment because sandboxed launch failed with a macOS Mach port permission error.

## Local Server Checks

A static server was already running at:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

The following pages loaded with HTTP `200` in Chromium:

- Home page: `/index.html`
- Accessibility page: `/pages/accessibility.html`
- Financial forecast page: `/pages/financial-forecast.html`
- Fund financial schedule page: `/pages/fund-financial-schedules.html`
- Department page: `/pages/departments.html`

## Browser Console Checks

No browser console errors, page errors, or failed local asset requests were detected on:

- `/index.html`
- `/pages/accessibility.html`
- `/pages/financial-forecast.html`
- `/pages/fund-financial-schedules.html`
- `/pages/departments.html`

## Accessibility Page

- `/pages/accessibility.html` loaded successfully.
- The page has exactly one `<h1>`.
- The page has one `#main-content` target.
- No duplicate `#main-content` target was detected.
- Footer renders once.
- Footer Accessibility link renders once.

## Footer Accessibility Link

Footer Accessibility link was present once and resolved correctly from:

- Home page: `pages/accessibility.html`
- Accessibility page: `accessibility.html`
- Financial forecast page: `accessibility.html`
- Fund financial schedule page: `accessibility.html`
- Department page: `accessibility.html`

## Skip Link

The skip link was verified by keyboard on all tested pages.

- The first Tab focused `Skip to main content`.
- The skip link became visible on focus.
- Pressing Enter moved the URL hash to `#main-content`.
- Focus moved to the main content target:
  - Home page: `<main id="main-content">`
  - Shared pages: injected `<span id="main-content" tabindex="-1">`

## Keyboard Tab Order Smoke Test

Keyboard Tab order was smoke-tested after using the skip link on:

- Home page
- Accessibility page
- Financial forecast page
- Fund financial schedule page
- Department page

Observed focus moved through expected interactive controls such as section links, project cards, footer controls, forecast detail toggles, forecast sort buttons, fund schedule toggles, and department directory links.

## Tables

Financial forecast page:

- Rendered 20 tables.
- Rendered 20 screen-reader-only table captions.
- First table header alignment checked:
  - `Line`
  - `FY 2027 Baseline`
  - `FY 2028 Forecast`
  - `FY 2029 Forecast`
  - `FY 2030 Forecast`
- First table contained 6 headers and 5 body rows.

Fund financial schedule page:

- Rendered 102 tables.
- First table contained headers and body rows.
- First table header alignment checked:
  - `ROW LABELS`
  - `FY 2020 ACTUAL`
  - `FY 2021 ACTUAL`
  - `FY 2022 ACTUAL`
  - `FY 2023 ACTUAL`
- Detected 118 interactive/clickable table controls or values.

## Expandable Table / Detail Interaction

Financial forecast page:

- First `Category Forecast Detail` summary was keyboard-focused.
- Pressing Enter opened the detail section.

Fund financial schedule page:

- Detected 32 fund activity toggle rows.
- First `Revenues` row was keyboard-focused.
- Pressing Enter changed `aria-expanded` from `false` to `true`.
- No console errors fired during the interaction.

## Financial Forecast Render

The financial forecast page rendered successfully.

- Major fund cards rendered: 6
- Forecast tables rendered inside `#financial-forecast`: 20
- Forecast text included FY 2027 baseline through FY 2031 forecast values.

## Items Not Run

- Lighthouse accessibility audit was not run because Lighthouse is not installed in the repo and was not approved to be added.
- axe audit was not run because axe is not installed in the repo and was not approved to be added.

## Second Browser Verification Pass

Date: June 27, 2026

### Pages Tested

- `/index.html`
- `/pages/accessibility.html`
- `/pages/financial-forecast.html`
- `/pages/fund-financial-schedules.html`
- `/pages/departments.html`
- `/pages/building-construction-and-maintenance.html`
- `/pages/transactions.html` through a public actual-amount drilldown link

### Viewports Tested

- Desktop: `1280 x 900`
- Mobile/narrow: `375 x 812`
- 200% zoom equivalent: `640 x 900`

### Modal / Transaction Interaction Result

Test page:

- `/pages/building-construction-and-maintenance.html`

Budget Lines modal:

- `View Budget Lines` button was keyboard reachable.
- Pressing Enter opened the Budget Lines modal.
- Focus moved into the modal and landed on the close button.
- Close button was keyboard reachable.
- Close button accessible name: `Close budget detail`.
- Escape closed the modal.
- Focus returned to the triggering `View Budget Lines` button.
- No console errors occurred.

Transaction drilldown:

- After enabling prior years in the Budget Lines modal, visible actual-amount links were keyboard reachable.
- First tested actual link text: `$1,520,912`.
- Accessible name after fix: `View FY 2020 Actual transaction detail for Regular Salaries & Wages actual amount $1,520,912`.
- Pressing Enter opened `/pages/transactions.html`.
- Pressing Space also opened `/pages/transactions.html` after the narrow key activation fix.
- Transaction page loaded with heading `Transactions for Regular Salaries & Wages — 512000`.
- No console errors occurred during the tested interaction.

### Mobile Menu Result

Home page mobile menu:

- Tested at `375 x 812`.
- Menu button was keyboard reachable.
- Menu button accessible name: `Open navigation menu`.
- Pressing Enter changed `aria-expanded` from `false` to `true`.
- Menu links were keyboard reachable.
- Escape changed `aria-expanded` back to `false` after the narrow Escape-close fix.
- Focus remained on the menu button after Escape.
- No console errors occurred.

Shared page mobile menu:

- Tested on `/pages/financial-forecast.html` at `375 x 812`.
- Menu button was keyboard reachable.
- Menu button accessible name: `Open navigation menu`.
- Pressing Enter changed `aria-expanded` from `false` to `true`.
- Menu links and following page controls were keyboard reachable.
- Escape changed `aria-expanded` back to `false` after the narrow Escape-close fix.
- Focus remained on the menu button after Escape.
- No console errors occurred.

### 200% Zoom Result

Viewport used as a 200% zoom equivalent:

- `640 x 900`

Pages checked:

- `/index.html`
- `/pages/accessibility.html`
- `/pages/financial-forecast.html`
- `/pages/fund-financial-schedules.html`

Results:

- Skip link remained visible on focus.
- Footer remained reachable.
- No page-level horizontal scrolling was detected.
- Financial Forecast used intentional table scroll areas.
- Fund Financial Schedule used intentional table scroll areas.
- Fresh-page rerun confirmed no console errors on the Accessibility page or Financial Forecast page.

### Narrow Viewport Result

Viewport:

- `375 x 812`

Pages checked:

- `/index.html`
- `/pages/accessibility.html`
- `/pages/financial-forecast.html`
- `/pages/fund-financial-schedules.html`

Results:

- Skip link remained visible on focus.
- Footer remained reachable.
- No page-level horizontal scrolling was detected.
- Financial Forecast tables remained inside intentional horizontal table scroll regions.
- Fund Financial Schedule tables remained inside intentional horizontal table scroll regions.
- Buttons and links tested in the mobile menu remained keyboard reachable.

### Chart / Data-Equivalent Result

Financial Forecast:

- Rendered 6 major fund forecast sections.
- Rendered 20 forecast tables.
- No visual-only forecast chart was detected in this pass.
- Forecast values shown visually are available in tables.
- Forecast tables include FY 2027 baseline through FY 2031 forecast values.
- Tooltips or chart-only interactions were not the only place key forecast values appeared.

### Issues Found

- Actual-amount transaction drilldown links had a weak accessible name because the link text was only the formatted dollar amount.
- Space key did not activate transaction drilldown links.
- Mobile menu Escape behavior was not implemented for the home page or shared page menu.

### Fixes Made

- Added descriptive `aria-label` text to actual-amount transaction drilldown links in `assets/budget-data.js`.
- Added Space key activation for `.wc-actual-drilldown-link` in `assets/budget-data.js`.
- Added Escape-to-close behavior for the shared mobile menu in `assets/walton-budget-nav.js`.
- Added Escape-to-close behavior for the custom home page mobile menu in `index.html`.
- Bumped `budget-data.js` cache keys to `20260627-a11y-drilldown-labels`.
- Bumped `walton-budget-nav.js` cache keys to `20260627-accessibility-menu`.

### Items Still Pending

- A full WCAG/ADA compliance claim has not been made.
- A complete manual screen reader pass has not been run.
- A complete page-by-page keyboard audit across every public page has not been run.

## Lighthouse Accessibility Audit

Date: June 27, 2026

Lighthouse was run as an automated accessibility check only against the local site at:

```text
http://127.0.0.1:8765/
```

Lighthouse does not establish full ADA or WCAG compliance. Scores below reflect only the automated Lighthouse accessibility category for the tested pages.

### Pages Audited

Initial audited pages:

- `/`
- `/pages/accessibility.html`
- `/pages/financial-forecast.html`
- `/pages/fund-financial-schedules.html`
- `/pages/departments.html`

Initial scores and issues:

| Page | Initial Score | Lighthouse Issues |
| --- | ---: | --- |
| `/` | 96 | Footer utility links failed `color-contrast`. |
| `/pages/accessibility.html` | 96 | Footer utility links failed `color-contrast`; logo link failed `label-content-name-mismatch`. |
| `/pages/financial-forecast.html` | 96 | Footer utility links failed `color-contrast`; logo link failed `label-content-name-mismatch`. |
| `/pages/fund-financial-schedules.html` | 96 | Footer utility links failed `color-contrast`; logo link failed `label-content-name-mismatch`. |
| `/pages/departments.html` | 96 | Footer utility links failed `color-contrast`; logo link failed `label-content-name-mismatch`. |

### Lighthouse Fixes Made

- Darkened public light-theme home footer utility links in `index.html`.
- Darkened public light-theme shared footer utility links in `assets/walton-budget-nav.js`.
- Updated shared logo link accessible name from `Go to Home` to `Walton County Board of County Commissioners Home` so the accessible name includes the visible brand text.
- Updated the search module logo link label in `assets/walton-budget-search.js`.
- Bumped `walton-budget-nav.js` and `walton-budget-search.js` cache keys to `20260627-lighthouse-a11y`.

Hidden/admin-only dark mode was not changed.

### Final Lighthouse Results

After the targeted fixes, Lighthouse accessibility was rerun on the same pages.

| Page | Final Score | Remaining Lighthouse Accessibility Issues |
| --- | ---: | --- |
| `/` | 100 | None reported. |
| `/pages/accessibility.html` | 100 | None reported. |
| `/pages/financial-forecast.html` | 100 | None reported. |
| `/pages/fund-financial-schedules.html` | 100 | None reported. |
| `/pages/departments.html` | 100 | None reported. |

### Still Not Claimed

- Full ADA compliance is not claimed.
- Full WCAG compliance is not claimed.
- A complete manual screen reader pass has not been run.
- A complete page-by-page keyboard audit across every public page has not been run.

## View Prior Years Toggle Keyboard Fix

Date: June 27, 2026

### Issue Found

Manual keyboard testing found that the "View Prior Years" control was visually clickable, but did not behave reliably as a keyboard-operated disclosure control.

### User Impact

Keyboard-only users needed to be able to Tab to the control and toggle prior-year columns with Enter or Space, with a clear visible focus state and a meaningful accessible name.

### Files Changed

- `assets/budget-data.js`
- `assets/walton-budget-nav.js`
- `assets/style.css`
- Static HTML cache keys for `style.css`, `budget-data.js`, and `walton-budget-nav.js`

### Fix Made

- Replaced the rendered shared "View Prior Years" control with a real `<button type="button">`.
- Added `aria-expanded="false"` / `aria-expanded="true"` state updates.
- Updated the accessible name between "View prior years" and "Hide prior years".
- Updated the visible label between "View Prior Years" and "Hide Prior Years".
- Added a visible `:focus-visible` focus ring.
- Preserved the old checkbox handler as a compatibility fallback for any legacy-rendered toggles.
- Reset cloned button bindings inside budget-detail modal content before rebinding toggle behavior.
- Updated the older shared-nav injected table toggle to use the same button behavior.
- Bumped cache keys to `20260627-prior-years-a11y`.

No financial logic, Supabase logic, transaction filters, forecast assumptions, FY2027 revenue dedupe logic, raw data exposure, or hidden/admin-only dark mode behavior was changed.

### Browser / Keyboard Verification Result

Tested with Playwright against:

```text
http://127.0.0.1:8766/pages/fund-financial-schedules.html
```

Results:

- The "View Prior Years" control was reached by Tab as a `button`.
- The focused control had a visible focus ring: `3px` solid outline plus focus shadow.
- Initial state exposed `aria-expanded="false"` and accessible name `View prior years`.
- Enter toggled prior-year content on and changed `aria-expanded` to `true`.
- Space toggled prior-year content back off and changed `aria-expanded` to `false`.
- Mouse click toggled prior-year content on.
- No browser console errors or page errors were recorded during the test.

### Remaining Issues

- This was a focused verification of the "View Prior Years" toggle, not a full ADA or WCAG compliance audit.

## Axe-Core Accessibility Audit

Date: June 27, 2026

axe-core was run through Playwright as an automated accessibility check only against:

```text
http://127.0.0.1:8765/
```

axe-core does not establish full ADA or WCAG compliance. Results below reflect only automated axe checks for the tested pages.

### Pages Tested

- `/`
- `/pages/accessibility.html`
- `/pages/financial-forecast.html`
- `/pages/fund-financial-schedules.html`
- `/pages/departments.html`

### Initial Axe Violations Found

All five tested pages reported one `serious` violation:

- `avoid-inline-spacing`: inline text spacing must be adjustable with custom stylesheets.
- Affected node: `.wc-split-brand-bottom`.
- Cause: the split-logo equalization script wrote inline `letter-spacing` with `!important`.

The home page also had one axe `incomplete` ARIA item:

- `aria-prohibited-attr`: `.wc-split-brand` was a plain `div` with `aria-label`.

axe also listed `color-contrast` as `incomplete` on the tested pages. These were not reported as violations by axe and still require manual review where relevant.

### Axe Fixes Made

- Removed `!important` from the split-logo dynamic inline `letter-spacing` in `assets/walton-split-logo.js`.
- Removed unsupported `aria-label` from the plain `.wc-split-brand` `div` in `assets/walton-split-logo.js`.
- Removed the same unsupported `aria-label` from the fallback `.wc-split-brand` `div` in `assets/walton-budget-nav.js`.
- Bumped the split-logo cache key to `20260627-axe-a11y`.

No financial logic, Supabase logic, transaction filters, forecast assumptions, raw data exposure, or hidden/admin-only dark mode styles were changed.

### Final Axe Results

After the targeted fixes, axe-core was rerun on the same five pages.

| Page | Axe Violations | Remaining Axe Incomplete Items |
| --- | ---: | --- |
| `/` | 0 | `color-contrast`, 13 nodes marked incomplete |
| `/pages/accessibility.html` | 0 | `color-contrast`, 8 nodes marked incomplete |
| `/pages/financial-forecast.html` | 0 | `color-contrast`, 102 nodes marked incomplete |
| `/pages/fund-financial-schedules.html` | 0 | `color-contrast`, 136 nodes marked incomplete |
| `/pages/departments.html` | 0 | `color-contrast`, 37 nodes marked incomplete |

### Remaining Issues / Manual Review

- axe reported no violations on the tested pages after fixes.
- axe `color-contrast` results remained incomplete and should be reviewed manually where relevant.
- Full ADA compliance is not claimed.
- Full WCAG compliance is not claimed.
- A complete manual screen reader pass has not been run.

## Accessibility Page Contact Information Update

Date: June 27, 2026

`/pages/accessibility.html` was rewritten to replace placeholder contact text (`[Insert department/contact email]`, `[Insert phone number]`, `[Insert mailing address if desired]`, `[Insert date]`) with the County's actual accessibility/nondiscrimination contact, and to add the page sections requested: Website Accessibility, Accessibility and Nondiscrimination Assistance, Accessibility Design Guidelines, Browser Accessibility Information, Documents and Alternate Formats, Supported Assistive Technology, and Ongoing Accessibility Work.

No financial logic, Supabase logic, transaction filters, forecast assumptions, FY2027 revenue dedupe logic, or hidden/admin-only dark mode styles were touched.

### Contact Information Now Shown

- Jonathon Cornman
- Walton County Title VI/Nondiscrimination Coordinator
- 45 N. 6th Street
- DeFuniak Springs, FL 32433
- Phone: `(850) 892-8586` (linked as `tel:8508928586`)
- Email: `corjonathon@co.walton.fl.us` (linked as `mailto:corjonathon@co.walton.fl.us`)

The previous placeholder address (`176 Montgomery Cir., DeFuniak Springs, FL 32435`) and phone number (`(850) 892-8470`) were not present in the prior page content and required no removal beyond replacing the bracketed placeholders.

### Compliance Language Check

- Page does not state or imply "fully ADA compliant," "fully WCAG compliant," "guaranteed accessible," or "complies with all accessibility laws."
- Page uses "designed to support accessibility," "consistent with Web Content Accessibility Guidelines (WCAG) 2.1 Level AA," and "Accessibility is an ongoing effort."

### Verification Result

Verified in a headless browser against the local static site:

- Exactly one `<h1>` on the page (`Accessibility Statement`).
- Contact block renders all six required contact lines (name, title, street, city/state/zip, phone, email).
- No old/placeholder address, phone number, or bracketed placeholder text remains.
- `mailto:corjonathon@co.walton.fl.us` and `tel:8508928586` links are both present.
- Footer `Accessibility` link still resolves to `accessibility.html` and renders once.
- Skip link still works: Tab focuses "Skip to main content," Enter moves the URL hash to `#main-content` and focus to the injected `#main-content` target.
- No browser console errors or page errors were recorded.
- A complete page-by-page keyboard audit across every public page has not been run.
