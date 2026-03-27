/**
 * @desc 排除文件
 * @author zongwenjian
 */

import { SearchInput } from './SearchInput';
const titleStyle = {
  paddingTop: '6px'
};

interface ExcludeFileProps {
  excludeFile: string;
  setExcludeFile: (value: string) => void;
  refreshResult: () => void;
}

export default function ExcludeFile({ excludeFile, setExcludeFile, refreshResult }: ExcludeFileProps) {
  return (
    <div style={titleStyle}>
      <SearchInput
        isSingleLine={true}
        placeholder="排除的文件"
        value={excludeFile}
        onChange={setExcludeFile}
        onKeyEnterUp={refreshResult}
      />
    </div>
  );
}
