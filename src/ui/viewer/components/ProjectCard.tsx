import React from 'react';
import { ProjectStats } from '../types';
import { formatRelativeTime } from '../utils/time';

interface ProjectCardProps {
  project: ProjectStats;
  index: number;
  onClick: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, index, onClick }) => {
  const animationDelay = (index % 8) * 50; // Stagger animation: 0, 50, 100, 150, 200, 250, 300, 350ms

  return (
    <div
      className="project-card"
      style={{
        animationDelay: `${animationDelay}ms`,
        animationName: 'slideInUp',
        animationDuration: '0.3s',
        animationTimingFunction: 'ease-out',
        animationFillMode: 'forwards'
      }}
      onClick={onClick}
    >
      <div className="project-card-header">
        <h3 className="project-card-title">{project.project}</h3>
        <span className="project-card-count">{project.totalCount}</span>
      </div>
      <div className="project-card-footer">
        <span className="project-card-time">
          {formatRelativeTime(project.lastActivityEpoch)}
        </span>
      </div>
    </div>
  );
};

export default ProjectCard;