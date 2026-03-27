import { MouseEvent, useCallback } from 'react';
import { DisplayResult } from '../../../types';
import { dismissOneFile } from '../../hooks/useSearch';
import * as stylex from '@stylexjs/stylex';
import { VscClose } from 'react-icons/vsc';

const styles = stylex.create({
  list: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'row',
    overflow: 'hidden',
    flex: '0 0 auto'
  },
  action: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '20px',
    width: '20px',
    borderRadius: '5px',
    margin: '1px 0',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: 'var(--vscode-toolbar-hoverBackground)'
    },
    // compensate list's style padding: '0 .8em 0 .4em',
    ':first-child': {
      marginLeft: '0.4em'
    },
    ':last-child': {
      marginRight: '0.2em'
    }
  }
});

interface ActionsProps {
  langKey: string;
  match: DisplayResult;
}

interface FileActionsProps {
  langKey: string;
  filePath: string;
  hasReplace: boolean;
}

export function FileActions({ langKey, filePath, hasReplace }: FileActionsProps) {
  const onDismiss = useCallback(
    (e: MouseEvent<HTMLLIElement>) => {
      e.stopPropagation();
      dismissOneFile(langKey, filePath);
    },
    [langKey, filePath]
  );
  return (
    <ul {...stylex.props(styles.list)} role="toolbar">
      <li {...stylex.props(styles.action)} onClick={onDismiss}>
        <VscClose role="button" title="Dismiss" tabIndex={0} />
      </li>
    </ul>
  );
}
