
import React from 'react';

const Loader: React.FC<{ message: string }> = ({ message }) => {
  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-90 flex flex-col items-center justify-center z-50 backdrop-blur-md">
      {/* Animated gradient background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse animation-delay-2000"></div>
      </div>

      {/* Drone formation animation */}
      <div className="relative w-64 h-64 mb-8">
        {/* Center drone */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="animate-bounce">
            <svg className="w-12 h-12 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" className="animate-pulse"/>
              <path d="M12 2L8 6h8l-4-4z"/>
              <path d="M12 22l4-4H8l4 4z"/>
              <path d="M2 12l4-4v8l-4-4z"/>
              <path d="M22 12l-4 4v-8l4 4z"/>
            </svg>
          </div>
        </div>

        {/* Orbiting drones */}
        <div className="absolute inset-0 animate-spin-slow">
          {[0, 72, 144, 216, 288].map((angle, i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2"
              style={{
                transform: `rotate(${angle}deg) translateY(-80px)`,
              }}
            >
              <div
                className="w-3 h-3 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50 animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              ></div>
            </div>
          ))}
        </div>

        {/* Light trails */}
        <div className="absolute inset-0 animate-spin-slow opacity-30">
          {[0, 72, 144, 216, 288].map((angle, i) => (
            <div
              key={`trail-${i}`}
              className="absolute top-1/2 left-1/2 w-1 h-20 bg-gradient-to-b from-cyan-400 to-transparent"
              style={{
                transform: `rotate(${angle}deg) translateY(-80px)`,
                transformOrigin: 'top center',
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* Message */}
      <div className="relative z-10 text-center">
        <p className="text-white text-xl font-bold mb-2 animate-pulse">{message}</p>
        <p className="text-cyan-300 text-sm">Esto puede tardar unos momentos...</p>

        {/* Loading dots */}
        <div className="flex justify-center gap-2 mt-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            ></div>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}} />
    </div>
  );
};

export default Loader;
