import { spawn } from 'child_process';
import * as vscode from 'vscode';
import { Status } from './utils';

function getWorkspaceRootPath() {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return `${folders[0].uri.fsPath}`;
  }
  return '';
}

export const test = () => {
  return 'i am success'
};
