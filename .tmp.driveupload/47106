import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Info, AlertTriangle, XCircle } from 'lucide-react';

export type ToastType = 'info' | 'success' | 'error' | 'warning';
export interface ToastMessage {
  id: string;
  message: string;
  type?: ToastType;
}

type Listener = (toast: ToastMessage) => void;
const listeners = new Set<Listener>();

export const showToast = (message: string, type: ToastType = 'info') => {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `toast-${Date.now()}-${Math.random()}`;
  const toast: ToastMessage = { id, message, type };
  listeners.forEach((fn) => fn(toast));
};

export const ToastContainer: React.FC = () => {
  const [items, setItems] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler: Listener = (toast) => {
      setItems((prev) => [...prev, toast]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== toast.id));
      }, 2200);
    };
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  const iconFor = (type?: ToastType) => {
    if (type === 'success') return <CheckCircle2 className="w-4 h-4" />;
    if (type === 'error') return <XCircle className="w-4 h-4" />;
    if (type === 'warning') return <AlertTriangle className="w-4 h-4" />;
    return <Info className="w-4 h-4" />;
  };

  const content = (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] space-y-2 pointer-events-none flex flex-col items-center">
      {items.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto px-4 py-3 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-all shadow-2xl backdrop-blur-md ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-200/80 shadow-emerald-900/30'
              : toast.type === 'error'
              ? 'bg-rose-600 text-white border-rose-200/80 shadow-rose-900/30'
              : toast.type === 'warning'
              ? 'bg-amber-400 text-gray-900 border-amber-200/80 shadow-amber-900/30'
              : 'bg-indigo-600 text-white border-indigo-200/80 shadow-indigo-900/30'
          }`}
        >
          {iconFor(toast.type)}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
};
