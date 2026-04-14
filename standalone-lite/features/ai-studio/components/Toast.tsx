import React, { useEffect } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

const ToastItem: React.FC<{ toast: ToastMessage; removeToast: (id: string) => void }> = ({ toast, removeToast }) => {
  useEffect(() => {
    const timer = window.setTimeout(() => removeToast(toast.id), 3000);
    return () => window.clearTimeout(timer);
  }, [toast.id, removeToast]);

  const bgColor = toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600';

  return (
    <div className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] pointer-events-auto`}>
      <p className="text-sm font-medium">{toast.message}</p>
      <button onClick={() => removeToast(toast.id)} className="ml-auto text-white/80 hover:text-white" aria-label="토스트 닫기">
        ×
      </button>
    </div>
  );
};

const ToastContainer: React.FC<ToastProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[20000] flex flex-col gap-2 pointer-events-none items-center">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
      ))}
    </div>
  );
};

export default ToastContainer;
