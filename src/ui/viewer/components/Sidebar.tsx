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

  // Focus trap for accessibility
  React.useEffect(() => {
    if (isOpen) {
      const sidebarElement = document.querySelector('.sidebar');
      if (sidebarElement) {
        // Set initial focus to the close button
        const closeButton = sidebarElement.querySelector('.sidebar-close-button');
        if (closeButton) {
          (closeButton as HTMLElement).focus();
        }

        // Focus trap function
        const handleTab = (e: KeyboardEvent) => {
          if (e.key !== 'Tab') return;

          const focusableElements = sidebarElement.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );

          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        };

        sidebarElement.addEventListener('keydown', handleTab);
        return () => sidebarElement.removeEventListener('keydown', handleTab);
      }
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`sidebar-backdrop ${isOpen ? 'active' : ''}`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />
      <aside
        className={`sidebar ${isOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Project Sidebar"
        aria-hidden={!isOpen}
      >
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