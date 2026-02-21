# UI Visual Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add visual polish to project filter dropdown and color-coded distinction to observation cards, implemented in two small independent steps for easy testing and rollback.

**Architecture:** CSS-only enhancements with minimal TypeScript changes. Step 1 adds folder icon and wider dropdown to Header. Step 2 adds type-specific colors and left borders to observation cards via dynamic className.

**Tech Stack:** React (TypeScript), CSS in viewer-template.html, CSS custom properties for theming

---

## Task 1: Add Type-Specific CSS Color Variables

**Files:**
- Modify: `src/ui/viewer-template.html:70-78` (Light mode theme variables)
- Modify: `src/ui/viewer-template.html:138-146` (Dark mode theme variables)

**Step 1: Add light mode type color variables**

Insert after line 71 in viewer-template.html:

```css
      /* Type-specific colors */
      --color-type-bugfix-bg: rgba(207, 34, 46, 0.12);
      --color-type-bugfix-text: #cf2232;
      --color-type-bugfix-border: #cf2232;
      --color-type-feature-bg: rgba(164, 51, 194, 0.12);
      --color-type-feature-text: #a433c2;
      --color-type-feature-border: #a433c2;
      --color-type-refactor-bg: rgba(87, 89, 98, 0.12);
      --color-type-refactor-text: #575962;
      --color-type-refactor-border: #575962;
      --color-type-change-bg: rgba(31, 136, 61, 0.12);
      --color-type-change-text: #1f883d;
      --color-type-change-border: #1f883d;
      --color-type-discovery-bg: rgba(9, 105, 218, 0.12);
      --color-type-discovery-text: #0969da;
      --color-type-discovery-border: #0969da;
      --color-type-decision-bg: rgba(198, 138, 13, 0.12);
      --color-type-decision-text: #c68a0d;
      --color-type-decision-border: #c68a0d;
```

**Step 2: Add dark mode type color variables**

Find the dark mode section (around line 89) and insert the dark mode variants after the existing type badge colors (around line 146):

```css
      /* Type-specific colors (dark mode) */
      --color-type-bugfix-bg: rgba(235, 110, 117, 0.15);
      --color-type-bugfix-text: #f85149;
      --color-type-bugfix-border: #f85149;
      --color-type-feature-bg: rgba(199, 120, 221, 0.15);
      --color-type-feature-text: #d2a8ff;
      --color-type-feature-border: #d2a8ff;
      --color-type-refactor-bg: rgba(138, 144, 160, 0.15);
      --color-type-refactor-text: #8b949e;
      --color-type-refactor-border: #8b949e;
      --color-type-change-bg: rgba(75, 175, 101, 0.15);
      --color-type-change-text: #3fb950;
      --color-type-change-border: #3fb950;
      --color-type-discovery-bg: rgba(88, 166, 255, 0.15);
      --color-type-discovery-text: #58a6ff;
      --color-type-discovery-border: #58a6ff;
      --color-type-decision-bg: rgba(219, 180, 69, 0.15);
      --color-type-decision-text: #d29922;
      --color-type-decision-border: #d29922;
```

**Step 3: Build to verify CSS is valid**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 4: Commit CSS variables**

```bash
git add src/ui/viewer-template.html
git commit -m "feat: add type-specific CSS color variables

- Add 6 type color schemes (bugfix, feature, refactor, change, discovery, decision)
- Include both light and dark mode variants
- Use CSS custom properties for theme consistency"
```

---

## Task 2: Add Type-Specific Card Styling

**Files:**
- Modify: `src/ui/viewer-template.html` (Card styling section)

**Step 1: Locate card styling section**

Search for `.card {` in viewer-template.html (around line 845-890)

**Step 2: Add type-specific left border classes**

Insert after the existing `.card` ruleset:

```css
    /* Type-specific card borders */
    .card.type-bugfix {
      border-left: 3px solid var(--color-type-bugfix-border);
    }
    .card.type-bugfix .card-type {
      background: var(--color-type-bugfix-bg);
      color: var(--color-type-bugfix-text);
    }

    .card.type-feature {
      border-left: 3px solid var(--color-type-feature-border);
    }
    .card.type-feature .card-type {
      background: var(--color-type-feature-bg);
      color: var(--color-type-feature-text);
    }

    .card.type-refactor {
      border-left: 3px solid var(--color-type-refactor-border);
    }
    .card.type-refactor .card-type {
      background: var(--color-type-refactor-bg);
      color: var(--color-type-refactor-text);
    }

    .card.type-change {
      border-left: 3px solid var(--color-type-change-border);
    }
    .card.type-change .card-type {
      background: var(--color-type-change-bg);
      color: var(--color-type-change-text);
    }

    .card.type-discovery {
      border-left: 3px solid var(--color-type-discovery-border);
    }
    .card.type-discovery .card-type {
      background: var(--color-type-discovery-bg);
      color: var(--color-type-discovery-text);
    }

    .card.type-decision {
      border-left: 3px solid var(--color-type-decision-border);
    }
    .card.type-decision .card-type {
      background: var(--color-type-decision-bg);
      color: var(--color-type-decision-text);
    }
```

**Step 3: Build to verify CSS**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit card styling**

```bash
git add src/ui/viewer-template.html
git commit -m "feat: add type-specific card styling

- Add 3px left border to cards based on observation type
- Apply type-specific colors to type badges
- Support all 6 observation types with distinct colors"
```

---

## Task 3: Add Dynamic Type Class to ObservationCard

**Files:**
- Modify: `src/ui/viewer/components/ObservationCard.tsx:47-48`

**Step 1: Read current ObservationCard implementation**

File: `src/ui/viewer/components/ObservationCard.tsx`

Current line 47-48:
```tsx
  return (
    <div className="card">
```

**Step 2: Add dynamic type className**

Replace line 48 with:
```tsx
  return (
    <div className={`card type-${observation.type}`}>
```

**Step 3: Build to verify TypeScript**

Run: `npm run build`
Expected: Build succeeds, no TypeScript errors

**Step 4: Test in browser**

1. Open http://localhost:37777
2. Observe different observation types have:
   - Colored left border (3px)
   - Color-matched type badge
3. Switch between light/dark theme
4. Verify colors work in both themes

**Step 5: Commit ObservationCard change**

```bash
git add src/ui/viewer/components/ObservationCard.tsx
git commit -m "feat: apply dynamic type class to observation cards

- Add type-{name} className based on observation.type
- Enables type-specific colors and left borders
- Completes visual distinction for 6 observation types"
```

---

## Task 4: Add Project Filter Wrapper and Icon

**Files:**
- Modify: `src/ui/viewer/components/Header.tsx:81-89`

**Step 1: Read current Header select implementation**

File: `src/ui/viewer/components/Header.tsx`

Current lines 81-89:
```tsx
        <select
          value={currentFilter}
          onChange={e => onFilterChange(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map(project => (
            <option key={project} value={project}>{project}</option>
          ))}
        </select>
```

**Step 2: Wrap select in filter wrapper div**

Replace lines 81-89 with:
```tsx
        <div className="project-filter-wrapper">
          <svg className="project-filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <select
            value={currentFilter}
            onChange={e => onFilterChange(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map(project => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
        </div>
```

**Step 3: Build to verify TypeScript**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit Header wrapper change**

```bash
git add src/ui/viewer/components/Header.tsx
git commit -m "feat: add folder icon wrapper to project filter

- Wrap select in project-filter-wrapper div
- Add folder icon before dropdown for visual clarity
- Maintains all existing functionality"
```

---

## Task 5: Add Project Filter CSS Styling

**Files:**
- Modify: `src/ui/viewer-template.html` (Status and select styling section)

**Step 1: Locate status select styling**

Search for `.status select {` (around line 739)

**Step 2: Update select max-width**

Change line 755 from:
```css
      max-width: 180px;
```

To:
```css
      max-width: 240px;
```

**Step 3: Add project filter wrapper styling**

Insert after `.status select:focus` ruleset (after line 771):

```css
    .project-filter-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .project-filter-icon {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      color: var(--color-text-secondary);
      opacity: 0.7;
      transition: opacity 0.15s ease;
    }

    .project-filter-wrapper:hover .project-filter-icon {
      opacity: 1;
    }

    .project-filter-wrapper select {
      max-width: 240px;
    }
```

**Step 4: Build to verify CSS**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Test in browser**

1. Open http://localhost:37777
2. Observe project filter has:
   - Folder icon before dropdown
   - Wider dropdown (240px vs 180px)
   - Icon highlights on hover
3. Test dropdown functionality (filtering by project)
4. Switch themes and verify icon colors work

**Step 6: Commit filter styling**

```bash
git add src/ui/viewer-template.html
git commit -m "feat: add project filter visual enhancements

- Add folder icon before project dropdown
- Increase max-width from 180px to 240px
- Add hover effect on icon
- Improves visual hierarchy and readability"
```

---

## Task 6: Verification and Documentation

**Files:**
- Modify: `README.md` (Feature documentation)

**Step 1: Full build and smoke test**

Run: `npm run build`
Expected: Clean build, no errors or warnings

**Step 2: Manual testing checklist**

1. Open http://localhost:37777
2. **Project Filter:**
   - [ ] Folder icon visible before dropdown
   - [ ] Dropdown is wider (240px)
   - [ ] Filtering by project works
   - [ ] "All Projects" shows all observations
   - [ ] Selecting specific project filters correctly
3. **Observation Cards:**
   - [ ] Different types have different colored left borders
   - [ ] Type badges match border colors
   - [ ] All 6 types visible (bugfix, feature, refactor, change, discovery, decision)
   - [ ] Card borders don't break layout
4. **Theme Testing:**
   - [ ] Test in light mode
   - [ ] Test in dark mode
   - [ ] Colors work in both themes
5. **Regression Testing:**
   - [ ] Project filtering still works
   - [ ] Card view toggles (facts/narrative) work
   - [ ] Scroll to top works
   - [ ] Infinite scroll works

**Step 3: Update README.md**

Find the "Web Viewer UI" section in README.md and add bullet points:

```markdown
- **Type-Based Visual Distinction:** Observation cards display color-coded badges and left borders based on type (🔴 bugfix, 🟣 feature, 🔄 refactor, ✅ change, 🔵 discovery, ⚖️ decision)
- **Enhanced Project Filter:** Improved dropdown with folder icon and wider display for better project navigation
```

**Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: update README with UI visual improvements

- Document type-based card distinction feature
- Document enhanced project filter dropdown
- Complete Step 1 and Step 2 of UI rework"
```

---

## Success Criteria

✅ Project filter has folder icon and is 240px wide
✅ Observation cards have type-specific left borders (3px)
✅ Type badges match border colors
✅ All 6 observation types have distinct colors
✅ Colors work in both light and dark themes
✅ No regressions in existing functionality
✅ Each step committed independently for easy rollback
✅ README.md updated with new features

---

## Rollback Plan

If bugs are found:
- Step 1 (type colors): Revert commits with "feat: add type-specific"
- Step 2 (filter styling): Revert commits with "feat: add project filter"
- Each step is independent, can rollback individually

---

## Notes for Implementation

- All CSS changes use existing CSS variable patterns
- No JavaScript logic changes, only visual enhancements
- TypeScript change is minimal (single className addition)
- Both steps can be deployed independently
- Testing focus is on visual regression, not functional changes