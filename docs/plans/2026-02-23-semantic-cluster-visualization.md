# Semantic Cluster Visualization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a 2D scatter plot visualization that displays project memories positioned by semantic similarity using UMAP-projected embeddings from ChromaDB.

**Architecture:** New VisualizationRoutes API endpoint fetches embeddings from ChromaDB, applies UMAP projection server-side, caches results in SQLite, and serves to React frontend which renders using Canvas API for performance.

**Tech Stack:** UMAP (umap-js npm package), Canvas API, React hooks, TypeScript, Express.js, SQLite

---

## Task 1: Add Database Migration for Visualization Embeddings Cache

**Files:**
- Create: `src/services/sqlite/migrations/add_visualization_embeddings.sql`

**Step 1: Write the migration SQL**

Create the migration file:
```sql
-- Migration: Add visualization_embeddings table for caching UMAP projections
-- Created: 2026-02-23

CREATE TABLE IF NOT EXISTS visualization_embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  observation_id INTEGER NOT NULL,
  project TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  projection_method TEXT DEFAULT 'umap',
  created_at_epoch INTEGER NOT NULL,
  FOREIGN KEY (observation_id) REFERENCES observations(id),
  UNIQUE(observation_id, project, projection_method)
);

CREATE INDEX IF NOT EXISTS idx_viz_obs_project ON visualization_embeddings(observation_id, project);
CREATE INDEX IF NOT EXISTS idx_viz_project ON visualization_embeddings(project);
```

**Step 2: Run migration to verify syntax**

Run: `sqlite3 ~/.claude-mem/claude-mem.db < src/services/sqlite/migrations/add_visualization_embeddings.sql`
Expected: No errors, table created

**Step 3: Verify table creation**

Run: `sqlite3 ~/.claude-mem/claude-mem.db ".schema visualization_embeddings"`
Expected: Shows table schema

**Step 4: Commit**

```bash
git add src/services/sqlite/migrations/add_visualization_embeddings.sql
git commit -m "feat: add visualization_embeddings cache table"
```

---

## Task 2: Install UMAP Dependency

**Files:**
- Modify: `package.json`

**Step 1: Add umap-js to dependencies**

Run: `npm install umap-js`
Expected: Package added to package.json and node_modules

**Step 2: Verify installation**

Run: `npm list umap-js`
Expected: Shows umap-js version

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add umap-js for dimensionality reduction"
```

---

## Task 3: Create VisualizationService for UMAP Projections

**Files:**
- Create: `src/services/worker/VisualizationService.ts`

**Step 1: Write the VisualizationService class**

Create `src/services/worker/VisualizationService.ts`:
```typescript
import { UMAP } from 'umap-js';
import { DatabaseManager } from './DatabaseManager.js';
import { ChromaMcpManager } from '../sync/ChromaMcpManager.js';
import { logger } from '../../utils/logger.js';

interface ProjectedPoint {
  id: number;
  x: number;
  y: number;
  type: string;
  title: string;
  subtitle?: string;
  date: string;
  concepts: string[];
  session_id: string;
}

interface VisualizationResponse {
  points: ProjectedPoint[];
  metadata: {
    total_points: number;
    projection_method: 'umap';
    embedding_model: string;
  };
}

export class VisualizationService {
  private dbManager: DatabaseManager;
  private chromaManager: ChromaMcpManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
    this.chromaManager = ChromaMcpManager.getInstance();
  }

  /**
   * Get UMAP-projected embeddings for a project
   */
  async getProjectedEmbeddings(project: string): Promise<VisualizationResponse> {
    const collectionName = this.getCollectionName(project);

    // Try to get cached projections first
    const cached = await this.getCachedProjections(project);
    if (cached && cached.length > 0) {
      logger.info('VISUALIZATION', `Using cached projections for ${project}`, { count: cached.length });
      return {
        points: cached,
        metadata: {
          total_points: cached.length,
          projection_method: 'umap',
          embedding_model: 'chroma-default'
        }
      };
    }

    // Fetch embeddings from ChromaDB
    const embeddings = await this.fetchEmbeddingsFromChroma(project, collectionName);

    if (embeddings.length === 0) {
      logger.warn('VISUALIZATION', `No embeddings found for ${project}`);
      return {
        points: [],
        metadata: {
          total_points: 0,
          projection_method: 'umap',
          embedding_model: 'chroma-default'
        }
      };
    }

    // Apply UMAP projection
    logger.info('VISUALIZATION', `Computing UMAP projection for ${project}`, { count: embeddings.length });
    const points = await this.applyUMAPProjection(embeddings);

    // Cache projections
    await this.cacheProjections(project, points);

    return {
      points,
      metadata: {
        total_points: points.length,
        projection_method: 'umap',
        embedding_model: 'chroma-default'
      }
    };
  }

  /**
   * Fetch embeddings from ChromaDB collection
   */
  private async fetchEmbeddingsFromChroma(project: string, collectionName: string): Promise<any[]> {
    try {
      const result = await this.chromaManager.callTool('chroma_get_documents', {
        collection_name: collectionName,
        limit: 10000,
        offset: 0,
        include: ['embeddings', 'metadatas', 'documents']
      });

      if (!result || !Array.isArray(result.data)) {
        logger.warn('VISUALIZATION', `Invalid Chroma response for ${project}`);
        return [];
      }

      return result.data.map((doc: any) => ({
        id: doc.metadata?.sqlite_id || parseInt(doc.id.split('_')[1]) || 0,
        embedding: doc.embedding,
        type: doc.metadata?.type || 'unknown',
        title: doc.metadata?.title || '',
        subtitle: doc.metadata?.subtitle || '',
        date: new Date(doc.metadata?.created_at_epoch || Date.now()).toISOString(),
        concepts: doc.metadata?.concepts?.split(',').filter(Boolean) || [],
        session_id: doc.metadata?.memory_session_id || ''
      })).filter((item: any) => item.id > 0 && item.embedding);
    } catch (error) {
      logger.error('VISUALIZATION', `Failed to fetch embeddings from Chroma`, { error, project });
      return [];
    }
  }

  /**
   * Apply UMAP projection to embeddings
   */
  private async applyUMAPProjection(embeddings: any[]): Promise<ProjectedPoint[]> {
    const vectors = embeddings.map(e => e.embedding);
    const nNeighbors = Math.min(15, Math.floor(vectors.length / 2));

    const umap = new UMAP({
      nNeighbors: Math.max(2, nNeighbors),
      minDist: 0.1,
      nComponents: 2,
      metric: 'cosine'
    });

    const projection = umap.fit(vectors);

    return embeddings.map((item, index) => ({
      id: item.id,
      x: projection[index][0],
      y: projection[index][1],
      type: item.type,
      title: item.title,
      subtitle: item.subtitle,
      date: item.date,
      concepts: item.concepts,
      session_id: item.session_id
    }));
  }

  /**
   * Get cached projections from SQLite
   */
  private async getCachedProjections(project: string): Promise<ProjectedPoint[]> {
    const db = this.dbManager.getSessionStore().db;

    const rows = db.prepare(`
      SELECT
        ve.observation_id as id,
        ve.x,
        ve.y,
        o.type,
        o.title,
        o.subtitle,
        datetime(o.created_at_epoch / 1000, 'unixepoch') as date,
        o.concepts,
        o.memory_session_id as session_id
      FROM visualization_embeddings ve
      JOIN observations o ON ve.observation_id = o.id
      WHERE ve.project = ? AND ve.projection_method = 'umap'
      ORDER BY o.created_at_epoch DESC
    `).all(project) as any[];

    return rows.map(row => ({
      ...row,
      concepts: row.concepts ? JSON.parse(row.concepts) : []
    }));
  }

  /**
   * Cache projections in SQLite
   */
  private async cacheProjections(project: string, points: ProjectedPoint[]): Promise<void> {
    const db = this.dbManager.getSessionStore().db;
    const now = Date.now();

    const insert = db.prepare(`
      INSERT OR REPLACE INTO visualization_embeddings
      (observation_id, project, x, y, projection_method, created_at_epoch)
      VALUES (?, ?, ?, ?, 'umap', ?)
    `);

    const insertMany = db.transaction((points: ProjectedPoint[]) => {
      for (const point of points) {
        insert.run(point.id, project, point.x, point.y, now);
      }
    });

    insertMany(points);
    logger.info('VISUALIZATION', `Cached ${points.length} projections for ${project}`);
  }

  /**
   * Get Chroma collection name for project
   */
  private getCollectionName(project: string): string {
    // Match the sanitization logic from ChromaSync
    return `cm__${project.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  }
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit src/services/worker/VisualizationService.ts`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/services/worker/VisualizationService.ts
git commit -m "feat: add VisualizationService for UMAP projections"
```

---

## Task 4: Create VisualizationRoutes API Endpoint

**Files:**
- Create: `src/services/worker/http/routes/VisualizationRoutes.ts`
- Modify: `src/services/worker/worker-service.ts` (to register routes)

**Step 1: Write VisualizationRoutes class**

Create `src/services/worker/http/routes/VisualizationRoutes.ts`:
```typescript
import express, { Request, Response } from 'express';
import { VisualizationService } from '../../VisualizationService.js';
import { BaseRouteHandler } from '../BaseRouteHandler.js';

export class VisualizationRoutes extends BaseRouteHandler {
  constructor(
    private visualizationService: VisualizationService
  ) {
    super();
  }

  setupRoutes(app: express.Application): void {
    app.get('/api/visualization/embeddings', this.handleGetEmbeddings.bind(this));
  }

  /**
   * Get UMAP-projected embeddings for visualization
   * GET /api/visualization/embeddings?project={name}
   */
  private handleGetEmbeddings = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const { project } = req.query;

    if (!project || typeof project !== 'string') {
      this.badRequest(res, 'project parameter is required');
      return;
    }

    const result = await this.visualizationService.getProjectedEmbeddings(project);
    res.json(result);
  });
}
```

**Step 2: Register routes in worker-service.ts**

Modify `src/services/worker/worker-service.ts` to instantiate and register VisualizationRoutes. Find the route registration section and add:

```typescript
import { VisualizationRoutes } from './http/routes/VisualizationRoutes.js';
import { VisualizationService } from './VisualizationService.js';

// In constructor, after other route handlers:
private visualizationService: VisualizationService;
// In constructor body:
this.visualizationService = new VisualizationService(this.dbManager);

// In setupRoutes() method, after other routes:
const visualizationRoutes = new VisualizationRoutes(this.visualizationService);
visualizationRoutes.setupRoutes(app);
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 4: Build and test**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/services/worker/http/routes/VisualizationRoutes.ts src/services/worker/worker-service.ts
git commit -m "feat: add visualization embeddings API endpoint"
```

---

## Task 5: Create React Hook for Visualization Data

**Files:**
- Create: `src/ui/viewer/hooks/useVisualization.ts`

**Step 1: Write useVisualization hook**

Create `src/ui/viewer/hooks/useVisualization.ts`:
```typescript
import { useState, useEffect } from 'react';

interface ProjectedPoint {
  id: number;
  x: number;
  y: number;
  type: string;
  title: string;
  subtitle?: string;
  date: string;
  concepts: string[];
  session_id: string;
}

interface VisualizationResponse {
  points: ProjectedPoint[];
  metadata: {
    total_points: number;
    projection_method: string;
    embedding_model: string;
  };
}

export function useVisualization(project: string | null) {
  const [data, setData] = useState<VisualizationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) {
      setData(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/visualization/embeddings?project=${encodeURIComponent(project)}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result: VisualizationResponse = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load visualization data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [project]);

  return { data, loading, error };
}
```

**Step 2: Commit**

```bash
git add src/ui/viewer/hooks/useVisualization.ts
git commit -m "feat: add useVisualization hook"
```

---

## Task 6: Create VectorMap Canvas Component

**Files:**
- Create: `src/ui/viewer/components/VectorMap.tsx`

**Step 1: Write VectorMap component**

Create `src/ui/viewer/components/VectorMap.tsx`:
```typescript
import React, { useRef, useEffect, useState } from 'react';

interface ProjectedPoint {
  id: number;
  x: number;
  y: number;
  type: string;
  title: string;
  date: string;
  concepts: string[];
}

interface VectorMapProps {
  points: ProjectedPoint[];
  colorScheme: 'type' | 'recency' | 'concepts';
  onPointClick?: (point: ProjectedPoint) => void;
  onPointHover?: (point: ProjectedPoint | null) => void;
}

const TYPE_COLORS: Record<string, string> = {
  decision: '#3b82f6',
  bugfix: '#ef4444',
  feature: '#22c55e',
  refactor: '#eab308',
  discovery: '#a855f7',
  change: '#6b7280'
};

export function VectorMap({ points, colorScheme, onPointClick, onPointHover }: VectorMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [transform, setTransform] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredPoint, setHoveredPoint] = useState<ProjectedPoint | null>(null);

  // Handle canvas interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (points.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No memories to visualize', rect.width / 2, rect.height / 2);
      return;
    }

    // Normalize points to fit canvas
    const xValues = points.map(p => p.x);
    const yValues = points.map(p => p.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    const padding = 40;
    const scaleX = (rect.width - padding * 2) / (maxX - minX || 1);
    const scaleY = (rect.height - padding * 2) / (maxY - minY || 1);
    const scale = Math.min(scaleX, scaleY);

    const centerX = (rect.width - padding * 2) / 2;
    const centerY = (rect.height - padding * 2) / 2;

    const transformPoint = (point: ProjectedPoint) => ({
      x: padding + (point.x - minX) * scale * transform.scale + transform.offsetX + centerX - (maxX - minX) * scale / 2,
      y: padding + (point.y - minY) * scale * transform.scale + transform.offsetY + centerY - (maxY - minY) * scale / 2
    });

    // Draw points
    points.forEach(point => {
      const { x, y } = transformPoint(point);
      const isHovered = hoveredPoint?.id === point.id;

      ctx.beginPath();
      ctx.arc(x, y, isHovered ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = getPointColor(point, colorScheme);
      ctx.fill();

      if (isHovered) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Draw tooltip for hovered point
    if (hoveredPoint) {
      const { x, y } = transformPoint(hoveredPoint);
      drawTooltip(ctx, x, y, hoveredPoint);
    }
  }, [points, transform, colorScheme, hoveredPoint]);

  // Get point color based on scheme
  const getPointColor = (point: ProjectedPoint, scheme: string): string => {
    if (scheme === 'type') {
      return TYPE_COLORS[point.type] || '#6b7280';
    }
    if (scheme === 'recency') {
      const age = Date.now() - new Date(point.date).getTime();
      const daysOld = age / (1000 * 60 * 60 * 24);
      if (daysOld < 7) return '#22c55e';
      if (daysOld < 30) return '#eab308';
      return '#6b7280';
    }
    return '#3b82f6';
  };

  // Draw tooltip
  const drawTooltip = (ctx: CanvasRenderingContext2D, x: number, y: number, point: ProjectedPoint) => {
    const padding = 8;
    const text = `${point.title.substring(0, 50)}${point.title.length > 50 ? '...' : ''}`;
    ctx.font = '12px sans-serif';
    const textWidth = ctx.measureText(text).width;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(x + 12, y - 12, textWidth + padding * 2, 24);

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 12 + padding, y + 4);
  };

  // Handle mouse move for hover and drag
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDragging) {
      setTransform(prev => ({
        ...prev,
        offsetX: prev.offsetX + (mouseX - dragStart.x),
        offsetY: prev.offsetY + (mouseY - dragStart.y)
      }));
      setDragStart({ x: mouseX, y: mouseY });
      return;
    }

    // Find hovered point
    const xValues = points.map(p => p.x);
    const yValues = points.map(p => p.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    const padding = 40;
    const scaleX = (rect.width - padding * 2) / (maxX - minX || 1);
    const scaleY = (rect.height - padding * 2) / (maxY - minY || 1);
    const scale = Math.min(scaleX, scaleY);

    const centerX = (rect.width - padding * 2) / 2;
    const centerY = (rect.height - padding * 2) / 2;

    let found: ProjectedPoint | null = null;
    for (const point of points) {
      const x = padding + (point.x - minX) * scale * transform.scale + transform.offsetX + centerX - (maxX - minX) * scale / 2;
      const y = padding + (point.y - minY) * scale * transform.scale + transform.offsetY + centerY - (maxY - minY) * scale / 2;
      const dist = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
      if (dist < 10) {
        found = point;
        break;
      }
    }

    setHoveredPoint(found);
    onPointHover?.(found);
  };

  // Handle click
  const handleClick = () => {
    if (hoveredPoint) {
      onPointClick?.(hoveredPoint);
    }
  };

  // Handle wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(10, prev.scale * delta))
    }));
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={(e) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - e.currentTarget.getBoundingClientRect().left, y: e.clientY - e.currentTarget.getBoundingClientRect().top });
      }}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => {
        setIsDragging(false);
        setHoveredPoint(null);
        onPointHover?.(null);
      }}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onWheel={handleWheel}
      className="w-full h-full cursor-crosshair"
      style={{ touchAction: 'none' }}
    />
  );
}
```

**Step 2: Commit**

```bash
git add src/ui/viewer/components/VectorMap.tsx
git commit -m "feat: add VectorMap canvas component"
```

---

## Task 7: Create Visualization Page Component

**Files:**
- Create: `src/ui/viewer/components/Visualization.tsx`

**Step 1: Write Visualization component**

Create `src/ui/viewer/components/Visualization.tsx`:
```typescript
import React, { useState } from 'react';
import { useVisualization } from '../hooks/useVisualization';
import { VectorMap } from './VectorMap';
import { ObservationCard } from './ObservationCard';

export function Visualization({ project, onBack }: { project: string; onBack: () => void }) {
  const { data, loading, error } = useVisualization(project);
  const [colorScheme, setColorScheme] = useState<'type' | 'recency' | 'concepts'>('type');
  const [selectedPoint, setSelectedPoint] = useState<any>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading visualization...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (!data || data.points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-gray-400">No memories to visualize for this project</div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Feed
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main visualization area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
            >
              ← Back
            </button>
            <h2 className="text-lg font-semibold">Semantic Clusters: {project}</h2>
            <span className="text-sm text-gray-500">{data.metadata.total_points} memories</span>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              Color by:
              <select
                value={colorScheme}
                onChange={(e) => setColorScheme(e.target.value as any)}
                className="px-2 py-1 border rounded bg-gray-50 dark:bg-gray-900"
              >
                <option value="type">Type</option>
                <option value="recency">Recency</option>
                <option value="concepts">Concepts</option>
              </select>
            </label>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <VectorMap
            points={data.points}
            colorScheme={colorScheme}
            onPointClick={setSelectedPoint}
          />
        </div>
      </div>

      {/* Detail panel */}
      {selectedPoint && (
        <div className="w-96 border-l border-gray-200 dark:border-gray-800 overflow-y-auto">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
            <h3 className="font-semibold">Memory Details</h3>
            <button
              onClick={() => setSelectedPoint(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="p-4">
            <div className="mb-2">
              <span className="text-xs uppercase text-gray-500">Type</span>
              <div className="font-medium">{selectedPoint.type}</div>
            </div>
            <div className="mb-2">
              <span className="text-xs uppercase text-gray-500">Title</span>
              <div className="font-medium">{selectedPoint.title}</div>
            </div>
            {selectedPoint.subtitle && (
              <div className="mb-2">
                <span className="text-xs uppercase text-gray-500">Subtitle</span>
                <div className="text-sm">{selectedPoint.subtitle}</div>
              </div>
            )}
            <div className="mb-4">
              <span className="text-xs uppercase text-gray-500">Date</span>
              <div className="text-sm">{new Date(selectedPoint.date).toLocaleString()}</div>
            </div>
            {selectedPoint.concepts.length > 0 && (
              <div className="mb-4">
                <span className="text-xs uppercase text-gray-500">Concepts</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedPoint.concepts.map((concept: string, i: number) => (
                    <span key={i} className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 rounded">
                      {concept}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/ui/viewer/components/Visualization.tsx
git commit -m "feat: add Visualization page component"
```

---

## Task 8: Add Visualization Route to App

**Files:**
- Modify: `src/ui/viewer/App.tsx`

**Step 1: Add view state and routing**

Modify `src/ui/viewer/App.tsx`:
- Add state for current view: `const [currentView, setCurrentView] = useState<'feed' | 'visualization'>('feed');`
- Import Visualization component
- Add conditional rendering to show Visualization or Feed

```typescript
import { Visualization } from './components/Visualization';

// In App component, after state declarations:
const [currentView, setCurrentView] = useState<'feed' | 'visualization'>('feed');

// In return, replace main content area:
{currentView === 'visualization' ? (
  <Visualization
    project={currentFilter}
    onBack={() => setCurrentView('feed')}
  />
) : (
  <Feed ... />
)}
```

**Step 2: Add navigation button to Header**

Modify `src/ui/viewer/components/Header.tsx` to add visualization button:
```typescript
// Add to header, near other controls:
<button
  onClick={() => setCurrentView('visualization')}
  disabled={!currentFilter}
  className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
>
  Visualize
</button>
```

**Step 3: Commit**

```bash
git add src/ui/viewer/App.tsx src/ui/viewer/components/Header.tsx
git commit -m "feat: add visualization navigation to viewer"
```

---

## Task 9: Build and Test End-to-End

**Files:**
- Build: `dist/` and `plugin/`

**Step 1: Build the project**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Sync to marketplace**

Run: `npm run sync-marketplace`
Expected: Sync completes successfully

**Step 3: Restart worker**

Run: `npm run worker:restart`
Expected: Worker restarts successfully

**Step 4: Test in browser**

1. Open http://localhost:37777
2. Select a project from the sidebar
3. Click the "Visualize" button in the header
4. Verify:
   - Scatter plot appears with points
   - Points are colored by type
   - Hovering shows tooltips
   - Clicking a point opens detail panel
   - Pan/zoom works with mouse drag and scroll
   - Color scheme dropdown works
   - Back button returns to feed

**Step 5: Commit**

```bash
git commit --allow-empty -m "test: verify visualization feature works end-to-end"
```

---

## Task 10: Add Error Handling and Edge Cases

**Files:**
- Modify: `src/services/worker/VisualizationService.ts`
- Modify: `src/ui/viewer/components/Visualization.tsx`

**Step 1: Add ChromaDB unavailable handling**

Modify `VisualizationService.ts` to handle ChromaDB errors gracefully:
```typescript
private async fetchEmbeddingsFromChroma(project: string, collectionName: string): Promise<any[]> {
  try {
    // Check if Chroma is available first
    await this.chromaManager.callTool('chroma_list_collections', { limit: 1 });

    const result = await this.chromaManager.callTool('chroma_get_documents', {
      collection_name: collectionName,
      limit: 10000,
      offset: 0,
      include: ['embeddings', 'metadatas', 'documents']
    });

    // ... rest of method
  } catch (error) {
    logger.error('VISUALIZATION', `ChromaDB unavailable`, { error, project });
    throw new Error('Vector database unavailable. Please ensure ChromaDB is running.');
  }
}
```

**Step 2: Add empty state for no embeddings**

Modify `Visualization.tsx` to show helpful empty state:
```typescript
if (!data || data.points.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="text-gray-400">
        No embeddings found for project "{project}".
        <br />
        Memories may still be syncing to vector database.
      </div>
      <button
        onClick={onBack}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Back to Feed
      </button>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/services/worker/VisualizationService.ts src/ui/viewer/components/Visualization.tsx
git commit -m "feat: improve error handling for visualization"
```

---

## Success Criteria

After implementation, verify:

- ✅ API endpoint `/api/visualization/embeddings?project=X` returns projected points
- ✅ UMAP projections are cached in `visualization_embeddings` table
- ✅ Viewer shows 2D scatter plot for projects with embeddings
- ✅ Points are colored correctly by type/recency
- ✅ Hover shows tooltips with memory title
- ✅ Click opens detail panel with full metadata
- ✅ Pan (drag) and zoom (scroll) work smoothly
- ✅ Color scheme dropdown changes point colors
- ✅ Empty state shows when no embeddings exist
- ✅ Error handling works when ChromaDB is unavailable
