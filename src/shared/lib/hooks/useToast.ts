import { useContext } from 'react';
import { ToastContext } from '@/shared/ui/Toast';

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  
  const { addToast, removeToast, clearAll } = context;

  const toast = {
    success: (message: string, title?: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) =>
      addToast({ type: 'success', message, title, ...options }),
    
    error: (message: string, title?: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) =>
      addToast({ type: 'error', message, title, ...options }),
    
    warning: (message: string, title?: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) =>
      addToast({ type: 'warning', message, title, ...options }),
    
    info: (message: string, title?: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) =>
      addToast({ type: 'info', message, title, ...options }),
    
    dismiss: removeToast,
    dismissAll: clearAll,
  };

  return toast;
}