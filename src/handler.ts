import * as vscode from 'vscode';
import axios from 'axios';
import { ApiRequestParams, EventType, ParseResult } from '@/type/imType/aiRequest'
import { safetyParse } from '@/utils/parse'
import { typewriter } from '@/utils/llmUtils/typewriter'
import { throttle } from 'lodash'
import { Readable } from 'stream';

const defaultBaseUrl = 'http://127.0.0.1:7001'
function getWorkspaceRootPath() {
  // 获取当前打开的文件
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    const currentFile = activeEditor.document.uri.fsPath;
    console.log('当前打开的文件:', currentFile);
    return currentFile;
  }

  // 如果没有打开的文件，返回工作区根路径
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }
  return '';
}

/**
 * 流式对话处理
 * @param command ApiRequestParams
 * @returns void
 */
export const streamAgentChat = async (command: ApiRequestParams) => {
  const { question, workerId, conversationId, baseUrl, variableMaps, onMessage, onIntervalMessage, onComplete, onError } = command;
  const { llmConfig } = variableMaps ?? {}
  const { ak, ApiUrl } = llmConfig
  let content = ''
  let cachedContent = ''
  let isCompleted = false
  let streamClosed = false

  const handleIntervalMessage = () => {
    if (cachedContent) {
      const message = { segmentContent: cachedContent, content }
      console.log('throttle message is:', message)
      onIntervalMessage?.(message)
      cachedContent = ''
    }
  }

  const throttleOnMessage = throttle(handleIntervalMessage, 500)

  const questionFinalData = [
    {
      role: 'user',
      content: question
    }
  ]

  const requestBaseUrl = (baseUrl || defaultBaseUrl).replace(/\/$/, '')
  const requestUrl = `${requestBaseUrl}/api/v1/agent/run`
  const currentFilePath = getWorkspaceRootPath()
  console.log('当前打开的文件路径:', currentFilePath)
  try {
    const response = await axios.post(requestUrl, {
      sessionId: conversationId,
      workerId,
      variableMaps: {
        llmConfig: {
          cwdFormatted: '/',
          model: 'claude_sonnet4',
          ak,
          ApiUrl
        }
      },
      question: questionFinalData,
      stream: true
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-ak': ak ?? ''
      },
      responseType: 'stream'
    })

    const stream = response.data as Readable

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        const dataPayload = chunk.toString()
        const message = safetyParse(dataPayload) as ParseResult
        console.log('out message is:', message, message?.eventType)
        switch (message?.eventType) {
          case EventType.Message: {
            const segment = message.content || ''
            content += segment
            cachedContent += segment
            throttleOnMessage()
            onMessage?.({ segmentContent: segment, content })
            break
          }
          case EventType.Complete: {
            isCompleted = true
            throttleOnMessage.flush()
            handleIntervalMessage()
            onComplete?.({ segmentContent: '', content })
            break
          }
          case EventType.MessageError: {
            throttleOnMessage.flush()
            handleIntervalMessage()
            onError?.(message.content || 'stream error')
            break
          }
          case EventType.Usage:
          case EventType.Null:
          default:
            break
        }
      })
    })
  } catch (error) {
    handleIntervalMessage()
    onError?.(error)
  } finally {
    throttleOnMessage.cancel()
    if (!streamClosed) {
      handleIntervalMessage()
    }
    if (!isCompleted) {
      onComplete?.({ segmentContent: '', content })
    }
  }
};

/**
 * 尝试API请求，打字机效果
 * @param command 
 * @returns 
 */
export const attemptApiRequest = async function* (command: ApiRequestParams) {
  const { question, workerId, conversationId, baseUrl, variableMaps } = command;

  let responseBufferList: string[] = []
  let isCompleted = false

  const streamPromise = new Promise<void>((resolve, reject) => {
    try {
      streamAgentChat({
        question,
        workerId,
        conversationId,
        variableMaps,
        baseUrl,
        onIntervalMessage: (msg) => {
          responseBufferList.push(msg.segmentContent)
        },
        onComplete: (data) => {
          isCompleted = true
          resolve()
        },
        onError: (error) => {
          reject(error)
        }
      });
    } catch (error) {
      reject(error)
    }
  })
  console.log('responseBufferList is:', responseBufferList)
  while (!isCompleted || responseBufferList.length > 0) {
    const responseBuffer = responseBufferList.shift()
    if (responseBuffer) {
      yield responseBuffer
    } else {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  await streamPromise
}

//再包一层
export const attemptApiRequestTypeWriter = async function* (command: ApiRequestParams) {
  const outputStream = attemptApiRequest(command);
  let responseBufferList: string[] = []
  let isCompleted = false
  const typewriterPromise = new Promise<void>((resolve, reject) => {
    typewriter({
      stream: outputStream,
      onMessage: (message) => {
        responseBufferList.push(message)
      },
      onComplete: () => {
        isCompleted = true
        resolve()
      }
    }).catch(err => {
      isCompleted = true;
      reject(err)
    })
  })

  while (!isCompleted || responseBufferList.length > 0) {
    const responseBuffer = responseBufferList.shift()
    if (responseBuffer) {
      yield responseBuffer
    } else {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  await typewriterPromise
}