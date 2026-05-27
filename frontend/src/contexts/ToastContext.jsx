import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const toastIdsRef = useRef(new Set()); // Track active toast messages

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    // Create a unique key based on message and type to prevent duplicates
    const toastKey = `${type}-${message}`;
    
    // Check if this toast is already showing
    if (toastIdsRef.current.has(toastKey)) {
      return; // Don't add duplicate toast
    }

    const id = Date.now();
    toastIdsRef.current.add(toastKey);
    setToasts(prev => [...prev, { id, message, type, toastKey }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
      toastIdsRef.current.delete(toastKey);
    }, duration);
  }, []);

  const removeToast = useCallback((id, toastKey) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    if (toastKey) {
      toastIdsRef.current.delete(toastKey);
    }
  }, []);

  const success = useCallback((message) => addToast(message, 'success'), [addToast]);
  const error = useCallback((message) => addToast(message, 'error'), [addToast]);
  const info = useCallback((message) => addToast(message, 'info'), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, info }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          onClick={() => removeToast(toast.id, toast.toastKey)}
        >
          {toast.type === 'success' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {toast.type === 'error' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {toast.type === 'info' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// For backward compatibility
export const useToastActions = () => {
  return useToast();
};