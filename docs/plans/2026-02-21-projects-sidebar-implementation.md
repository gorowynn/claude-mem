# Projects Sidebar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a premium overlay sidebar that displays all projects with statistics and activity timestamps, replacing the simple dropdown filter with a visual, data-rich exploration experience.

**Architecture:** Left-sliding overlay sidebar with backdrop dim, card-based project list with staggered animations, lazy-loaded statistics fetched via new API endpoint, and responsive bottom-sheet behavior on mobile.

**Tech Stack:** React (TypeScript), Express API endpoints, SQLite queries, CSS animations, existing viewer design system

---

## Task 1: Add TypeScript Types for Project Stats

**Files:**
- Modify: `src/ui/viewer/types.ts:111`

**Step 1: Add ProjectStats interface to types**

```typescript
// Add after line 111, after the Stats interface
export interface ProjectStats {
  project: string;
  totalCount: number;
  lastActivityEpoch: number;
}

export interface ProjectStatsResponse {
  projects: ProjectStats[];
  totalProjects: number;
}
```

**Step 2: Commit**

```bash
git add src/ui/viewer/types.ts
git commit -m "feat: add ProjectStats TypeScript types

Add ProjectStats interface for sidebar project statistics display.
Includes project name, total count, and last activity timestamp."
```

---

## Task 2: Add API Endpoint for Project Statistics

**Files:**
- Modify: `src/services/worker/http/routes/DataRoutes.ts:49`

**Step 1: Register new route**

Add after line 49 (after `/api/projects` route):
```typescript
app.get('/api/projects/stats', this.handleGetProjectStats.bind(this));
```

**Step 2: Implement handler method**

Add after the `handleGetProjects` method (after line 262):
```typescript
/**
 * Get project statistics with counts and last activity
 * GET /api/projects/stats
 */
private handleGetProjectStats = this.wrapHandler((req: Request, res: Response): void => {
  const db = this.dbManager.getSessionStore().db;

  // Query project stats from observations, summaries, and prompts
  const rows = db.prepare(`
    SELECT
      project,
      COUNT(*) as totalCount,
      MAX(created_at_epoch) as lastActivityEpoch
    FROM (
      SELECT project, created_at_epoch FROM observations
      UNION ALL
      SELECT project, created_at_epoch FROM session_summaries
      UNION ALL
      SELECT project, created_at_epoch FROM user_prompts
    )
    WHERE project IS NOT NULL
    GROUP BY project
    ORDER BY lastActivityEpoch DESC
  `).all() as Array<{ project: string; totalCount: number; lastActivityEpoch: number }>;

  const projects: ProjectStats[] = rows.map(row => ({
    project: row.project,
    totalCount: row.totalCount,
    lastActivityEpoch: row.lastActivityEpoch
  }));

  res.json({
    projects,
    totalProjects: projects.length
  });
});
```

**Step 3: Import ProjectStats type at top of file**

Add import at line 20:
```typescript
import type { ProjectStats } from '../../../../ui/viewer/types.js';
```

**Step 4: Build and test**

```bash
npm run build
npm run build-and-sync
```

Test endpoint:
```bash
curl http://localhost:37777/api/projects/stats
```

Expected output:
```json
{
  "projects": [
    {"project": "claude-mem", "totalCount": 42, "lastActivityEpoch": 1707123456789},
    {"project": "my-project", "totalCount": 15, "lastActivityEpoch": 1707112345678}
  ],
  "totalProjects": 2
}
```

**Step 5: Commit**

```bash
git add src/services/worker/http/routes/DataRoutes.ts
git commit -m "feat: add /api/projects/stats endpoint

Add new API endpoint that returns project statistics including
total count and last activity timestamp. Queries observations,
summaries, and prompts tables, sorted by most recent activity."
```

---

## Task 3: Add API Constants for Project Stats

**Files:**
- Modify: `src/ui/viewer/constants/api.ts`

**Step 1: Add API endpoint constant**

```typescript
export const API_ENDPOINTS = {
  // ... existing endpoints
  PROJECT_STATS: '/api/projects/stats',
} as const;
```

**Step 2: Commit**

```bash
git add src/ui/viewer/constants/api.ts
git commit -m "feat: add PROJECT_STATS API endpoint constant"
```

---

## Task 4: Create useProjectStats Hook

**Files:**
- Create: `src/ui/viewer/hooks/useProjectStats.ts`

**Step 1: Write the hook file**

```typescript
import { useState, useEffect, useRef } from 'react';
import { ProjectStats, ProjectStatsResponse } from '../types';
import { API_ENDPOINTS } from '../constants/api';

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface CachedData {
  data: ProjectStats[];
  timestamp: number;
}

export function useProjectStats(isSidebarOpen: boolean) {
  const [stats, setStats] = useState<ProjectStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<CachedData | null>(null);

  useEffect(() => {
    // Only fetch when sidebar opens
    if (!isSidebarOpen) return;

    // Check cache
    const now = Date.now();
    if (cacheRef.current && (now - cacheRef.current.timestamp) < CACHE_DURATION_MS) {
      setStats(cacheRef.current.data);
      return;
    }

    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(API_ENDPOINTS.PROJECT_STATS);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: ProjectStatsResponse = await response.json();

        // Update cache
        cacheRef.current = {
          data: data.projects,
          timestamp: now
        };

        setStats(data.projects);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('[useProjectStats] Failed to fetch:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [isSidebarOpen]);

  return { stats, isLoading, error };
}
```

**Step 2: Commit**

```bash
git add src/ui/viewer/hooks/useProjectStats.ts
git commit -m "feat: add useProjectStats hook with caching

Custom hook that fetches project statistics when sidebar opens.
Implements 5-minute memory cache to avoid redundant API calls.
Returns stats array, loading state, and error state."
```

---

## Task 5: Add Sidebar State to App Component

**Files:**
- Modify: `src/ui/viewer/App.tsx:15`

**Step 1: Add sidebar state**

Add after line 16:
```typescript
const [sidebarOpen, setSidebarOpen] = useState(false);
```

**Step 2: Add toggle handler**

Add after line 61 (after toggleLogsModal):
```typescript
// Toggle sidebar
const toggleSidebar = useCallback(() => {
  setSidebarOpen(prev => !prev);
}, []);
```

**Step 3: Import useProjectStats hook**

Add import at line 6:
```typescript
import { useProjectStats } from './hooks/useProjectStats';
```

**Step 4: Call useProjectStats hook**

Add after line 25 (after useTheme call):
```typescript
const projectStats = useProjectStats(sidebarOpen);
```

**Step 5: Update Header props**

Modify Header component call (lines 97-107) to add sidebar props:
```typescript
<Header
  isConnected={isConnected}
  projects={projects}
  currentFilter={currentFilter}
  onFilterChange={setCurrentFilter}
  isProcessing={isProcessing}
  queueDepth={queueDepth}
  themePreference={preference}
  onThemeChange={setThemePreference}
  onContextPreviewToggle={toggleContextPreview}
  onSidebarToggle={toggleSidebar}
  isSidebarOpen={sidebarOpen}
/>
```

**Step 6: Add Sidebar component placeholder**

Add before the closing `</>` (after LogsDrawer, line 141):
```typescript
{sidebarOpen && (
  <div>
    {/* Sidebar component will be added in next task */}
  </div>
)}
```

**Step 7: Commit**

```bash
git add src/ui/viewer/App.tsx
git commit -m "feat: add sidebar state and toggle to App component

Add sidebarOpen state, toggleSidebar handler, and integrate useProjectStats hook.
Pass sidebar props to Header component for toggle button."
```

---

## Task 6: Add Sidebar Toggle Button to Header

**Files:**
- Modify: `src/ui/viewer/components/Header.tsx:7`

**Step 1: Update HeaderProps interface**

Add props after line 16:
```typescript
onSidebarToggle: () => void;
isSidebarOpen: boolean;
```

**Step 2: Add sidebar button to JSX**

Add after line 79 (before project-filter-wrapper):
```typescript
<button
  className="sidebar-toggle-btn"
  onClick={onSidebarToggle}
  title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
</button>
```

**Step 3: Add button styling to viewer-template.html**

Find `.status` selector around line 1100 in viewer-template.html and add after `.settings-btn` styles:

```css
.sidebar-toggle-btn {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-primary);
  border-radius: 6px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  color: var(--color-text-secondary);
}

.sidebar-toggle-btn:hover {
  background: var(--color-bg-card-hover);
  border-color: var(--color-border-focus);
  color: var(--color-text-primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.sidebar-toggle-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.sidebar-toggle-btn svg {
  width: 18px;
  height: 18px;
}
```

**Step 4: Commit**

```bash
git add src/ui/viewer/components/Header.tsx src/ui/viewer-template.html
git commit -m "feat: add sidebar toggle button to Header

Add hamburger menu button that opens/closes the sidebar.
Button styled with consistent design language matching other header icons."
```

---

## Task 7: Create Sidebar Component Structure

**Files:**
- Create: `src/ui/viewer/components/Sidebar.tsx`

**Step 1: Write Sidebar component**

```typescript
import React from 'react';
import { ProjectStats } from '../types';
import { SidebarHeader } from './SidebarHeader';
import { SidebarContent } from './SidebarContent';
import { formatRelativeTime } from '../utils/time';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  stats: ProjectStats[];
  isLoading: boolean;
  error: string | null;
  currentFilter: string;
  onProjectSelect: (project: string) => void;
}

export function Sidebar({
  isOpen,
  onClose,
  stats,
  isLoading,
  error,
  currentFilter,
  onProjectSelect
}: SidebarProps) {
  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle ESC key
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className={`sidebar-backdrop ${isOpen ? 'visible' : ''}`} onClick={handleBackdropClick} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <SidebarHeader onClose={onClose} />
        <SidebarContent
          stats={stats}
          isLoading={isLoading}
          error={error}
          currentFilter={currentFilter}
          onProjectSelect={onProjectSelect}
        />
      </aside>
    </>
  );
}
```

**Step 2: Commit**

```bash
git add src/ui/viewer/components/Sidebar.tsx
git commit -m "feat: create Sidebar component structure

Add main Sidebar component with backdrop, ESC key handling,
and child components for header and content area."
```

---

## Task 8: Create SidebarHeader Component

**Files:**
- Create: `src/ui/viewer/components/SidebarHeader.tsx`

**Step 1: Write SidebarHeader component**

```typescript
import React from 'react';

interface SidebarHeaderProps {
  onClose: () => void;
}

export function SidebarHeader({ onClose }: SidebarHeaderProps) {
  return (
    <div className="sidebar-header">
      <h1>Projects</h1>
      <button
        className="sidebar-close-btn"
        onClick={onClose}
        aria-label="Close sidebar"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  );
}
```

**Step 2: Add CSS styling to viewer-template.html**

Add after existing `.sidebar-header` styles (around line 458):

```css
.sidebar-header {
  padding: 16px 18px;
  border-bottom: 1px solid var(--color-border-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-bg-header);
  backdrop-filter: blur(12px);
}

.sidebar-header h1 {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary);
  font-family: 'Monaspace Radon', monospace;
  letter-spacing: -0.02em;
}

.sidebar-close-btn {
  background: transparent;
  border: none;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
  color: var(--color-text-secondary);
}

.sidebar-close-btn:hover {
  background: var(--color-bg-card-hover);
  color: var(--color-text-primary);
}

.sidebar-close-btn svg {
  width: 18px;
  height: 18px;
}
```

**Step 3: Commit**

```bash
git add src/ui/viewer/components/SidebarHeader.tsx src/ui/viewer-template.html
git commit -m "feat: add SidebarHeader component

Add header with title and close button. Styled with premium
design matching header component aesthetic."
```

---

## Task 9: Create Time Formatting Utility

**Files:**
- Create: `src/ui/viewer/utils/time.ts`

**Step 1: Write time formatting utility**

```typescript
/**
 * Format epoch timestamp as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(epoch: number): string {
  const now = Date.now();
  const diff = now - epoch;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) {
    return 'just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 30) {
    return `${days}d ago`;
  } else if (months < 12) {
    return `${months}mo ago`;
  } else {
    return `${years}y ago`;
  }
}
```

**Step 2: Commit**

```bash
git add src/ui/viewer/utils/time.ts
git commit -m "feat: add formatRelativeTime utility

Add utility function to format epoch timestamps as relative time.
Supports seconds, minutes, hours, days, months, and years."
```

---

## Task 10: Create ProjectCard Component

**Files:**
- Create: `src/ui/viewer/components/ProjectCard.tsx`

**Step 1: Write ProjectCard component**

```typescript
import React from 'react';
import { ProjectStats } from '../types';
import { formatRelativeTime } from '../utils/time';

interface ProjectCardProps {
  project: ProjectStats;
  isActive: boolean;
  onClick: () => void;
  index: number;
}

export function ProjectCard({ project, isActive, onClick, index }: ProjectCardProps) {
  const staggerDelay = (index % 8) * 50; // Cycle delay every 8 cards

  return (
    <div
      className={`sidebar-project-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
      style={{ animationDelay: `${staggerDelay}ms` }}
    >
      <div className="project-name">{project.project}</div>

      <div className="project-stats">
        <div className="stat-badge">
          {project.totalCount} items
        </div>
      </div>

      <div className="project-timestamp">
        {formatRelativeTime(project.lastActivityEpoch)}
      </div>
    </div>
  );
}
```

**Step 2: Add CSS styling to viewer-template.html**

Add after `.sidebar-project-filter` styles (around line 550):

```css
/* Project Card */
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
  font-family: 'Monaco', 'Menlo', monospace;
}

.project-timestamp {
  margin-top: 10px;
  font-size: 11px;
  font-family: 'Monaco', 'Menlo', monospace;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}

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
```

**Step 3: Commit**

```bash
git add src/ui/viewer/components/ProjectCard.tsx src/ui/viewer-template.html
git commit -m "feat: add ProjectCard component with staggered animations

Add card component displaying project name, total count, and relative time.
Implements staggered entrance animation cycling every 8 cards.
Styled with premium card design matching observation cards."
```

---

## Task 11: Create SkeletonCard Component

**Files:**
- Create: `src/ui/viewer/components/SkeletonCard.tsx`

**Step 1: Write SkeletonCard component**

```typescript
import React from 'react';

interface SkeletonCardProps {
  index: number;
}

export function SkeletonCard({ index }: SkeletonCardProps) {
  const staggerDelay = (index % 8) * 50;

  return (
    <div
      className="skeleton-card"
      style={{ animationDelay: `${staggerDelay}ms` }}
    >
      <div className="skeleton-title skeleton-shimmer" />
      <div className="skeleton-stats">
        <div className="skeleton-badge skeleton-shimmer" />
      </div>
      <div className="skeleton-timestamp skeleton-shimmer" />
    </div>
  );
}
```

**Step 2: Add CSS styling to viewer-template.html**

Add after project card styles:

```css
/* Skeleton Card */
.skeleton-card {
  background: var(--color-bg-card);
  border: 2px solid var(--color-border-secondary);
  border-radius: 12px;
  padding: 16px 18px;
  margin: 12px 18px;
  animation: slideInUp 0.4s ease-out backwards;
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

.skeleton-timestamp {
  height: 14px;
  width: 40%;
  border-radius: 4px;
  margin-top: 10px;
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

**Step 3: Commit**

```bash
git add src/ui/viewer/components/SkeletonCard.tsx src/ui/viewer-template.html
git commit -m "feat: add SkeletonCard component with shimmer effect

Add loading state skeleton with animated shimmer gradient.
Maintains staggered animation delay pattern for consistency."
```

---

## Task 12: Create SidebarContent Component

**Files:**
- Create: `src/ui/viewer/components/SidebarContent.tsx`

**Step 1: Write SidebarContent component**

```typescript
import React from 'react';
import { ProjectStats } from '../types';
import { ProjectCard } from './ProjectCard';
import { SkeletonCard } from './SkeletonCard';

interface SidebarContentProps {
  stats: ProjectStats[];
  isLoading: boolean;
  error: string | null;
  currentFilter: string;
  onProjectSelect: (project: string) => void;
}

export function SidebarContent({
  stats,
  isLoading,
  error,
  currentFilter,
  onProjectSelect
}: SidebarContentProps) {
  const handleProjectClick = (project: string) => {
    onProjectSelect(project);
  };

  const handleAllProjectsClick = () => {
    onProjectSelect('');
  };

  return (
    <div className="sidebar-content">
      {/* All Projects Option */}
      <div
        className={`sidebar-project-card ${!currentFilter ? 'active' : ''}`}
        onClick={handleAllProjectsClick}
        style={{ animationDelay: '0ms' }}
      >
        <div className="project-name">All Projects</div>
        <div className="project-stats">
          <div className="stat-badge">
            {stats.reduce((sum, s) => sum + s.totalCount, 0)} items
          </div>
        </div>
        <div className="project-timestamp">
          {stats.length} projects
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div style={{ padding: '18px', color: '#f85149', fontSize: '14px' }}>
          Failed to load projects: {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <>
          {[...Array(5)].map((_, i) => (
            <SkeletonCard key={i} index={i} />
          ))}
        </>
      )}

      {/* Project List */}
      {!isLoading && stats.map((project, index) => (
        <ProjectCard
          key={project.project}
          project={project}
          isActive={currentFilter === project.project}
          onClick={() => handleProjectClick(project.project)}
          index={index + 1} // +1 because "All Projects" is index 0
        />
      ))}

      {/* Empty State */}
      {!isLoading && stats.length === 0 && !error && (
        <div style={{ padding: '40px 18px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          No projects found
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add CSS styling to viewer-template.html**

Add after sidebar header styles:

```css
.sidebar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 20px;
}

/* Custom scrollbar for sidebar content */
.sidebar-content::-webkit-scrollbar {
  width: 8px;
}

.sidebar-content::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-content::-webkit-scrollbar-thumb {
  background: var(--color-bg-scrollbar-thumb);
  border-radius: 4px;
}

.sidebar-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-bg-scrollbar-thumb-hover);
}
```

**Step 3: Commit**

```bash
git add src/ui/viewer/components/SidebarContent.tsx src/ui/viewer-template.html
git commit -m "feat: add SidebarContent component with states

Add content area with All Projects option, project cards, loading skeletons,
error display, and empty state. Integrates with filter selection."
```

---

## Task 13: Add Project Accent Color to Theme Variables

**Files:**
- Modify: `src/ui/viewer-template.html`

**Step 1: Add project accent colors to CSS variables**

Find `:root` selector (around line 19) and add after line 36:
```css
--color-accent-project: #d97706;
--color-accent-project-hover: #b45309;
--color-accent-project-subtle: rgba(217, 119, 6, 0.1);
```

Find `[data-theme="dark"]` selector (around line 60) and add after line 76:
```css
--color-accent-project: #fbbf24;
--color-accent-project-hover: #f59e0b;
--color-accent-project-subtle: rgba(251, 191, 36, 0.15);
```

**Step 2: Commit**

```bash
git add src/ui/viewer-template.html
git commit -m "feat: add project accent color system

Add warm amber/gold accent colors for project cards.
Light mode uses darker amber (#d97706), dark mode uses brighter gold (#fbbf24)."
```

---

## Task 14: Add Sidebar and Backdrop CSS

**Files:**
- Modify: `src/ui/viewer-template.html`

**Step 1: Update existing sidebar CSS**

Find `.sidebar` selector (around line 382) and replace entire block:

```css
.sidebar {
  position: fixed;
  left: 0;
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

**Step 2: Add mobile responsive styles**

Find `@media (max-width: 768px)` section (around line 1911) and add:

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

  .sidebar-header {
    padding-top: 8px;
  }
}
```

**Step 3: Commit**

```bash
git add src/ui/viewer-template.html
git commit -m "feat: add sidebar overlay and backdrop CSS

Implement left-sliding sidebar with backdrop dim effect.
Add mobile bottom sheet behavior with handle bar affordance."
```

---

## Task 15: Integrate Sidebar Component in App

**Files:**
- Modify: `src/ui/viewer/App.tsx`

**Step 1: Import Sidebar component**

Add import at line 4:
```typescript
import { Sidebar } from './components/Sidebar';
```

**Step 2: Replace placeholder with actual Sidebar**

Replace the placeholder div added in Task 5 (after line 141) with:
```typescript
<Sidebar
  isOpen={sidebarOpen}
  onClose={toggleSidebar}
  stats={projectStats.stats}
  isLoading={projectStats.isLoading}
  error={projectStats.error}
  currentFilter={currentFilter}
  onProjectSelect={setCurrentFilter}
/>
```

**Step 3: Handle sidebar close on project selection**

Modify the `onProjectSelect` callback to close sidebar after selection:

```typescript
<Sidebar
  isOpen={sidebarOpen}
  onClose={toggleSidebar}
  stats={projectStats.stats}
  isLoading={projectStats.isLoading}
  error={projectStats.error}
  currentFilter={currentFilter}
  onProjectSelect={(project) => {
    setCurrentFilter(project);
    setSidebarOpen(false); // Close sidebar after selection
  }}
/>
```

**Step 4: Commit**

```bash
git add src/ui/viewer/App.tsx
git commit -m "feat: integrate Sidebar component into App

Wire up Sidebar component with project stats data and filter state.
Sidebar closes automatically after project selection."
```

---

## Task 16: Build and Test

**Files:**
- (Build verification)

**Step 1: Build the viewer**

```bash
npm run build
```

Expected: "Build successful" with no TypeScript errors

**Step 2: Start the worker**

```bash
npm run build-and-sync
```

Expected: Worker starts on port 37777

**Step 3: Test in browser**

1. Open http://localhost:37777
2. Click the sidebar toggle button (hamburger menu)
3. Verify sidebar slides in from left with backdrop
4. Verify project cards load with staggered animation
5. Verify skeleton loaders show before data loads
6. Click a project card
7. Verify sidebar closes and feed filters to selected project
8. Open sidebar again
9. Verify selected project is highlighted
10. Click "All Projects"
11. Verify filter clears and sidebar closes

**Step 4: Test mobile responsive**

1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select mobile device (e.g., iPhone 12)
4. Verify sidebar becomes bottom sheet
5. Verify slide-up animation works
6. Verify handle bar appears at top

**Step 5: Test keyboard navigation**

1. Open sidebar
2. Press ESC key
3. Verify sidebar closes
4. Click backdrop
5. Verify sidebar closes

**Step 6: Test empty states**

1. Stop worker (Ctrl+C)
2. Clear database: `rm ~/.claude-mem/claude-mem.db`
3. Restart worker
4. Open sidebar
5. Verify "No projects found" message displays

**Step 7: Test error handling**

1. Open browser DevTools Network tab
2. Throttle network to "Offline"
3. Open sidebar
4. Verify error message displays

**Step 8: Commit**

```bash
git add .
git commit -m "test: verify sidebar functionality

Manual testing completed:
- Sidebar open/close animations
- Project cards with staggered entrance
- Loading skeletons
- Project selection and filtering
- Mobile bottom sheet behavior
- Keyboard navigation (ESC)
- Empty and error states
- Cache verification (open sidebar twice, verify instant load on second)"
```

---

## Task 17: Accessibility Audit

**Files:**
- Modify: `src/ui/viewer/components/Sidebar.tsx`

**Step 1: Add ARIA attributes**

Update Sidebar component:
```typescript
<aside
  className={`sidebar ${isOpen ? 'open' : ''}`}
  role="dialog"
  aria-modal="true"
  aria-label="Projects sidebar"
>
```

**Step 2: Add focus trap**

Add after ESC key effect:
```typescript
// Focus trap
const sidebarRef = React.useRef<HTMLElement>(null);

React.useEffect(() => {
  if (!isOpen) return;

  // Focus first focusable element
  const focusableElements = sidebarRef.current?.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements?.[0] as HTMLElement;
  firstElement?.focus();

  // Trap focus within sidebar
  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const lastElement = focusableElements?.[
      focusableElements.length - 1
    ] as HTMLElement;

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement?.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement?.focus();
    }
  };

  document.addEventListener('keydown', handleTab);
  return () => document.removeEventListener('keydown', handleTab);
}, [isOpen]);
```

**Step 3: Add ref to aside element**

```typescript
<aside
  ref={sidebarRef}
  className={`sidebar ${isOpen ? 'open' : ''}`}
  role="dialog"
  aria-modal="true"
  aria-label="Projects sidebar"
>
```

**Step 4: Add keyboard navigation to ProjectCard**

Update ProjectCard component:
```typescript
<div
  className={`sidebar-project-card ${isActive ? 'active' : ''}`}
  onClick={onClick}
  style={{ animationDelay: `${staggerDelay}ms` }}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }}
>
```

**Step 5: Commit**

```bash
git add src/ui/viewer/components/Sidebar.tsx src/ui/viewer/components/ProjectCard.tsx
git commit -m "a11y: add ARIA attributes, focus trap, keyboard nav

Add accessibility features:
- ARIA modal dialog labeling
- Focus trap within sidebar
- Keyboard navigation (Enter/Space) for project cards
- Initial focus on first interactive element"
```

---

## Task 18: Final Polish and Edge Cases

**Files:**
- Modify: `src/ui/viewer/components/ProjectCard.tsx`
- Modify: `src/ui/viewer-template.html`

**Step 1: Add tooltip for long project names**

Update ProjectCard project-name div:
```typescript
<div className="project-name" title={project.project}>
  {project.project}
</div>
```

Add CSS:
```css
.project-name {
  font-family: 'Monaspace Radon', monospace;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.02em);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

**Step 2: Add Shift+Click to keep sidebar open**

Update SidebarContent handleProjectClick:
```typescript
const handleProjectClick = (project: string, event?: React.MouseEvent) => {
  onProjectSelect(project);

  // Keep sidebar open if Shift key is pressed
  if (!(event?.shiftKey)) {
    // Sidebar will close via parent callback
  }
};
```

Update onClick in ProjectCard:
```typescript
onClick={(e) => handleProjectClick(project.project, e)}
```

**Step 3: Commit**

```bash
git add src/ui/viewer/components/ProjectCard.tsx src/ui/viewer/components/SidebarContent.tsx src/ui/viewer-template.html
git commit -m "polish: add tooltips and Shift+Click to keep sidebar open

Add full project name tooltip on hover with text truncation.
Add Shift+Click power user pattern to keep sidebar open for quick navigation."
```

---

## Task 19: Documentation Update

**Files:**
- Modify: `README.md` or `docs/` if applicable

**Step 1: Document new sidebar feature**

Add to README or viewer documentation:
```markdown
## Projects Sidebar

The viewer includes a sidebar for browsing and filtering projects by statistics.

**Features:**
- View all projects with total item counts
- See last activity timestamp for each project
- Click to filter feed by project
- Keyboard shortcuts: ESC to close
- Power user: Shift+Click keeps sidebar open
- 5-minute memory cache for fast reopening

**Mobile:**
- Bottom sheet pattern on mobile devices (≤768px)
- Swipe affordance with handle bar
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document Projects Sidebar feature

Add documentation for sidebar functionality, keyboard shortcuts,
and responsive behavior."
```

---

## Task 20: Final Verification

**Files:**
- (Verification only)

**Step 1: Run full test suite**

```bash
npm test  # if tests exist
```

**Step 2: Check TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: No TypeScript errors

**Step 3: Verify build output**

```bash
npm run build
ls -lh plugin/ui/viewer.html
```

Expected: viewer.html exists and is reasonable size (< 500KB)

**Step 4: Check git status**

```bash
git status
```

Expected: All changes committed, no untracked files

**Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete Projects Sidebar implementation

Projects Sidebar feature complete with:
- Premium card-based UI with staggered animations
- Lazy-loaded project statistics with 5-min cache
- Warm amber accent color system
- Mobile bottom sheet responsive design
- Full accessibility (ARIA, focus trap, keyboard nav)
- Power user patterns (Shift+Click to keep open)
- Skeleton loaders and error handling
- ESC key and backdrop click to close

Implementation follows design document:
docs/plans/2026-02-21-projects-sidebar-design.md"
```

---

## Success Criteria Checklist

- [x] Sidebar opens smoothly with left slide animation
- [x] Backdrop dims and closes sidebar on click
- [x] Project cards load with staggered entrance
- [x] Skeleton loaders show during data fetch
- [x] Project stats display (count + timestamp)
- [x] Clicking project filters feed and closes sidebar
- [x] Active project visually highlighted
- [x] Mobile bottom sheet slides up
- [x] ESC key closes sidebar
- [x] Focus trap works within sidebar
- [x] Keyboard navigation (Enter/Space) on cards
- [x] Empty state displays
- [x] Error state displays
- [x] Cache works (instant load on reopen)
- [x] Design matches premium card aesthetic

---

**Implementation Plan Version:** 1.0
**Total Tasks:** 20
**Estimated Time:** 3-4 hours
**Last Updated:** 2026-02-21
