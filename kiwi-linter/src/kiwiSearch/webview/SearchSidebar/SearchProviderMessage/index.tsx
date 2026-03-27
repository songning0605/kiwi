import { memo } from 'react';
import { GroupResult, SearchQuery } from '../../../types';

const style = {
  color: 'var(--vscode-search-resultsInfoForeground)',
  padding: '0 10px 8px',
  lineHeight: '1.4em'
};

interface SearchProviderMessageProps {
  query: SearchQuery;
  results: GroupResult[];
  error: Error | null;
}

const SearchProviderMessage = memo(({ results }: SearchProviderMessageProps) => {
  const resultCount = results.reduce((a, b) => a + b.files.reduce((c, d) => c + d[1].length, 0), 0);
  const fileCount = results.length;
  return (
    <>
      {resultCount === 0 ? (
        <span />
      ) : (
        <div style={style}>{`匹配 ${results.length} 条文案，共 ${resultCount} 个结果`}</div>
      )}
    </>
  );
});

export default SearchProviderMessage;
