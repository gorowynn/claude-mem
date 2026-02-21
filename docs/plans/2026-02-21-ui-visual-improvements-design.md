# UI Visual Improvements Design

**Date:** 2026-02-21
**Status:** Approved
**Author:** Claude

## Overview

Incremental visual improvements to the claude-mem Web UI to improve navigation and observation type distinction. This work is split into two small, independently testable steps to avoid the bugs that occurred in the previous UI rework attempt.

## Problem Statement

1. **Navigation:** The project filter dropdown is functional but lacks visual polish
2. **Observation Cards:** All observations look the same except summaries, making it hard to scan by type

## Design Goals

- Incremental changes, each step independently testable
- CSS-only changes where possible
- Minimal JavaScript/TypeScript changes
- Maintain existing functionality
- Easy rollback per step

---

## Step 1: Project Filter Visual Enhancement

### Current State
- Native `<select>` element in Header component
- Max-width: 180px (truncates long project names)
- No icon to indicate it's a project selector
- Decent styling with custom arrow icon and hover effects

### Proposed Changes

**Visual Enhancements:**
1. Add folder icon before the dropdown
2. Increase max-width from 180px → 240px
3. Add container for icon positioning
4. Improve visual hierarchy as a primary navigation control

**Implementation:**
- File: `src/ui/viewer-template.html` (CSS only)
- Create `.project-filter-wrapper` class
- Position folder icon absolutely within wrapper
- Update `.status select` max-width

**Files to Modify:**
- `src/ui/viewer/components/Header.tsx` - Add wrapper div around select
- `src/ui/viewer-template.html` - Add CSS for wrapper and icon

---

## Step 2: Type-Based Card Distinction

### Current State
- All observation cards use same generic blue badge
- No visual distinction between bugfix, feature, refactor, etc.
- Scanning feed by observation type is difficult

### Observation Types
claude-mem has 6 core types (with emoji indicators):
- 🔴 **bugfix** - Bug fixes and patches
- 🟣 **feature** - New features and functionality
- 🔄 **refactor** - Code restructuring and improvements
- ✅ **change** - General changes and updates
- 🔵 **discovery** - Exploration and findings
- ⚖️ **decision** - Decisions and trade-offs

### Proposed Changes

**Visual Distinctions:**
1. Color-coded type badges (6 distinct colors)
2. Type-specific 3px left border on entire card
3. Type emoji icons in badges

**Color Palette:**

| Type | Background | Border | Emoji |
|------|------------|--------|-------|
| bugfix | `rgba(207, 34, 46, 0.12)` | `#cf2232` | 🔴 |
| feature | `rgba(164, 51, 194, 0.12)` | `#a433c2` | 🟣 |
| refactor | `rgba(87, 89, 98, 0.12)` | `#575962` | 🔄 |
| change | `rgba(31, 136, 61, 0.12)` | `#1f883d` | ✅ |
| discovery | `rgba(9, 105, 218, 0.12)` | `#0969da` | 🔵 |
| decision | `rgba(198, 138, 13, 0.12)` | `#c68a0d` | ⚖️ |

**Implementation:**
- File: `src/ui/viewer-template.html` (CSS)
  - Add CSS custom properties for each type
  - Add `.card.type-{name}` classes with left border styling
  - Update `.card-type` badge to use type-specific colors
  - Add dark mode variants

- File: `src/ui/viewer/components/ObservationCard.tsx` (TypeScript)
  - Add dynamic className: `card type-${observation.type}`
  - Pass className to card root div

**Files to Modify:**
- `src/ui/viewer-template.html` - CSS variables and type classes
- `src/ui/viewer/components/ObservationCard.tsx` - Dynamic className

---

## Testing Strategy

### After Each Step:
1. Build: `npm run build` - Verify no build errors
2. Test: Open http://localhost:37777
3. Verify: Visual changes match design
4. Regression: Test existing functionality (filtering, toggles, themes)
5. Themes: Check both light and dark mode

### Rollback Plan
- Each step is a separate git commit
- Easy to revert individual steps if bugs appear
- No interdependencies between steps

---

## CSS Variable Pattern

```css
/* Light mode */
--color-type-bugfix-bg: rgba(207, 34, 46, 0.12);
--color-type-bugfix-border: #cf2232;
--color-type-bugfix-text: #cf2232;

/* Dark mode - adjusted opacity */
--color-type-bugfix-bg: rgba(235, 110, 117, 0.15);
--color-type-bugfix-border: #f85149;
--color-type-bugfix-text: #f85149;
```

(Repeated for each type with appropriate colors)

---

## Success Criteria

1. Project filter is more prominent and readable
2. Observation types are visually distinct at a glance
3. Left border enables quick scanning of feed by type
4. Color scheme works in both light and dark themes
5. No regressions in existing functionality
6. Each step can be deployed independently

---

## Next Steps

1. Create detailed implementation plan using `writing-plans` skill
2. Execute Step 1 (project filter)
3. Test and commit Step 1
4. Execute Step 2 (type distinction)
5. Test and commit Step 2
6. Update README.md with new UI features