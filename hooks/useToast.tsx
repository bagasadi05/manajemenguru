
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { CheckCircleIcon, XCircleIcon, AlertCircleIcon, FileTextIcon } from '../components/Icons';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  addToast: (message: string, options?: { type?: ToastType; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const ICONS: Record<ToastType, React.FC<React.SVGProps<SVGSVGElement>>> = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  warning: AlertCircleIcon,
  info: FileTextIcon,
};

const COLORS: Record<ToastType, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
};

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const Icon = ICONS[toast.type];

  return (
    <div
      className="flex items-center w-full max-w-sm p-4 text-white bg-gray-800 rounded-lg shadow-2xl backdrop-blur-sm bg-opacity-80 border border-gray-700/50 transform transition-all duration-300 animate-fade-in-up"
      role="alert"
    >
      <div className={`inline-flex items-center justify-center flex-shrink-0 w-8 h-8 ${COLORS[toast.type]} rounded-lg`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="ml-3 text-sm font-normal flex-1">{toast.message}</div>
      <button
        type="button"
        className="ml-auto -mx-1.5 -my-1.5 bg-white/10 text-gray-300 hover:text-white rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-white/20 inline-flex h-8 w-8"
        onClick={() => onDismiss(toast.id)}
        aria-label="Close"
      >
        <span className="sr-only">Close</span>
        <svg aria-hidden="true" className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
        </svg>
      </button>
    </div>
  );
};

const ToastContainer: React.FC<{ toasts: Toast[]; onDismiss: (id: number) => void }> = ({ toasts, onDismiss }) => {
    const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

    useEffect(() => {
        const node = document.createElement('div');
        node.className = 'fixed top-5 right-5 z-[100] space-y-3';
        document.body.appendChild(node);
        setPortalNode(node);
        return () => {
            document.body.removeChild(node);
        };
    }, []);

    if (!portalNode) return null;
    
    return ReactDOM.createPortal(
        <>
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
        </>,
        portalNode
    );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, options?: { type?: ToastType; duration?: number }) => {
    setToasts((prevToasts) => [
      ...prevToasts,
      {
        id: Date.now(),
        message,
        type: options?.type || 'info',
        duration: options?.duration,
      },
    ]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  
  return {
    success: (message: string, options?: { duration?: number }) => context.addToast(message, { ...options, type: 'success' }),
    error: (message: string, options?: { duration?: number }) => context.addToast(message, { ...options, type: 'error' }),
    info: (message: string, options?: { duration?: number }) => context.addToast(message, { ...options, type: 'info' }),
    warning: (message: string, options?: { duration?: number }) => context.addToast(message, { ...options, type: 'warning' }),
  };
};
