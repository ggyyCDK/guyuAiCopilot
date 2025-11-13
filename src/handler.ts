import * as vscode from 'vscode';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { ApiRequestParams, EventType, ParseResult } from '@/type/aiRequest'
import { safetyParse } from '@/utils/parse'
import { throttle } from 'lodash'

const defaultBaseUrl = 'http://127.0.0.1:7001'
function getWorkspaceRootPath() {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return `${folders[0].uri.fsPath}`;
  }
  return '';
}

export const streamAgentChat = async (command: ApiRequestParams) => {
  const { userContent, conversationId, ak, ApiUrl, onMessage, onIntervalMessage, onComplete, onError } = command;

  let content = ''
  let cachedContent = ''
  let isCompleted = false

  const handleIntervalMessage = () => {
    if (cachedContent) {
      const message = { segmentContent: cachedContent, content }
      onIntervalMessage?.(message)
      cachedContent = '' //重置缓存
    }
  }

  //缓存返回的内容
  const throttleOnMessage = throttle(handleIntervalMessage, 500)

  const question = Array.isArray(userContent) ? userContent : [
    {
      role: 'user',
      content: userContent
    }
  ]

  const requestBaseUrl = (ApiUrl || defaultBaseUrl).replace(/\/$/, '')
  const requestUrl = `${requestBaseUrl}/api/v1/agent/run`

  try {
    await fetchEventSource(requestUrl, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'x-ak': ak ?? ''
      },
      body: JSON.stringify({
        sessionId: conversationId,
        variableMaps: {
          workDir: getWorkspaceRootPath(),
          model: 'claude_sonnet4'
        },
        question,
        stream: true
      }),
      openWhenHidden: true,
      onmessage(msg) {
        if (!msg.data) return;
        const message = safetyParse(msg.data) as ParseResult
        switch (message?.eventType) {
          case EventType.Message: {
            content += message.content || ''
            cachedContent += message.content || ''
            throttleOnMessage()
            onMessage?.({ segmentContent: message.content || '', content })
            break
          }
          case EventType.Complete: {
            isCompleted = true
            handleIntervalMessage()
            onComplete?.({ segmentContent: '', content })
            break
          }
          case EventType.MessageError: {
            handleIntervalMessage()
            onError?.(message.content || 'stream error')
            break
          }
        }
      },
      onerror(err) {
        handleIntervalMessage()
        onError?.(err)
        throw err
      }
    })
  } catch (error) {
    handleIntervalMessage()
    onError?.(error)
  } finally {
    throttleOnMessage.cancel()
    if (!isCompleted) {
      handleIntervalMessage()
      onComplete?.({ segmentContent: '', content })
    }
  }
};
