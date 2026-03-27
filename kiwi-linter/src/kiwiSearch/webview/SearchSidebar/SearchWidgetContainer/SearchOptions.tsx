/**
 * @desc 文案搜索 更多操作 文件内搜索
 * @author zongwenjian
 */

import * as stylex from '@stylexjs/stylex';
import { VscEllipsis } from 'react-icons/vsc';
import { refreshResult, useSearchOption } from '../../hooks/useQuery';
import IncludeFile from './IncludeFile';
import ExcludeFile from './excludeFile';

const styles = stylex.create({
  button: {
    background: 'transparent',
    color: 'var(--vscode-foreground)',
    cursor: 'pointer',
    width: 'fit-content',
    alignSelf: 'end',
    textAlign: 'end',
    padding: '0 4px',
    height: '20px',
    flex: '0 0 auto',
    position: 'absolute',
    top: '0',
    right: '-2px' // vscode has two 2px right
  },
  options: {
    minHeight: '16px',
    marginLeft: '8px',
    position: 'relative'
  }
});

export default function SearchOptions() {
  const { showOptions, toggleOptions, includeFile, setIncludeFile, excludeFile, setExcludeFile } = useSearchOption();
  return (
    <div {...stylex.props(styles.options)}>
      <button type="button" {...stylex.props(styles.button)} onClick={toggleOptions}>
        <VscEllipsis />
      </button>
      {showOptions && (
        <div style={{ paddingBottom: '6px' }}>
          <IncludeFile includeFile={includeFile} setIncludeFile={setIncludeFile} refreshResult={refreshResult} />
          <ExcludeFile excludeFile={excludeFile} setExcludeFile={setExcludeFile} refreshResult={refreshResult} />
        </div>
      )}
    </div>
  );
}
