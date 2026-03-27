import { ExtensionContext } from 'vscode';
import { activatePreview } from './preview';
import { activateSearch } from './search';
import { activateWebview } from './webview';

export async function kiwiSearch(context: ExtensionContext) {
  activateWebview(context);
  activateSearch(context);
  activatePreview(context);
}
