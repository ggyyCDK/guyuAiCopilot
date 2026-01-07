import * as vscode from 'vscode';
import axios from 'axios';
import { ApiRequestParams, EventType, ParseResult, CompressSessionContextParams, CompressSessionContextResponse } from '@/type/imType/aiRequest'
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
    // console.log('当前打开的文件:', currentFile);
    return currentFile;
  }

  // 如果没有打开的文件，返回工作区根路径
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }
  return '';
}

export function getWorkspaceCwd() {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }
  return process.cwd();
}

/**
 * 流式对话处理
 * @param command ApiRequestParams
 * @returns void
 */
export const streamAgentChat = async (command: ApiRequestParams) => {
  const { question, workerId, conversationId, baseUrl, variableMaps, mcpHubDataInfo,
    mcpHub, onMessage, onIntervalMessage, onUsage, onComplete, onError, skills } = command;
  console.log('streamAgentChat skills is:', skills)
  const { llmConfig } = variableMaps ?? {}
  const { ak, ApiUrl } = llmConfig
  let content = ''
  let cachedContent = ''
  let isCompleted = false
  let streamClosed = false

  const handleIntervalMessage = () => {
    if (cachedContent) {
      const message = { segmentContent: cachedContent, content }
      // console.log('throttle message is:', message)
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
  const currentCwd = getWorkspaceCwd()
  const sessionTitle = question[0].text
  try {
    const response = await axios.post(requestUrl, {
      sessionId: conversationId,
      sessionTitle,
      workerId,
      mcpHubDataInfo,
      mcpHub,
      skills,
      variableMaps: {
        llmConfig: {
          cwdFormatted: currentCwd,
          model: 'claude-sonnet-4-5-20250929',
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
      responseType: 'stream',
      signal: command.signal
    })

    const stream = response.data as Readable

    await new Promise<void>((resolve, reject) => {

      stream.on('data', (chunk: Buffer) => {
        const dataPayload = chunk.toString()
        const message = safetyParse(dataPayload) as ParseResult
        // console.log('out message is:', message)
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
            // throttleOnMessage.flush()
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
          case EventType.Usage: {
            onUsage?.(message.content)
            break
          }
          case EventType.Null: {
            // EventType.Null 不返回数据，直接跳过
            break;
          }
          default:
            break
        }
      })


    })
  } catch (error) {
    if (axios.isCancel(error)) {
      console.log('Request canceled');
      onComplete?.({ segmentContent: '', content });
    } else {
      onError?.(error);
    }
  } finally {
    throttleOnMessage.cancel()
    if (!streamClosed) {
      // handleIntervalMessage()
    }
    if (!isCompleted) {
      // onComplete?.({ segmentContent: '', content })
    }
  }
};

/**
 * 尝试API请求，打字机效果
 * @param command 
 * @returns 
 */
export const attemptApiRequest = async function* (command: ApiRequestParams) {
  const { question, workerId, conversationId, baseUrl, variableMaps, mcpHubDataInfo,
    mcpHub, skills } = command;

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
        mcpHubDataInfo,
        mcpHub,
        skills,
        onIntervalMessage: (msg) => {
          responseBufferList.push(msg.segmentContent)
        },
        onUsage: (usage) => {
          console.log('usage is:', usage)
          // 将usage数据传递给调用方
          command.onUsage?.(usage)
        },
        onComplete: (data) => {
          isCompleted = true
          // console.log('streamPromise onComplete is:', data)
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
  // console.log('responseBufferList is:', responseBufferList)
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

//再包一层打字机效果
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
        console.log('typewriterPromise onComplete is:', isCompleted)
        resolve()
      }
    }).catch(err => {
      isCompleted = true;
      reject(err)
    })
  })

  while (!isCompleted || responseBufferList.length > 0) {
    if (responseBufferList.length > 0) {
      const responseBuffer = responseBufferList.shift()
      yield responseBuffer
    } else {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  await typewriterPromise
}

/**
 * 压缩会话上下文
 * @param params 压缩参数
 * @returns 压缩结果
 */
export const compressSessionContext = async (
  params: CompressSessionContextParams
): Promise<CompressSessionContextResponse> => {
  const { sessionId, baseUrl, apiKey } = params;
  const requestBaseUrl = (baseUrl || defaultBaseUrl).replace(/\/$/, '');
  const requestUrl = `${requestBaseUrl}/api/v1/agent/compress-context`;

  try {
    const response = await axios.post(requestUrl, {
      sessionId,
      apiKey
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } else {
      throw new Error(response.data.message || '压缩失败');
    }
  } catch (error: any) {
    console.error('压缩会话上下文失败:', error);
    throw new Error(error.response?.data?.message || error.message || '压缩会话上下文失败');
  }
};

/**
 * 获取会话列表
 * @param pwd 当前工作目录
 * @param baseUrl API基础地址
 * @returns 会话列表
 */
export const fetchSessionList = async (pwd: string, baseUrl?: string) => {
  const requestBaseUrl = (baseUrl || defaultBaseUrl).replace(/\/$/, '');
  const requestUrl = `${requestBaseUrl}/api/v1/agent/get-session-list-by-pwd`;
  console.log(requestUrl, 'requestUrl')
  try {
    const response = await axios.post(requestUrl, {
      pwd
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('历史会话 response is:', response)
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.message || '获取会话列表失败');
    }
  } catch (error: any) {
    console.error('获取会话列表失败:', error);
    throw new Error(error.response?.data?.message || error.message || '获取会话列表失败');
  }
};

/**
 * 保存会话消息
 * @param params 保存参数
 * @returns 保存结果
 */
export const saveChatMessage = async (
  params: { sessionId: string, message: any, baseUrl?: string }
) => {
  const { sessionId, message, baseUrl } = params;
  const requestBaseUrl = (baseUrl || defaultBaseUrl).replace(/\/$/, '');
  const requestUrl = `${requestBaseUrl}/api/v1/agent/save-chatmessages`;

  try {
    const response = await axios.post(requestUrl, {
      sessionId,
      chatMessage: message
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('保存消息 response is:', response)
    if (response.data.success) {
      return response.data;
    } else {
      throw new Error(response.data.message || '保存消息失败');
    }
  } catch (error: any) {
    console.error('保存消息失败:', error);
    throw new Error(error.response?.data?.message || error.message || '保存消息失败');
  }
};

/**
 * 获取会话消息列表
 * @param params 获取参数
 * @returns 消息列表
 */
export const getChatMessages = async (
  params: { sessionId: string, baseUrl?: string }
) => {
  const { sessionId, baseUrl } = params;
  const requestBaseUrl = (baseUrl || defaultBaseUrl).replace(/\/$/, '');
  const requestUrl = `${requestBaseUrl}/api/v1/agent/get-chatmessages`;
  console.log('getChatMessages is:', sessionId, requestUrl)
  try {
    const response = await axios.get(requestUrl, {
      params: {
        sessionId
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('getChatMessages response is:', response)
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.message || '获取消息列表失败');
    }
  } catch (error: any) {
    console.error('获取消息列表失败:', error);
    throw new Error(error.response?.data?.message || error.message || '获取消息列表失败');
  }
};

