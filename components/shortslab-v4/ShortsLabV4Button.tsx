import React from 'react';

interface ShortsLabV4ButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function ShortsLabV4Button({ onClick, disabled }: ShortsLabV4ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold transition-all"
    >
      AI MASTER V4
    </button>
  );
}
