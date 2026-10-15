import React from 'react';

export function PageLoader({ loading, children, message = 'Cargando página...', className = '' }) {
  return (
    <div
      className={`page-loader relative isolate min-h-full ${className}`}
      aria-busy={loading}
    >
      <style>{`
        @keyframes page-loader-enter {
          from { opacity: 0; transform: translate3d(0, 12px, 0); }
          to { opacity: 1; transform: translate3d(0, 0, 0); }
        }

        .page-loader-enter {
          animation: page-loader-enter 360ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .page-loader-enter {
            animation: none;
          }
        }
      `}</style>
      <div className={loading ? '' : 'page-loader-enter'}>
        {children}
      </div>

      {loading && (
        <div
          className="absolute inset-0 z-50 flex min-h-48 items-center justify-center bg-[#07090e]/70 p-6 backdrop-blur-md"
          role="status"
          aria-live="polite"
          aria-label={message}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping motion-reduce:animate-none" />
              <div className="absolute inset-1 rounded-full border-2 border-blue-400/20 border-t-blue-400 animate-spin motion-reduce:animate-none" />
              <div className="relative h-3 w-3 rounded-full bg-blue-300 shadow-[0_0_18px_rgba(96,165,250,0.8)]" />
            </div>
            <p className="animate-pulse text-sm font-medium text-blue-100 motion-reduce:animate-none">
              {message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default PageLoader;
