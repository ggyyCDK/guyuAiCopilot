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
    let buffer = ''

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()

        // 解析所有 data: {...} 格式的数据块
        // 处理多个连在一起的 data: 块
        let processedIndex = 0

        while (true) {
          const dataIndex = buffer.indexOf('data:', processedIndex)
          if (dataIndex === -1) {
            break
          }

          // 跳过 "data:" 和可能的空白字符，找到 JSON 对象的开始位置
          let jsonStart = dataIndex + 5 // "data:".length
          while (jsonStart < buffer.length && /\s/.test(buffer[jsonStart])) {
            jsonStart++
          }

          if (jsonStart >= buffer.length || buffer[jsonStart] !== '{') {
            processedIndex = dataIndex + 5
            continue
          }

          // 找到完整的 JSON 对象
          let braceCount = 0
          let inString = false
          let escapeNext = false
          let jsonEnd = -1

          for (let i = jsonStart; i < buffer.length; i++) {
            const char = buffer[i]

            if (escapeNext) {
              escapeNext = false
              continue
            }

            if (char === '\\') {
              escapeNext = true
              continue
            }

            if (char === '"' && !escapeNext) {
              inString = !inString
              continue
            }

            if (!inString) {
              if (char === '{') {
                braceCount++
              } else if (char === '}') {
                braceCount--
                if (braceCount === 0) {
                  jsonEnd = i + 1
                  break
                }
              }
            }
          }

          if (jsonEnd === -1) {
            // 没有找到完整的 JSON 对象，保留这部分数据等待下次接收
            buffer = buffer.slice(dataIndex)
            break
          }

          // 提取并解析 JSON
          const jsonStr = buffer.slice(jsonStart, jsonEnd)
          processedIndex = jsonEnd

          try {
            const dataPayload = jsonStr.trim()
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
            console.log('message is:', message)
            switch (message?.eventType) {
              case EventType.Message: {
                const segment = message.content || ''
                content += segment
                cachedContent += segment
                // throttleOnMessage()
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
          } catch (error) {
            console.error('Error parsing JSON:', error, 'JSON string:', jsonStr)
            // 继续处理下一个数据块
          }
        }

        // 清除已处理的数据，保留未处理的部分
        if (processedIndex > 0) {
          buffer = buffer.slice(processedIndex)
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
