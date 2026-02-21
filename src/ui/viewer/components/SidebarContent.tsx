import React from 'react';
import { ProjectStats } from '../types';
import ProjectCard from './ProjectCard';
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
  // All projects option
  const allProjectsOption = {
    project: 'All Projects',
    totalCount: stats.reduce((sum, project) => sum + project.totalCount, 0),
    lastActivityEpoch: Math.max(...stats.map(p => p.lastActivityEpoch), 0)
  };

  const allStats = currentFilter === 'all' ? [allProjectsOption, ...stats] : stats;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="sidebar-scroll">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`skeleton-${index}`} style={{ animationDelay: `${index * 100}ms` }}>
              <SkeletonCard type="project" />
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="sidebar-scroll">
          <div className="error-state">
            <div className="error-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3>Error</h3>
            <p className="error-message">{error}</p>
            <button
              className="retry-button"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    if (allStats.length === 0) {
      return (
        <div className="sidebar-scroll">
          <div className="empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"></path>
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
              </svg>
            </div>
            <h3>No Projects Found</h3>
            <p className="empty-message">
              {currentFilter === 'all'
                ? "Start working to create your first project!"
                : "Try changing the filter or check back later."
              }
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="sidebar-scroll">
        {allStats.map((project, index) => (
          <ProjectCard
            key={project.project === 'All Projects' ? 'all' : project.project}
            project={project}
            index={index}
            onClick={() => onProjectSelect(project.project)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="sidebar-content">
      <div className="sidebar-body">
        {renderContent()}
      </div>
    </div>
  );
}