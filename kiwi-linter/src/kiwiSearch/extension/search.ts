import { spawn } from 'node:child_process';
import path from 'node:path';
import { workspace, env, ExtensionContext, commands, window } from 'vscode';
import { DisplayResult, PatternQuery, SearchQuery, SgSearch, WithId } from '../types';
import { parentPort } from './common';
import { getSuggestLangObj } from '../../getLangData';
import * as fs from 'fs';

const LEADING_SPACES_RE = /^\s*/;
const PRE_CTX = 30;
const POST_CTX = 100;

/**
 * Set up search query handling and search commands
 */
export function activateSearch(context: ExtensionContext) {
  context.subscriptions.push(commands.registerCommand('vscode-i18n-linter.searchInFolder', findInFolder));
}

function findInFolder(data: any) {
  const workspacePath = workspace.workspaceFolders?.[0]?.uri?.fsPath;
  const relative = workspacePath && path.relative(workspacePath, data.fsPath);
  if (!relative) {
    window.showErrorMessage('kiwi Error: 目录不在当前工作空间中');
    return;
  }
  commands.executeCommand('kiwi.search.input.focus');
  parentPort.postMessage('setIncludeFile', {
    includeFile: relative
  });
}

export function splitByHighLightToken(search: SgSearch, suggestLangObj?: any): DisplayResult {
  const { start, end } = search.range;
  let startIdx = start.column;
  let endIdx = end.column;
  let displayLine = search.lines;
  // multiline matches! only display the first line!
  if (start.line < end.line) {
    displayLine = search.lines.split(/\r?\n/, 1)[0];
    endIdx = displayLine.length;
  }
  // strip leading spaces
  const leadingSpaces = displayLine.match(LEADING_SPACES_RE)?.[0].length;
  if (leadingSpaces) {
    displayLine = displayLine.substring(leadingSpaces);
    startIdx -= leadingSpaces;
    endIdx -= leadingSpaces;
  }
  // TODO: improve this rendering logic
  // truncate long lines
  if (startIdx > PRE_CTX + 3) {
    displayLine = '...' + displayLine.substring(startIdx - PRE_CTX);
    const length = endIdx - startIdx;
    startIdx = PRE_CTX + 3;
    endIdx = startIdx + length;
  }
  if (endIdx + POST_CTX + 3 < displayLine.length) {
    displayLine = displayLine.substring(0, endIdx + POST_CTX) + '...';
  }
  return {
    startIdx,
    endIdx,
    lang: {
      key: search.text,
      value: suggestLangObj[search.text.slice(5)]
    },
    displayLine,
    lineSpan: end.line - start.line,
    file: search.file,
    range: search.range,
    language: search.language,
    ...handleReplacement(search.replacement)
  };
}

function handleReplacement(replacement?: string) {
  if (replacement) {
    return { replacement };
  }
  return {};
}

/**
 * 获取 VSCode 内置的 ripgrep 可执行文件路径
 */
function getRipgrepPath(): string {
  // VSCode 内置的 ripgrep 路径
  const basePath = path.join(env.appRoot, 'node_modules', '@vscode', 'ripgrep', 'bin', 'rg');

  // Windows 需要 .exe 后缀
  return process.platform === 'win32' ? basePath + '.exe' : basePath;
}

/**
 * 处理文件路径 判断路径模式
 */
function handleFilePath(
  filePath: string[],
  workspaceRoot: string
): { existingPaths: string[]; globPatterns: string[] } {
  // 分离存在的路径和 glob 模式
  const existingPaths: string[] = [];
  const globPatterns: string[] = [];

  filePath.forEach(p => {
    // 尝试将路径解析为绝对路径
    let absolutePath = p;
    if (!path.isAbsolute(p)) {
      absolutePath = path.join(workspaceRoot, p);
    }

    if (fs.existsSync(absolutePath)) {
      // 路径存在（文件或目录）
      existingPaths.push(p); // 保持原始路径格式
    } else if (p.includes('*') || p.includes('?')) {
      // 是 glob 模式
      globPatterns.push(p);
    } else {
      // 不存在的普通路径，尝试作为 glob 处理
      globPatterns.push(`${p}/**`);
    }
  });

  return { existingPaths, globPatterns };
}

/**
 * 使用VSCode内置Ripgrep实现高性能搜索
 * 支持关键字搜索和指定目录下搜索，性能与vscode默认搜索相仿
 */
/**
 * 执行Ripgrep搜索的主函数
 */
async function searchWithRipgrep(
  payload: WithId<SearchQuery>,
  pattern: string,
  workspaceRoot: string,
  includePatterns?: string[],
  excludePatterns?: string[]
): Promise<void> {
  try {
    // 构建Ripgrep参数
    const rgArgs = ['--json', '--color', 'never', '--no-heading', '--line-number', '--column', '--byte-offset'];

    // 大小写敏感设置
    rgArgs.push('--case-sensitive');

    // 全词匹配
    rgArgs.push('--word-regexp');

    // 默认排除
    ['node_modules/**', '.git/**'].forEach(excludePattern => {
      rgArgs.push('--glob', `!${excludePattern}`);
    });
    if (excludePatterns && excludePatterns.length > 0) {
      const normalizedPaths = excludePatterns.map(p => path.normalize(p));
      const { existingPaths, globPatterns } = handleFilePath(normalizedPaths, workspaceRoot);
      [...globPatterns, ...existingPaths].forEach(i => {
        rgArgs.push('--glob', `!${i}`);
      });
    }

    // 搜索模式
    // 所有文案对象 例如 { 'AcrossTenantPublish.ExportPublishPackage.jiaRuFaBuBao2': '加入发布包成功' }
    const suggestLangObj = getSuggestLangObj();
    const langKeys = Object.keys(suggestLangObj)
      .filter(key => suggestLangObj[key].includes(pattern))
      .map(key => `I18N.${key}`)
      .join('|');
    rgArgs.push('--', langKeys);

    if (!langKeys) {
      parentPort.postMessage('searchResultStreaming', {
        ...payload,
        searchResult: []
      });
      return;
    }

    // 处理多个包含路径
    if (includePatterns && includePatterns.length > 0) {
      const normalizedPaths = includePatterns.map(p => path.normalize(p));

      const { existingPaths, globPatterns } = handleFilePath(normalizedPaths, workspaceRoot);

      // 添加 glob 模式
      globPatterns.forEach(pattern => {
        rgArgs.push('--glob', pattern);
      });

      // 添加实际存在的路径（放在最后）
      existingPaths.forEach(p => {
        rgArgs.push(p);
      });
    }

    console.log(`执行Ripgrep搜索，参数: rg ${rgArgs.join(' ')}`);

    // 获取VSCode内置的ripgrep路径
    const ripgrepPath = getRipgrepPath();

    const rg = spawn(ripgrepPath, rgArgs, {
      cwd: workspaceRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let resultCount = 0;
    let buffer = '';
    const results: SgSearch[] = [];

    // 处理stdout数据流
    rg.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      lines.forEach(line => {
        if (!line.trim()) return;

        try {
          const match = JSON.parse(line);

          if (match.type === 'match') {
            const sgResults = convertMatchToDisplayResults(match);
            results.push(...sgResults);

            // 流式发送结果
            if (sgResults.length > 0) {
              parentPort.postMessage('searchResultStreaming', {
                ...payload,
                searchResult: sgResults.map(i => splitByHighLightToken(i, suggestLangObj))
              });
              resultCount += sgResults.length;
            }
          }
        } catch (error) {
          console.warn('解析Ripgrep结果失败:', error);
        }
      });
    });

    return new Promise<void>((resolve, reject) => {
      rg.on('close', code => {
        if (code === 0 || code === 1) {
          console.log(`Ripgrep搜索完成，总共找到 ${resultCount} 个结果`);
          resolve();
        } else {
          reject(new Error(`Ripgrep 退出码: ${code}`));
        }
      });

      rg.on('error', error => {
        console.error('Ripgrep进程错误:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('Ripgrep搜索失败:', error);
    throw error;
  }
}

/**
 * 将Ripgrep匹配转换为DisplayResult格式（处理一行中多个匹配）
 */
function convertMatchToDisplayResults(match: any): SgSearch[] {
  const { data } = match;
  const { submatches, path, lines, line_number, absolute_offset } = data;
  if (!submatches.length) {
    return [];
  }

  const filePath = path.text;
  const lineNumber = line_number - 1; // Ripgrep从1开始，VSCode从0开始
  const lineText = lines.text || '';
  const absoluteOffset = absolute_offset || 0;

  // 处理同一行中的多个匹配
  return submatches.map((submatch: any) => {
    const startColumn = submatch.start;
    const endColumn = submatch.end;
    const matchText = submatch.match.text;
    // 计算字节偏移
    const byteStart = absoluteOffset + startColumn;
    const byteEnd = absoluteOffset + endColumn;

    // 确定文件语言
    const language = getFileLanguage(filePath);

    return {
      file: filePath,
      language,
      lines: lineText,
      text: matchText,
      range: {
        byteOffset: {
          start: byteStart,
          end: byteEnd
        },
        start: {
          line: lineNumber,
          column: startColumn
        },
        end: {
          line: lineNumber,
          column: endColumn
        }
      }
    };
  });
}

/**
 * 根据文件扩展名获取语言类型
 */
function getFileLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.vue': 'vue',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'css',
    '.sass': 'css',
    '.less': 'css',
    '.json': 'json',
    '.md': 'markdown',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.php': 'php',
    '.rb': 'ruby',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.lua': 'lua',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.xml': 'xml',
    '.sh': 'bash',
    '.bash': 'bash'
  };
  return languageMap[ext] || 'plaintext';
}

parentPort.onMessage('search', async payload => {
  const { pattern, includeFile, excludeFile } = payload as PatternQuery;

  if (!pattern) {
    parentPort.postMessage('searchResultStreaming', {
      ...payload,
      searchResult: []
    });
  } else {
    try {
      // 获取工作空间根目录
      const workspaceFolders = workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('没有打开的工作空间');
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;

      // 处理包含文件模式
      const includePatterns = includeFile
        ? includeFile
            .split(',')
            .map(f => f.trim())
            .filter(Boolean)
        : undefined;

      // 处理排除文件模式
      const excludePatterns = excludeFile
        ? excludeFile
            .split(',')
            .map(f => f.trim())
            .filter(Boolean)
        : undefined;

      // 调用新的searchWithRipgrep函数
      await searchWithRipgrep(payload, pattern, workspaceRoot, includePatterns, excludePatterns);
    } catch (error) {
      parentPort.postMessage('error', {
        error: error instanceof Error ? error : new Error(String(error)),
        ...payload
      });
    }
  }

  parentPort.postMessage('searchEnd', payload);
});
