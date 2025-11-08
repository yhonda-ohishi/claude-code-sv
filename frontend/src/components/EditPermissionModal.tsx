import { useEffect } from 'react';
import { DiffViewer } from './DiffViewer';

interface EditPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  filePath: string;
  oldString: string;
  newString: string;
}

export function EditPermissionModal({
  isOpen,
  onClose,
  onApprove,
  onReject,
  filePath,
  oldString,
  newString,
}: EditPermissionModalProps) {
  // キーボードショートカット: y = 承認, n = 拒否
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // input/textarea内での入力は無視
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        onApprove();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        onReject();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, onApprove, onReject]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full h-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div>
            <h2 className="text-lg font-bold">編集権限の確認</h2>
            <p className="text-sm text-gray-600 mt-1">{filePath}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onReject}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm flex items-center gap-2"
            >
              拒否
              <span className="text-xs opacity-75 bg-red-700 px-1.5 py-0.5 rounded">N</span>
            </button>
            <button
              onClick={onApprove}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm flex items-center gap-2"
            >
              承認
              <span className="text-xs opacity-75 bg-green-700 px-1.5 py-0.5 rounded">Y</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 差分表示エリア */}
        <div className="flex-1 overflow-auto p-4">
          <DiffViewer before={oldString} after={newString} fileName={filePath} />
        </div>
      </div>
    </div>
  );
}
