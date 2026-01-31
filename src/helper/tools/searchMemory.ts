import { IToolExecutor } from '@/type/tools/msgToolsParse';
import { readAllMemories, MemoryEntry } from './memoryWriter';

interface SearchResult {
    entry: MemoryEntry;
    relevance: number;
}

/**
 * 计算关键词匹配的相关性得分
 */
function calculateRelevance(entry: MemoryEntry, queryKeywords: string[]): number {
    let score = 0;
    const entryKeywords = new Set(entry.keywords.map(k => k.toLowerCase()));
    const contentLower = entry.content.toLowerCase();
    
    for (const keyword of queryKeywords) {
        const keywordLower = keyword.toLowerCase();
        
        // 关键词精确匹配（在keywords数组中）
        if (entryKeywords.has(keywordLower)) {
            score += 3;
        }
        
        // 内容包含关键词
        if (contentLower.includes(keywordLower)) {
            score += 2;
        }
        
        // 文件路径匹配
        if (entry.files) {
            for (const file of entry.files) {
                if (file.toLowerCase().includes(keywordLower)) {
                    score += 2;
                }
            }
        }
        
        // 工具名称匹配
        if (entry.tools) {
            for (const tool of entry.tools) {
                if (tool.toLowerCase().includes(keywordLower)) {
                    score += 1;
                }
            }
        }
    }
    
    return score;
}

/**
 * 解析查询字符串为关键词列表
 */
function parseQuery(query: string): string[] {
    // 移除多余空格，分割为关键词
    const keywords = query
        .trim()
        .split(/[\s,，、]+/)
        .filter(k => k.length > 0);
    
    return keywords;
}

/**
 * 格式化搜索结果为可读字符串
 */
function formatResults(results: SearchResult[]): string {
    if (results.length === 0) {
        return '<search_results>\n<message>No relevant memories found for the given query.</message>\n</search_results>';
    }
    
    const formattedEntries = results.map((result, index) => {
        const { entry } = result;
        const filesInfo = entry.files && entry.files.length > 0 
            ? `\n    <files>${entry.files.join(', ')}</files>` 
            : '';
        const toolsInfo = entry.tools && entry.tools.length > 0 
            ? `\n    <tools>${entry.tools.join(', ')}</tools>` 
            : '';
        
        // 截断过长的内容
        const contentPreview = entry.content.length > 500 
            ? entry.content.substring(0, 500) + '...' 
            : entry.content;
        
        return `  <result index="${index + 1}" relevance="${result.relevance}">
    <timestamp>${entry.timestamp}</timestamp>
    <conversation_id>${entry.conversationId}</conversation_id>
    <turn>${entry.turn}</turn>
    <role>${entry.role}</role>
    <content>${contentPreview}</content>${filesInfo}${toolsInfo}
    <keywords>${entry.keywords.join(', ')}</keywords>
  </result>`;
    });
    
    return `<search_results count="${results.length}">\n${formattedEntries.join('\n')}\n</search_results>`;
}

/**
 * search_memory 工具实现
 * 搜索历史对话记忆
 */
export const searchMemory: IToolExecutor = async (command) => {
    const { toolUseCommand } = command;
    const { params } = toolUseCommand;
    
    // 获取查询参数
    const query = params.query?.trim();
    const limitStr = params.limit;
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    
    if (!query) {
        return {
            toolResult: '<search_results>\n<error>Missing required parameter: query</error>\n</search_results>'
        };
    }
    
    console.log('[SearchMemory] Searching for:', query, 'limit:', limit);
    
    // 解析查询关键词
    const queryKeywords = parseQuery(query);
    
    if (queryKeywords.length === 0) {
        return {
            toolResult: '<search_results>\n<error>No valid keywords found in query</error>\n</search_results>'
        };
    }
    
    // 读取所有记忆
    const memories = readAllMemories();
    
    if (memories.length === 0) {
        return {
            toolResult: '<search_results>\n<message>No memories stored yet. Start having conversations to build memory.</message>\n</search_results>'
        };
    }
    
    // 计算每个记忆条目的相关性得分
    const scoredResults: SearchResult[] = memories
        .map(entry => ({
            entry,
            relevance: calculateRelevance(entry, queryKeywords)
        }))
        .filter(result => result.relevance > 0)  // 只保留有相关性的结果
        .sort((a, b) => b.relevance - a.relevance)  // 按相关性降序排序
        .slice(0, limit);  // 限制结果数量
    
    console.log('[SearchMemory] Found', scoredResults.length, 'relevant results');
    
    return {
        toolResult: formatResults(scoredResults)
    };
};
