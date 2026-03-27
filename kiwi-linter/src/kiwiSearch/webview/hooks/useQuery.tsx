import { useEffect, useState } from 'react';
import { useBoolean, useDebounce, useLocalStorage } from 'react-use';
import { PatternQuery, SearchQuery } from '../../types';
import { childPort } from '../postMessage';
export { SearchQuery };
// this is the single sole point of communication
// between search query and search result
import { postSearch } from './useSearch';

const searchQuery: Record<keyof PatternQuery, string> = {
  pattern: '',
  strictness: 'smart',
  selector: '',
  includeFile: '',
  excludeFile: '',
  rewrite: '',
  lang: ''
};

type PatternKeys = 'selector';

const LS_KEYS: Record<Exclude<keyof PatternQuery, PatternKeys>, string> = {
  pattern: 'kiwi-search-panel-input-value',
  includeFile: 'kiwi-search-panel-include-value',
  excludeFile: 'kiwi-search-panel-exclude-value',
  rewrite: 'kiwi-search-panel-rewrite-value',
  strictness: 'kiwi-search-panel-strictness-value',
  lang: 'kiwi-search-panel-lang-value'
};

export function refreshResult() {
  postSearch(searchQuery);
}
childPort.onMessage('refreshAllSearch', refreshResult);
childPort.onMessage('clearSearchResults', () => {
  searchQuery.pattern = '';
  refreshResult();
});

export function useSearchField(key: keyof typeof LS_KEYS) {
  const [field = '', setField] = useLocalStorage(LS_KEYS[key], '');
  // this useEffect and useDebounce is silly
  useEffect(() => {
    searchQuery[key] = field;
  }, [field, key]);

  useDebounce(refreshResult, 150, [field]);
  return [field, setField] as const;
}

export function usePatternConfig(key: PatternKeys) {
  const [field, setField] = useState(searchQuery[key]);
  // this useEffect and useDebounce is silly
  useEffect(() => {
    searchQuery[key] = field;
  }, [field, key]);
  useDebounce(refreshResult, 150, [field]);
  return [field, setField] as const;
}

export function useSearchOption() {
  const [includeFile = '', setIncludeFile] = useSearchField('includeFile');
  const [excludeFile = '', setExcludeFile] = useSearchField('excludeFile');
  const [showOptions, toggleOptions] = useBoolean(Boolean(includeFile));

  useEffect(() => {
    childPort.onMessage('setIncludeFile', val => {
      setIncludeFile(val.includeFile);
      toggleOptions(true);
    });
  }, [toggleOptions, setIncludeFile]);
  return {
    includeFile,
    excludeFile,
    setIncludeFile,
    setExcludeFile,
    showOptions,
    toggleOptions
  };
}

export function hasInitialRewrite() {
  return Boolean(localStorage.getItem(LS_KEYS.rewrite));
}
