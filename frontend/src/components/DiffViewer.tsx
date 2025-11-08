import ReactDiffViewer from 'react-diff-viewer-continued';

interface DiffViewerProps {
  before: string;
  after: string;
  fileName?: string;
}

export function DiffViewer({ before, after, fileName }: DiffViewerProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {fileName && (
        <div className="bg-gray-100 px-4 py-2 border-b font-mono text-sm">
          {fileName}
        </div>
      )}
      <ReactDiffViewer
        oldValue={before}
        newValue={after}
        splitView={true}
        useDarkTheme={false}
        leftTitle="Before"
        rightTitle="After"
      />
    </div>
  );
}
