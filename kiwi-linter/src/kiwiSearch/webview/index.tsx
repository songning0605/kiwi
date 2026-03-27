/**
 * @desc 搜索侧边栏视图入口
 * @author zongwenjian
 */

import ReactDOM from 'react-dom/client';
import { SearchSidebar } from './SearchSidebar';

const App = () => {
  return <SearchSidebar />;
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
