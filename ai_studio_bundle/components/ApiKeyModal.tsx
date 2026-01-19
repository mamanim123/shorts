import React, { useState } from 'react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string) => void;
  currentApiKey?: string | null;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, currentApiKey }) => {
  const [apiKeyInput, setApiKeyInput] = useState(currentApiKey || '');

  if (!isOpen) return null;

  const handleSave = () => {
    if (apiKeyInput.trim()) {
      onSave(apiKeyInput.trim());
    } else {
      alert("API 키를 입력해주세요.");
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-lg flex flex-col gap-4">
        <header className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Google AI API 키 설정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="닫기">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="text-gray-300 text-sm space-y-2">
          <p>API 사용량 한도 초과 문제를 해결하려면 본인 소유의 Google AI API 키를 사용해주세요.</p>
          <p>
            API 키는{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:underline"
            >
              Google AI Studio
            </a>
            에서 발급받을 수 있습니다. 발급받은 키는 브라우저에 안전하게 저장됩니다.
          </p>
        </div>
        <div>
          <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-300 mb-2">
            API 키
          </label>
          <input
            id="api-key-input"
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="여기에 API 키를 붙여넣으세요"
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
        </div>
        <footer className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition"
          >
            저장
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ApiKeyModal;
