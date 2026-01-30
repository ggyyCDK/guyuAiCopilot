import { MessageStatus } from '@/type/imType/im';
import { ToolStatus } from '../components/ContentContainer';

/**
 * 将消息状态转换为工具状态
 */
export function getToolStatus(messageStatus: MessageStatus): ToolStatus {
    switch (messageStatus) {
        case MessageStatus.Complete:
            return 'complete';
        case MessageStatus.INVALID:
            return 'error';
        case MessageStatus.Init:
        case MessageStatus.Sending:
        case MessageStatus.Waiting:
        default:
            return 'pending';
    }
}

/**
 * 工具状态对应的文本映射
 */
export const toolStatusTextMap: Record<string, Record<ToolStatus, string>> = {
    read_file: {
        pending: '正在读取...',
        complete: '读取完成',
        error: '读取失败',
    },
    write_to_file: {
        pending: '正在写入...',
        complete: '写入完成',
        error: '写入失败',
    },
    replace_in_file: {
        pending: '正在编辑...',
        complete: '编辑完成',
        error: '编辑失败',
    },
    apply_diff: {
        pending: '正在编辑文件...',
        complete: '编辑完成',
        error: '编辑失败',
    },
    list_files: {
        pending: '正在列出文件...',
        complete: '列出完成',
        error: '列出失败',
    },
    search_files: {
        pending: '正在搜索...',
        complete: '搜索完成',
        error: '搜索失败',
    },
    execute_command: {
        pending: '正在执行命令...',
        complete: '执行完成',
        error: '执行失败',
    },
    use_mcp_tool: {
        pending: '正在调用工具...',
        complete: '调用完成',
        error: '调用失败',
    },
    attempt_completion: {
        pending: '正在完成任务...',
        complete: '任务完成',
        error: '任务失败',
    },
    update_todo_list: {
        pending: '正在更新待办...',
        complete: '更新完成',
        error: '更新失败',
    },
    ask_followup_question: {
        pending: '等待回答...',
        complete: '',
        error: '',
    },
};

/**
 * 获取工具状态文本
 */
export function getToolStatusText(toolName: string, status: ToolStatus): string {
    const textMap = toolStatusTextMap[toolName];
    if (textMap) {
        return textMap[status] || '';
    }
    // 默认文本
    switch (status) {
        case 'pending':
            return '执行中...';
        case 'complete':
            return '已完成';
        case 'error':
            return '执行失败';
        default:
            return '';
    }
}
