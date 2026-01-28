import React from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

interface AlertProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose: () => void;
}

export const Alert: React.FC<AlertProps> = ({ type, message, onClose }) => {
  const bgColors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-teal-50 border-teal-200 text-teal-800'
  };

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: AlertCircle
  };

  const Icon = icons[type];

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center p-4 mb-4 text-sm border rounded-lg shadow-lg ${bgColors[type]}`} role="alert">
      <Icon className="flex-shrink-0 inline w-5 h-5 mr-3" />
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-auto -mx-1.5 -my-1.5 rounded-lg focus:ring-2 focus:ring-gray-400 p-1.5 hover:bg-white/20 inline-flex items-center justify-center h-8 w-8">
        <X size={16} />
      </button>
    </div>
  );
};
