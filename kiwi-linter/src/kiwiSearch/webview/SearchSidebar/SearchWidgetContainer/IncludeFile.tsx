/**
 * @desc 包含文件
 * @author zongwenjian
 */

import { SearchInput } from './SearchInput';
const titleStyle = {
  paddingTop: '20px'
};

interface IncludeFileProps {
  includeFile: string;
  setIncludeFile: (value: string) => void;
  refreshResult: () => void;
}

export default function IncludeFile({ includeFile, setIncludeFile, refreshResult }: IncludeFileProps) {
  return (
    <div style={titleStyle}>
      <SearchInput
        isSingleLine={true}
        placeholder="包含的文件"
        value={includeFile}
        onChange={setIncludeFile}
        onKeyEnterUp={refreshResult}
      />
    </div>
  );
}
