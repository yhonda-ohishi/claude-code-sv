import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

interface DiffViewerProps {
  before: string;
  after: string;
  fileName?: string;
}

export function DiffViewer({ before, after, fileName }: DiffViewerProps) {
  // GitHub風のダークテーマカスタムスタイル
  const customStyles = {
    variables: {
      dark: {
        diffViewerBackground: '#0d1117',
        diffViewerColor: '#c9d1d9',
        addedBackground: '#1a4d2e',
        addedColor: '#aff5b4',
        removedBackground: '#6e1b22',
        removedColor: '#ffdcd7',
        wordAddedBackground: '#28a745',
        wordRemovedBackground: '#d73a49',
        addedGutterBackground: '#1a4d2e',
        removedGutterBackground: '#6e1b22',
        gutterBackground: '#161b22',
        gutterBackgroundDark: '#0d1117',
        highlightBackground: '#1f2937',
        highlightGutterBackground: '#374151',
        codeFoldGutterBackground: '#161b22',
        codeFoldBackground: '#1f2937',
        emptyLineBackground: '#161b22',
        gutterColor: '#8b949e',
        addedGutterColor: '#aff5b4',
        removedGutterColor: '#ffdcd7',
        codeFoldContentColor: '#8b949e',
        diffViewerTitleBackground: '#161b22',
        diffViewerTitleColor: '#c9d1d9',
        diffViewerTitleBorderColor: '#30363d',
      },
    },
    line: {
      padding: '0px 2px',
      fontSize: '13px',
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      lineHeight: '20px',
    },
    gutter: {
      padding: '0px 8px',
      minWidth: '50px',
      fontSize: '12px',
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    },
    marker: {
      padding: '0px 8px',
    },
    wordDiff: {
      padding: '2px',
      borderRadius: '2px',
    },
    codeFold: {
      fontSize: '12px',
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    },
    emptyGutter: {
      backgroundColor: '#161b22',
    },
    contentText: {
      fontSize: '13px',
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    },
    titleBlock: {
      padding: '8px 16px',
      fontSize: '14px',
      fontWeight: '600',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
    },
  };

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden bg-[#0d1117]">
      {fileName && (
        <div className="bg-[#161b22] px-4 py-2.5 border-b border-gray-700 font-mono text-sm text-gray-300 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 16 16">
            <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"></path>
          </svg>
          {fileName}
        </div>
      )}
      <div className="overflow-x-auto">
        <ReactDiffViewer
          oldValue={before}
          newValue={after}
          splitView={true}
          useDarkTheme={true}
          compareMethod={DiffMethod.WORDS}
          leftTitle="変更前"
          rightTitle="変更後"
          styles={customStyles}
          showDiffOnly={false}
          disableWordDiff={false}
          hideLineNumbers={false}
        />
      </div>
    </div>
  );
}
