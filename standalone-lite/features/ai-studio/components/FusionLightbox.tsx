import React from 'react';

interface FusionLightboxProps {
  imageUrl: string;
  onClose: () => void;
}

const FusionLightbox: React.FC<FusionLightboxProps> = ({ imageUrl, onClose }) => {
  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4" onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div className="relative max-w-full max-h-full">
        <img src={imageUrl} alt="확대된 이미지" className="max-w-full max-h-[90vh] object-contain" />
        <button onClick={onClose} className="absolute -top-4 -right-4 sm:top-2 sm:right-2 bg-white text-black rounded-full p-2 hover:bg-gray-200 transition" aria-label="닫기">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default FusionLightbox;
