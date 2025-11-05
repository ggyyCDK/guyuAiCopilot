import { spawn } from 'child_process';
import axios from 'axios';
import * as vscode from 'vscode';
import { Status } from './utils';

function getWorkspaceRootPath() {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return `${folders[0].uri.fsPath}`;
  }
  return '';
}

export const test = async (question: string, onMessage?: (data: string) => void) => {
  try {
    const response = await axios({
      method: 'POST',
      url: 'http://127.0.0.1:7001/api/v1/code-review/run',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      data: {
        variableMaps: {
          workDir: getWorkspaceRootPath(),
          question,
          stream: true
        }
      },
      responseType: 'stream'
    });

    let buffer = '';

    response.data.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');

      // 保留最后一个不完整的行
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = line.slice(6).trim();
          if (data && data !== '[DONE]') {
            try {
              const jsonData = JSON.parse(data);
              // console.log('msg', jsonData);
              if (onMessage) {
                onMessage(jsonData);
              }
            } catch (e) {
              // 如果不是 JSON，直接使用原始数据
              // console.log('msg', data);
              if (onMessage) {
                onMessage(data);
              }
            }
          }
        }
      }
    });

    response.data.on('end', () => {
      console.log('Stream ended successfully');
    });

    response.data.on('error', (err: Error) => {
      console.error('Stream error:', err);
    });

    return 'Stream started successfully';
  } catch (error) {
    console.error('Request error:', error);
    if (axios.isAxiosError(error)) {
      throw new Error(`HTTP ${error.response?.status}: ${error.message}`);
    }
    throw error;
  }
};
