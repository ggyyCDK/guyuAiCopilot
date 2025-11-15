import * as vscode from 'vscode';
import axios from 'axios';
import { ApiRequestParams, EventType, ParseResult } from '@/type/aiRequest'
import { safetyParse } from '@/utils/parse'
import { throttle } from 'lodash'
import { Readable } from 'stream';

const defaultBaseUrl = 'http://127.0.0.1:7001'
function getWorkspaceRootPath() {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return `${folders[0].uri.fsPath}`;
  }
  return '';
}

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
      onIntervalMessage?.(message)
      cachedContent = ''
    }
  }

  const throttleOnMessage = throttle(handleIntervalMessage, 500)

  const questionFinalData = Array.isArray(question) ? question : [
    {
      role: 'user',
      content: question
    }
  ]

  const requestBaseUrl = (baseUrl || defaultBaseUrl).replace(/\/$/, '')
  const requestUrl = `${requestBaseUrl}/api/v1/agent/run`

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
    console.log('stream is:', stream)
    let buffer = ''

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        console.log('chunk.toString():', chunk.toString())
        buffer += chunk.toString()
        let separatorIndex = buffer.indexOf('\n\n')

        while (separatorIndex !== -1) {
          const rawEvent = buffer.slice(0, separatorIndex)
          buffer = buffer.slice(separatorIndex + 2)
          separatorIndex = buffer.indexOf('\n\n')

          const dataLines = rawEvent
            .split('\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.replace(/^data:\s*/, ''))

          if (dataLines.length === 0) {
            continue
          }

          const dataPayload = dataLines.join('\n').trim()
          if (!dataPayload) {
            continue
          }

          if (dataPayload === '[DONE]') {
            isCompleted = true
            throttleOnMessage.flush()
            handleIntervalMessage()
            onComplete?.({ segmentContent: '', content })
            continue
          }

          const message = safetyParse(dataPayload) as ParseResult

          switch (message?.eventType) {
            case EventType.Message: {
              const segment = message.content || ''
              content += segment
              cachedContent += segment
              throttleOnMessage()
              // onMessage?.({ segmentContent: segment, content })
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
        }
      })

      stream.on('end', () => {
        streamClosed = true
        resolve()
      })

      stream.on('error', (err) => {
        streamClosed = true
        reject(err)
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
