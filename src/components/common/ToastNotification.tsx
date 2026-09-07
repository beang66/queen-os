import React from 'react';

interface ToastNotificationProps {
  message: string | null;
}

/**
 * 알림 메시지를 화면 우측 하단에 띄워주는 공통 토스트 컴포넌트
 */
export const ToastNotification: React.FC<ToastNotificationProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-[#1e293b] text-white px-4 py-2.5 rounded-lg shadow-xl border border-gray-700 text-xs font-mono font-medium flex items-center gap-2 animate-bounce-short">
      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
      <span>{message}</span>
    </div>
  );
};
