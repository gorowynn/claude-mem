# Projects Sidebar Design

**Date:** 2026-02-21
**Designer:** Claude (Sonnet 4.6)
**Status:** Approved

## Overview

Add a premium overlay sidebar to the claude-mem viewer UI that displays all projects with statistics and activity timestamps. The sidebar serves as a project navigation and discovery interface, enhancing the current single-project-filter dropdown with a visual, data-rich exploration experience.

## Design Philosophy

**Aesthetic Direction:** Technical Archive Panel

The sidebar embodies a precision archival interface—think premium developer tools meets museum curation system. Each project is presented as an archival card with staggered reveal animations, monospace metadata typography, and warm amber accents that distinguish projects from observation types.

**Key Differentiators:**
- Staggered cascade entrance animations (0ms, 50ms, 100ms, 150ms...)
- Project-specific warm amber/gold accent color system
- Monospace typography for timestamps and stats (data-density aesthetic)
- Premium skeleton loaders with shimmer effects
- Bottom sheet pattern on mobile devices

## Requirements

### Functional Requirements

1. **Sidebar Toggle**
   - Header button to open/close sidebar
   - Backdrop click closes sidebar
   - ESC key closes sidebar
   - Smooth slide-in/out transitions (300ms cubic-bezier)

2. **Project Display**
   - List all projects with statistics
   - Show total count (observations + summaries + prompts)
   - Display last activity timestamp
   - Highlight currently filtered project

3. **Data Fetching**
   - Lazy load project stats when sidebar opens
   - Cache stats in memory during session
   - Show skeleton loaders while fetching
   - Handle empty/error states gracefully

4. **Navigation**
   - Click project card to filter by that project
   - "All Projects" option at top to clear filter
   - Update header dropdown when selection changes
   - Close sidebar after selection (configurable behavior)

5. **Responsive Design**
   - Desktop: 340px width, slides from left with backdrop
   - Mobile (≤768px): 85% width, bottom sheet with handle bar

### Non-Functional Requirements

- Performance: First paint < 100ms, stats fetch < 500ms
- Accessibility: Keyboard navigation, ARIA labels, focus management
- Browser support: Modern browsers (Chrome, Firefox, Safari, Edge)
- Animation: 60fps smooth transitions using GPU acceleration

## Architecture

### Component Structure

```
App.tsx
├── Header.tsx (add sidebar toggle button)
├── Sidebar.tsx (NEW)
│   ├── SidebarHeader.tsx (NEW)
│   ├── SidebarContent.tsx (NEW)
│   │   ├── ProjectCard.tsx (NEW)
│   │   └── SkeletonCard.tsx (NEW)
│   └── SidebarBackdrop.tsx (NEW)
└── Feed.tsx (unchanged)
```

### Data Flow

```
User clicks toggle button
  ↓
Sidebar opens (CSS transition)
  ↓
useProjectStats hook fetches data
  ↓
GET /api/projects/stats
  ↓
Return ProjectStats[] or show skeletons
  ↓
User clicks project card
  ↓
onFilterChange(project) updates App state
  ↓
Feed re-renders with filtered data
  ↓
Sidebar closes (optional)
```

### New API Endpoint

**Endpoint:** `GET /api/projects/stats`

**Response:**
```typescript
interface ProjectStats {
  project: string;
  totalCount: number;
  lastActivityEpoch: number;
}

interface StatsResponse {
  projects: ProjectStats[];
  totalProjects: number;
}
```

**Implementation:**
- Query SQLite database for observations grouped by project
- Count total items per project
- Find MAX(created_at_epoch) for last activity
- Sort by last activity DESC (most recent first)

## Visual Design

### Typography Hierarchy

**Display Font:** Monaspace Radon (existing)
- Project names: 15px, weight 600, letter-spacing -0.02em

**Metadata Font:** Monaco / Menlo / Consolas
- Timestamps: 11px, letter-spacing 0.02em
- Stat counts: 12px, weight 600

### Color System Extensions

```css
/* Light Mode */
:root, [data-theme="light"] {
  --color-accent-project: #d97706;
  --color-accent-project-hover: #b45309;
  --color-accent-project-subtle: rgba(217, 119, 6, 0.1);
}

/* Dark Mode */
[data-theme="dark"] {
  --color-accent-project: #fbbf24;
  --color-accent-project-hover: #f59e0b;
  --color-accent-project-subtle: rgba(251, 191, 36, 0.15);
}
```

### Component Styling

**Sidebar Container:**
```css
.sidebar {
  position: fixed;
  left: 0; /* Changed from right: 0 */
  top: 0;
  height: 100vh;
  width: 340px;
  background: var(--color-bg-primary);
  border-right: 1px solid var(--color-border-primary);
  display: flex;
  flex-direction: column;
  transform: translate3d(-100%, 0, 0);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 200;
  will-change: transform;
}

.sidebar.open {
  transform: translate3d(0, 0, 0);
}

.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  z-index: 199;
}

.sidebar-backdrop.visible {
  opacity: 1;
  pointer-events: auto;
}
```

**Project Card:**
```css
.sidebar-project-card {
  background: var(--color-bg-card);
  border: 2px solid var(--color-border-primary);
  border-radius: 12px;
  padding: 16px 18px;
  margin: 12px 18px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  animation: slideInUp 0.4s ease-out backwards;
}

.sidebar-project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(217, 119, 6, 0.12);
  border-color: var(--color-accent-project);
}

.sidebar-project-card.active {
  border-color: var(--color-accent-project);
  box-shadow: 0 0 0 3px var(--color-accent-project-subtle);
}

.project-name {
  font-family: 'Monaspace Radon', monospace;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
}

.project-stats {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.stat-badge {
  background: var(--color-bg-stat);
  border: 1px solid var(--color-border-secondary);
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  font-family: 'Monaco', monospace;
}

.project-timestamp {
  margin-top: 10px;
  font-size: 11px;
  font-family: 'Monaco', 'Menlo', monospace;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}
```

**Animations:**
```css
@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translate3d(-20px, 20px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

/* Stagger delays applied via inline style or nth-child */
```

**Skeleton Loader:**
```css
.skeleton-card {
  background: var(--color-bg-card);
  border: 2px solid var(--color-border-secondary);
  border-radius: 12px;
  padding: 16px 18px;
  margin: 12px 18px;
}

.skeleton-title {
  height: 20px;
  width: 60%;
  border-radius: 4px;
  margin-bottom: 12px;
}

.skeleton-stats {
  display: flex;
  gap: 8px;
}

.skeleton-badge {
  height: 24px;
  width: 60px;
  border-radius: 16px;
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--color-bg-secondary) 0%,
    var(--color-bg-tertiary) 50%,
    var(--color-bg-secondary) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### Mobile Responsive

**Mobile (≤ 768px): Bottom Sheet Pattern**

```css
@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    max-width: none;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    height: 85vh;
    border-radius: 20px 20px 0 0;
    transform: translate3d(0, 100%, 0);
    border-right: none;
    border-top: 1px solid var(--color-border-primary);
  }

  .sidebar.open {
    transform: translate3d(0, 0, 0);
  }

  .sheet-handle {
    width: 36px;
    height: 4px;
    background: var(--color-border-secondary);
    border-radius: 2px;
    margin: 8px auto 16px;
    flex-shrink: 0;
  }
}
```

## Implementation Phases

### Phase 1: Foundation (Core Sidebar)
- Create `Sidebar.tsx` component with backdrop
- Add toggle button to `Header.tsx`
- Implement open/close state in `App.tsx`
- Add CSS transitions and animations
- Test keyboard navigation (ESC key)

### Phase 2: Data Layer
- Create `useProjectStats` hook
- Implement `/api/projects/stats` endpoint in worker service
- Add SQLite query for project statistics
- Handle loading/error/empty states
- Implement in-memory caching

### Phase 3: UI Components
- Create `ProjectCard.tsx` component
- Create `SkeletonCard.tsx` component
- Create `SidebarHeader.tsx` component
- Implement staggered animation delays
- Add active state styling

### Phase 4: Integration
- Connect project cards to filter state
- Sync with header dropdown selection
- Add "All Projects" option
- Implement click-to-filter behavior
- Test responsive behavior

### Phase 5: Polish
- Accessibility audit (ARIA labels, focus traps)
- Performance optimization (memo, lazy loading)
- Edge case handling (no projects, long names)
- Animation smoothness verification
- Cross-browser testing

## Success Criteria

1. ✓ Sidebar opens smoothly with staggered card animations
2. ✓ Project stats load < 500ms on first open
3. ✓ Clicking project card updates feed filter
4. ✓ Active project visually highlighted
5. ✓ Mobile bottom sheet slides up smoothly
6. ✓ ESC key and backdrop click close sidebar
7. ✓ Skeleton loaders show during data fetch
8. ✓ Empty state displays when no projects exist
9. ✓ Keyboard navigation works (Tab, Enter, ESC)
10. ✓ Design matches premium card aesthetic

## Open Questions

1. **Close on selection?** Should sidebar close after clicking a project, or stay open for quick exploration?
   - **Decision:** Default to close, but keep open if Shift+Click (power user pattern)

2. **Stats refresh frequency?** How often to refresh cached stats?
   - **Decision:** Refresh on sidebar open if cache > 5 minutes old

3. **Project name truncation?** How to handle very long project names?
   - **Decision:** CSS ellipsis truncation with full title tooltip

4. **Sort order?** How to sort projects in the list?
   - **Decision:** By last activity DESC (most recent first), with "All Projects" pinned to top

## Future Enhancements

- Search/filter projects by name
- Project groupings or tags
- Quick actions per project (export, delete, archive)
- Activity graph per project (mini sparkline)
- Drag to reorder favorites
- Collapsed/expanded states per project

---

**Design Document Version:** 1.0
**Last Updated:** 2026-02-21
**Status:** Ready for implementation planning
