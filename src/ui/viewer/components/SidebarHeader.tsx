import React from 'react';

interface SidebarHeaderProps {
  onClose: () => void;
}

export function SidebarHeader({ onClose }: SidebarHeaderProps) {
  const handleClose = (e: React.MouseEvent) => {
    console.log('Close button clicked');
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  return (
    <div className="sidebar-header">
      <h1>Projects</h1>
      <button
        className="sidebar-close-btn sidebar-close-button"
        onClick={handleClose}
        aria-label="Close sidebar"
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  );
}