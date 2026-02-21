import React from "react";

interface SkeletonCardProps {
  type?: 'summary' | 'project' | 'prompt' | 'observation';
  count?: number;
}

export function SkeletonCard({ type = 'summary', count = 1 }: SkeletonCardProps) {
  if (count > 1) {
    return (
      <div className="skeleton-container">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="skeleton-card summary-skeleton">
            <div className="card">
              <div className="card-header">
                <div className="card-type skeleton-line skeleton-title"></div>
              </div>
              <div className="card-content">
                <div className="skeleton-line skeleton-title"></div>
                <div className="skeleton-line skeleton-subtitle"></div>
                <div className="skeleton-line skeleton-subtitle short"></div>
                <div className="skeleton-line"></div>
                <div className="skeleton-line"></div>
              </div>
              <div className="card-footer">
                <div className="skeleton-line"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="skeleton-card summary-skeleton">
      <div className="card">
        <div className="card-header">
          <div className="card-type skeleton-line skeleton-title"></div>
        </div>
        <div className="card-content">
          {type === 'summary' && (
            <>
              <div className="skeleton-line skeleton-title"></div>
              <div className="skeleton-line skeleton-subtitle"></div>
              <div className="skeleton-line skeleton-subtitle short"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
            </>
          )}
          {type === 'project' && (
            <>
              <div className="skeleton-line skeleton-title"></div>
              <div className="skeleton-line skeleton-subtitle"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
            </>
          )}
          {type === 'prompt' && (
            <>
              <div className="skeleton-line skeleton-title"></div>
              <div className="skeleton-line skeleton-subtitle"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
            </>
          )}
          {type === 'observation' && (
            <>
              <div className="skeleton-line skeleton-title"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
            </>
          )}
        </div>
        <div className="card-footer">
          <div className="skeleton-line"></div>
        </div>
        <div className="processing-indicator">
          <div className="spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    </div>
  );
}

interface SkeletonCardsProps {
  type?: 'summary' | 'project' | 'prompt' | 'observation';
  count?: number;
}

export function SkeletonCards({ type = 'summary', count = 3 }: SkeletonCardsProps) {
  return (
    <div className="skeleton-container">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-card summary-skeleton">
          <div className="card">
            <div className="card-header">
              <div className="card-type skeleton-line skeleton-title"></div>
            </div>
            <div className="card-content">
              {type === 'summary' && (
                <>
                  <div className="skeleton-line skeleton-title"></div>
                  <div className="skeleton-line skeleton-subtitle"></div>
                  <div className="skeleton-line skeleton-subtitle short"></div>
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line"></div>
                </>
              )}
              {type === 'project' && (
                <>
                  <div className="skeleton-line skeleton-title"></div>
                  <div className="skeleton-line skeleton-subtitle"></div>
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line"></div>
                </>
              )}
              {type === 'prompt' && (
                <>
                  <div className="skeleton-line skeleton-title"></div>
                  <div className="skeleton-line skeleton-subtitle"></div>
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line"></div>
                </>
              )}
              {type === 'observation' && (
                <>
                  <div className="skeleton-line skeleton-title"></div>
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line"></div>
                </>
              )}
            </div>
            <div className="card-footer">
              <div className="skeleton-line"></div>
            </div>
            <div className="processing-indicator">
              <div className="spinner"></div>
              <span>Loading...</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}