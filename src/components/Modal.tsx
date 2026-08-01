import { type ReactNode } from 'react';

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  closeOnOverlay?: boolean;
}

export default function Modal({
  children,
  onClose,
  className,
  closeOnOverlay = true,
}: ModalProps) {
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose();
      }}
    >
      <div className={'modal ' + (className ?? '')}>{children}</div>
    </div>
  );
}
