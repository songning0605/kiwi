import { useSyncExternalStore } from 'react';
import { YAMLConfig, GroupResult } from '../../types';
import {
  childPort,
  dismissDiff,
  DisplayResult,
  openFile,
  OpenPayload,
  previewDiff,
  RangeInfo,
  replaceAll
} from '../postMessage';
import { SearchQuery } from './useQuery';

// id should not overflow, the MOD is large enough
// for most cases (unless there is buggy search)
const MOD = 1e9 + 7;

// maintain the latest search task id and callback
let id = 0;
let grouped: GroupResult[] = [];
let queryInFlight: SearchQuery | YAMLConfig = {
  pattern: '',
  includeFile: '',
  excludeFile: '',
  rewrite: '',
  strictness: 'smart',
  selector: '',
  lang: ''
};
let searching = true;
let searchError: Error | null = null;

// we will not immediately drop previous result
// instead, use a stale flag and update it on streaming or end
// TODO: refactor this state
let hasStaleResult = false;
const resultChangeCallbacks: Set<() => void> = new Set();

function refreshResultIfStale() {
  if (hasStaleResult) {
    // empty previous result
    hasStaleResult = false;
    grouped = [];
    for (const f of resultChangeCallbacks) {
      f();
    }
  }
}
export function onResultChange(f: () => void) {
  resultChangeCallbacks.add(f);
  return () => {
    resultChangeCallbacks.delete(f);
  };
}

function byLangKey(a: { lang: { value: string } }, b: { lang: { value: string } }) {
  return a.lang.value.length - b.lang.value.length;
}

// this function is also called in useQuery
function postSearch(searchQuery: SearchQuery) {
  id = (id + 1) % MOD;
  childPort.postMessage('search', { id, ...searchQuery });
  searching = true;
  hasStaleResult = true;
  searchError = null;
  notify();
}

export function postYAML(config: YAMLConfig) {
  id = (id + 1) % MOD;
  childPort.postMessage('yaml', { id, ...config });
  searching = true;
  hasStaleResult = true;
  searchError = null;
  notify();
}

childPort.onMessage('searchResultStreaming', event => {
  const { id: eventId, ...query } = event;
  if (eventId !== id) {
    return;
  }
  refreshResultIfStale();
  queryInFlight = query;
  grouped = merge(groupBy(event.searchResult));
  grouped.sort(byLangKey);
  notify();
});

childPort.onMessage('searchEnd', event => {
  const { id: eventId, ...query } = event;
  if (eventId !== id) {
    return;
  }
  searching = false;
  refreshResultIfStale();
  queryInFlight = query;
  notify();
});

childPort.onMessage('error', event => {
  if (event.id !== id) {
    return;
  }
  searchError = event.error;
  searching = false;
  grouped = [];
  notify();
});

childPort.onMessage('refreshSearchResult', event => {
  if (event.id !== id) {
    return;
  }
  const { fileName, updatedResults } = event;

  // 更新 grouped 数组中的特定文件
  for (const langGroup of grouped) {
    const fileIndex = langGroup.files.findIndex(([file]) => file === fileName);
    if (fileIndex !== -1) {
      if (updatedResults.length === 0) {
        // 删除该文件
        langGroup.files.splice(fileIndex, 1);
      } else {
        // 更新该文件的匹配结果
        langGroup.files[fileIndex] = [fileName, updatedResults];
      }
      break;
    }
  }

  // 移除空的语言组
  grouped = grouped.filter(langGroup => langGroup.files.length > 0);
  notify();
});

function groupBy(matches: DisplayResult[]) {
  // 按语言分组，每个语言组包含按文件分组的结果
  const langGroups = new Map<string, Map<string, DisplayResult[]>>();

  for (const match of matches) {
    const langKey = match.lang.key;

    if (!langGroups.has(langKey)) {
      langGroups.set(langKey, new Map());
    }

    const fileGroups = langGroups.get(langKey)!;
    if (!fileGroups.has(match.file)) {
      fileGroups.set(match.file, []);
    }

    fileGroups.get(match.file).push(match);
  }

  // 转换为新的 grouped 结构
  const result: typeof grouped = [];
  for (const [langKey, fileGroups] of langGroups) {
    // 获取第一个匹配项的语言信息
    const firstMatch = matches.find(m => m.lang.key === langKey)!;
    result.push({
      lang: firstMatch.lang,
      files: [...fileGroups.entries()]
    });
  }

  return result;
}

function merge(newEntries: typeof grouped) {
  // 合并新的语言分组结果到现有的 grouped 数组中
  const temp = new Map<string, typeof grouped[number]>();

  // 将现有的 grouped 转换为按语言分组的 Map
  for (const group of grouped) {
    temp.set(group.lang.key, group);
  }

  // 合并新的结果
  for (const newGroup of newEntries) {
    const langKey = newGroup.lang.key;
    if (temp.has(langKey)) {
      // 合并相同语言的文件组
      const existingGroup = temp.get(langKey)!;
      const existingFiles = new Map(existingGroup.files);

      for (const [file, newMatches] of newGroup.files) {
        if (existingFiles.has(file)) {
          // 合并相同文件的匹配项
          const existingMatches = existingFiles.get(file)!;
          existingFiles.set(file, [...existingMatches, ...newMatches]);
        } else {
          existingFiles.set(file, newMatches);
        }
      }

      existingGroup.files = [...existingFiles.entries()];
    } else {
      // 添加新的语言组
      temp.set(langKey, newGroup);
    }
  }

  return [...temp.values()];
}

// version is for react to update view
let version = 114514;
const watchers: Set<() => void> = new Set();
function notify() {
  // snapshot should precede onChange
  version = (version + 1) % MOD;
  for (const watcher of watchers) {
    watcher();
  }
}

function subscribe(onChange: () => void): () => void {
  watchers.add(onChange);
  return () => {
    watchers.delete(onChange);
  };
}

function getSnapshot() {
  return version; // symbolic snapshot for react
}

function queryHasRewrite() {
  if ('yaml' in queryInFlight) {
    return /^fix:/m.test(queryInFlight.yaml);
  }
  return !!queryInFlight.rewrite;
}

/**
 * Either open a file or preview the diff
 */
export function openAction(payload: OpenPayload) {
  if (!queryHasRewrite()) {
    openFile(payload);
    return;
  }

  // 在所有语言组中查找指定文件的匹配项
  let diffs: { replacement: string; range: RangeInfo }[] = [];
  for (const langGroup of grouped) {
    const fileEntry = langGroup.files.find(([file]) => file === payload.filePath);
    if (fileEntry) {
      diffs = fileEntry[1].map(n => ({
        replacement: n.replacement!,
        range: n.range
      }));
      break;
    }
  }

  previewDiff({
    ...payload,
    diffs
  });
}

export const useSearchResult = () => {
  useSyncExternalStore(subscribe, getSnapshot);
  return {
    queryInFlight,
    searching,
    searchError,
    groupedByFileSearchResult: grouped
  };
};
export { postSearch };

/**
 * Replace all matches in the search results
 */
export function acceptAllChanges() {
  // 收集所有文件的变更
  const changes: { filePath: string; diffs: { replacement: string; range: RangeInfo }[] }[] = [];

  for (const langGroup of grouped) {
    for (const [filePath, diffs] of langGroup.files) {
      changes.push({
        filePath,
        diffs: diffs.map(d => ({ replacement: d.replacement!, range: d.range }))
      });
    }
  }

  replaceAll({
    id,
    ...queryInFlight,
    changes
  });
}

export function dismissOneMatch(langKey: string, match: DisplayResult) {
  for (const langGroup of grouped) {
    if (langGroup.lang.key !== langKey) {
      continue;
    }
    const fileIndex = langGroup.files.findIndex(([file]) => file === match.file);
    if (fileIndex !== -1) {
      const fileEntry = langGroup.files[fileIndex];
      fileEntry[1] = fileEntry[1].filter(m => m !== match);

      // 如果文件没有匹配项了，删除该文件
      if (fileEntry[1].length === 0) {
        langGroup.files.splice(fileIndex, 1);
      }

      dismissDiff({
        filePath: match.file,
        diffs: fileEntry[1].map(d => ({
          replacement: d.replacement!,
          range: d.range
        })),
        locationsToSelect: match.range
      });
      break;
    }
  }

  // 移除空的语言组
  grouped = grouped.filter(langGroup => langGroup.files.length > 0);
  notify();
}

export function dismissOneFile(key: string, filePath: string) {
  for (const langGroup of grouped) {
    if (langGroup.lang.key === key) {
      const fileIndex = langGroup.files.findIndex(([file]) => file === filePath);
      if (fileIndex !== -1) {
        langGroup.files.splice(fileIndex, 1);
        break;
      }
    }
  }

  // 移除空的语言组
  grouped = grouped.filter(langGroup => langGroup.files.length > 0);
  notify();
}

export function findIndex(filePath: string) {
  for (let langIndex = 0; langIndex < grouped.length; langIndex++) {
    const langGroup = grouped[langIndex];
    const fileIndex = langGroup.files.findIndex(([file]) => file === filePath);
    if (fileIndex !== -1) {
      // 返回一个组合索引，表示语言组索引和文件索引
      return langIndex * 1000 + fileIndex; // 使用一个较大的乘数来区分语言组和文件
    }
  }
  return -1;
}
