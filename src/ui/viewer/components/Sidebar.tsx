import React from 'react';
import { ProjectStats } from '../types';
import { SidebarHeader } from './SidebarHeader';
import { SidebarContent } from './SidebarContent';

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