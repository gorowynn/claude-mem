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
