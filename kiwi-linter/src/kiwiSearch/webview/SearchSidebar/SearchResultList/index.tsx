import * as stylex from '@stylexjs/stylex';
import { memo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { VscChevronDown, VscChevronRight } from 'react-icons/vsc';
import { GroupResult } from '../../../types';
import TreeItem from './TreeItem';
import { refScroller } from './useListState';
import { useToggleResult } from './useListState';

const styles = stylex.create({
  langResultItem: {
    paddingLeft: 2,
    paddingBottom: 8,
    display: 'flex',
    flexDirection: 'column'
  },
  langTitle: {
    display: 'flex',
    ':hover': {
      background: 'var( --vscode-list-hoverBackground)'
    }
  },
  langTitleChild: {
    height: '22px',
    display: 'flex',
    alignItems: 'center'
  },
  resultList: {
    flexGrow: 1,
    overflowY: 'scroll',
    ':not(:hover) .sg-match-tree-item::before': {
      opacity: 0
    },
    ':hover .sg-match-tree-item::before': {
      opacity: 1
    }
  }
});

interface SearchResultListProps {
  matches: GroupResult[];
}

function LangTitle(props: { data: GroupResult }) {
  const [isExpanded, toggleIsExpanded] = useToggleResult(props.data.lang.key);
  return (
    <div {...stylex.props(styles.langResultItem)}>
      <div {...stylex.props(styles.langTitle)} onClick={() => toggleIsExpanded()}>
        <div {...stylex.props(styles.langTitleChild)} style={{ marginRight: 6 }}>
          {isExpanded ? <VscChevronDown /> : <VscChevronRight />}
        </div>
        <div
          {...stylex.props(styles.langTitleChild)}
          style={{ flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {props.data.lang.value}
        </div>
      </div>
      <div style={{ display: isExpanded ? '' : 'none' }}>
        {props.data.files.map(i => {
          return <TreeItem key={i[0]} langKey={props.data.lang.key} className={'sg-match-tree-item'} matches={i[1]} />;
        })}
      </div>
    </div>
  );
}

function itemContent(_: number, data: GroupResult) {
  return <LangTitle data={data} />;
}
function computeItemKey(_: number, data: GroupResult) {
  return data.lang.key;
}
const SearchResultList = ({ matches }: SearchResultListProps) => {
  return (
    <Virtuoso
      ref={refScroller}
      {...stylex.props(styles.resultList)}
      data={matches}
      itemContent={itemContent}
      computeItemKey={computeItemKey}
    />
  );
};

export default memo(SearchResultList);
