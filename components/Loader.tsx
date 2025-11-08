
import React from 'react';

const Loader: React.FC<{ message: string }> = ({ message }) => {
  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-cyan-400"></div>
      <p className="text-white text-lg mt-4 font-semibold">{message}</p>
      <p className="text-slate-400 text-sm mt-2">Esto puede tardar unos momentos...</p>
    </div>
  );
};

export default Loader;
