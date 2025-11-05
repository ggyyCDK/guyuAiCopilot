import { spawn } from 'child_process';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import * as vscode from 'vscode';
import { Status } from './utils';

function getWorkspaceRootPath() {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return `${folders[0].uri.fsPath}`;
  }
  return '';
}

export const test = (question) => {
  fetchEventSource('http://127.0.0.1:7001/api/v1/code-review/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uid: '123',
      variableMaps: {
        workDir: '/',
        question: question,
        stream: true
      }
    }),
    openWhenHidden: true,
    onmessage: (msg) => {
      console.log('msg', msg);
    },
  });
  return 'i am success'
};
