
import React from 'react';

const Loader: React.FC<{ message: string }> = ({ message }) => {
  return (
    <div className="fixed inset-0 bg-neutral-950/90 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
      <div className="relative flex flex-col items-center">
        {/* Simple Spinner */}
        <div className="w-12 h-12 border-4 border-neutral-800 border-t-orange-500 rounded-full animate-spin mb-6"></div>

        {/* Message */}
        <div className="text-center max-w-md px-4">
          <p className="text-white text-lg font-semibold mb-2 tracking-tight">{message}</p>
          <p className="text-neutral-400 text-sm">Procesando solicitud...</p>
        </div>
      </div>
    </div>
  );
};

export default Loader;
