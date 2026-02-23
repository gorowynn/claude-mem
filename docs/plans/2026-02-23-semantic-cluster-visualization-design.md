# Semantic Memory Cluster Visualization Design

**Date:** 2026-02-23
**Status:** Design Approved
**Author:** Claude + User Collaboration

## Overview

A dedicated visualization page at `/visualization` that displays project memories as a 2D scatter plot, where points are positioned by semantic similarity using dimensionality-reduced embeddings from ChromaDB. This enables users to explore semantic clusters and discover related work across their development history.

## Goals

- **Primary:** Enable exploration of semantic clusters to discover related memories
- **Secondary:** Provide interactive filtering and detail viewing
- **Tertiary:** Foundation for future visualization types (network graphs, timelines)

## Architecture

### High-Level Flow

```
Viewer UI → API Request → Worker Service → ChromaDB Query → UMAP Projection → Response → Canvas Rendering
```

### Components

1. **Backend API** - New route for embedding projections
2. **Frontend Component** - Main visualization container
3. **Canvas Renderer** - Performant 2D scatter plot rendering

## Data Model

### API Endpoint

**Request:**
```
GET /api/visualization/embeddings?project={name}&limit={number}
```

**Response:**
```typescript
interface VisualizationResponse {
  points: Array<{
    id: number;           // Observation ID
    x: number;           // UMAP-projected X coordinate
    y: number;           // UMAP-projected Y coordinate
    type: string;        // observation type
    title: string;
    subtitle?: string;
    date: string;        // ISO timestamp
    concepts: string[];
    session_id: string;
  }>;
  metadata: {
    total_points: number;
    projection_method: 'umap';
    embedding_model: string;
  };
}
```

### Database Schema Addition

**New Table: `visualization_embeddings`**
```sql
CREATE TABLE visualization_embeddings (
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
```

## Component Structure

### Visualization.tsx (Main Container)

```
├── Header
│   ├── Project selector (syncs with main feed)
│   ├── Color scheme dropdown (Type | Recency | Concepts)
│   └── Export button (PNG/SVG)
├── Main Content
│   ├── VectorMap.tsx (Canvas rendering)
│   │   ├── Zoom/pan controls
│   │   ├── Point hover tooltips
│   │   └── Selection highlighting
│   └── Detail Panel (Sidebar)
│       ├── Selected point details
│       ├── Related observations list
│       └── "View in feed" link
└── Filters (Bottom bar)
    ├── Type toggles (checkboxes)
    ├── Date range slider
    └── Search within visible
```

## Key Features

### 1. Dimensionality Reduction (UMAP)

**Implementation:**
- Fetch raw embeddings from ChromaDB for project collection
- Apply UMAP to project to 2D coordinates
  - Parameters: `n_neighbors=15`, `min_dist=0.1`
- Cache projected coordinates in SQLite
- Recompute when new observations are added

**Dependencies:**
- `umap-js` for client-side or `python-umap-learn` via MCP for server-side

### 2. Interactive Exploration

- **Pan/Zoom**: Mouse drag to pan, scroll to zoom
- **Hover**: Show quick tooltip with title + type + date
- **Click**: Open detail panel with full narrative + facts
- **Lasso**: Drag to select multiple points (future enhancement)

### 3. Color Schemes

- **By Type**: Decision=blue, Bugfix=red, Feature=green, Refactor=yellow, Discovery=purple, Change=gray
- **By Recency**: Gradient from old (gray) to new (bright accent)
- **By Concepts**: Top 5 most common concepts get unique colors, others gray

### 4. Filters

- Type checkboxes (multi-select)
- Date range slider (last 7/30/90 days or custom)
- Text search (filters visible points)

## Data Flow Details

### Initial Load

1. User navigates to `/visualization`
2. Component fetches embeddings for current project
3. API returns pre-computed UMAP coordinates or computes fresh
4. Canvas renders all points with default color scheme

### Projection Computation (Server-Side)

1. Query ChromaDB for all embeddings in project collection
2. Extract vectors and metadata
3. Run UMAP projection
4. Store results in `visualization_embeddings` table
5. Return to client

### Point Selection

1. User clicks point → show detail panel
2. Detail panel fetches full observation via `/api/observation/:id`
3. "Related" section queries semantically similar points via ChromaDB

## Performance Considerations

### For Large Projects (1000+ points)

- Use Canvas API instead of SVG for rendering
- Implement quadtree for efficient hover detection
- Level-of-detail: simplified circles when zoomed out
- Virtual rendering: only draw visible viewport

### Projection Caching

- Store UMAP results in `visualization_embeddings` table
- Invalidate cache when new observations added
- Background re-computation to avoid blocking UI

### Rendering Optimization

- RequestAnimationFrame for smooth zoom/pan
- Offscreen canvas for pre-rendering static elements
- Debounced search/filter updates

## Error Handling

| Error Scenario | Handling Strategy |
|----------------|-------------------|
| No embeddings for project | Show empty state: "No memories to visualize yet" |
| UMAP computation fails | Fall back to PCA with warning banner |
| ChromaDB unavailable | Show error, offer link to chronological feed |
| Too many points (>5000) | Offer sampling or require date filter |

## Dependencies

### Backend

- `umap-js` (if client-side projection) or MCP to Python `umap-learn`
- Express.js route handler

### Frontend

- `umap-js` (if client-side)
- Canvas API (native)
- React hooks for state management

## Testing Strategy

### Unit Tests

- UMAP projection computation
- Coordinate caching logic
- Point-in-circle detection for hover
- Quadtree spatial queries

### Integration Tests

- API endpoint returns valid 2D coordinates
- Canvas renders correct number of points
- Filtering updates visible points correctly
- Color scheme changes render correctly

### E2E Tests

- Navigate to visualization page
- Click point and verify detail panel
- Change color scheme and verify update
- Filter by type and verify points hidden/shown

## Implementation Phases

### Phase 1: MVP (Minimal Viable Product)
- [ ] Create API endpoint for embedding projections
- [ ] Implement basic UMAP projection
- [ ] Build Canvas scatter plot component
- [ ] Add hover tooltips
- [ ] Add point click → detail panel

### Phase 2: Interactivity
- [ ] Implement pan/zoom controls
- [ ] Add color scheme switching
- [ ] Add type filters
- [ ] Add date range filter

### Phase 3: Polish
- [ ] Add search within visible points
- [ ] Add export functionality
- [ ] Add related observations in detail panel
- [ ] Performance optimization for large projects

### Phase 4: Advanced Features
- [ ] Lasso selection
- [ ] 3D toggle
- [ ] Animation playback
- [ ] Comparison mode

## Future Enhancements

- **3D view**: Toggle between 2D/3D using UMAP with 3 components
- **Animation**: Play button to show memories appearing over time
- **Export**: Download as PNG/SVG
- **Comparison mode**: Side-by-side project comparison
- **Clustering**: Auto-draw boundaries around dense clusters
- **Network graph**: Add optional connection lines between related points

## File Structure

```
src/
├── services/
│   └── worker/
│       └── http/
│           └── routes/
│               └── VisualizationRoutes.ts    [NEW]
├── services/
│   └── sqlite/
│       └── migrations/
│           └── add_visualization_embeddings.sql  [NEW]
└── ui/
    └── viewer/
        ├── components/
        │   ├── Visualization.tsx              [NEW]
        │   ├── VectorMap.tsx                  [NEW]
        │   └── DetailPanel.tsx                [NEW]
        └── pages/
            └── VisualizationPage.tsx          [NEW]
```

## Success Criteria

- ✅ User can view project memories as 2D scatter plot
- ✅ Points positioned by semantic similarity (validated via cluster inspection)
- ✅ Interactive pan/zoom works smoothly
- ✅ Clicking point shows observation details
- ✅ Performance acceptable for projects with up to 1000 observations
- ✅ Design matches existing viewer UI aesthetic
