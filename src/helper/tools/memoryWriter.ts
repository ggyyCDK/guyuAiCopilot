import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// 记忆条目接口
export interface MemoryEntry {
    timestamp: string;
    conversationId: string;
    turn: number;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    tools?: string[];
    files?: string[];
    keywords: string[];
}

// 当前会话状态
let currentConversationId: string = '';
let currentTurn: number = 0;

/**
 * 获取记忆存储目录路径
 */
function getMemoryDir(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    return path.join(workspaceFolders[0].uri.fsPath, '.roo', 'memory');
}

/**
 * 获取记忆文件路径
 */
function getMemoryFilePath(): string | undefined {
    const memoryDir = getMemoryDir();
    if (!memoryDir) {
        return undefined;
    }
    return path.join(memoryDir, 'conversations.jsonl');
}

/**
 * 确保记忆目录存在
 */
function ensureMemoryDir(): boolean {
    const memoryDir = getMemoryDir();
    if (!memoryDir) {
        console.log('[MemoryWriter] No workspace folder found');
        return false;
    }
    
    try {
        if (!fs.existsSync(memoryDir)) {
            fs.mkdirSync(memoryDir, { recursive: true });
            console.log('[MemoryWriter] Created memory directory:', memoryDir);
        }
        return true;
    } catch (error) {
        console.error('[MemoryWriter] Failed to create memory directory:', error);
        return false;
    }
}

/**
 * 生成唯一的对话ID
 */
function generateConversationId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `conv_${timestamp}_${random}`;
}

/**
 * 提取关键词
 * 支持中英文关键词提取
 */
export function extractKeywords(content: string): string[] {
    const keywords: Set<string> = new Set();
    
    // 移除代码块
    const cleanContent = content.replace(/```[\s\S]*?```/g, '');
    
    // 提取英文技术词汇 (驼峰命名、下划线命名等)
    const techTerms = cleanContent.match(/[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*/g) || [];
    techTerms.forEach(term => {
        if (term.length >= 3 && term.length <= 50) {
            keywords.add(term.toLowerCase());
        }
    });
    
    // 提取中文关键词 (2-6个字的词组)
    const chineseTerms = cleanContent.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
    chineseTerms.forEach(term => {
        keywords.add(term);
    });
    
    // 过滤常见停用词
    const stopWords = new Set([
        'the', 'and', 'for', 'this', 'that', 'with', 'from', 'have', 'has',
        'are', 'was', 'were', 'will', 'would', 'could', 'should', 'can',
        'not', 'but', 'what', 'when', 'where', 'which', 'who', 'how', 'why',
        'all', 'any', 'some', 'each', 'every', 'both', 'few', 'more', 'most',
        '的', '是', '在', '和', '了', '有', '我', '你', '他', '她', '它',
        '这', '那', '什么', '怎么', '为什么', '如何', '可以', '需要', '使用'
    ]);
    
    const filteredKeywords = Array.from(keywords).filter(kw => !stopWords.has(kw));
    
    // 限制关键词数量，取前20个
    return filteredKeywords.slice(0, 20);
}

/**
 * 初始化新的对话
 */
export function initConversation(): string {
    currentConversationId = generateConversationId();
    currentTurn = 0;
    console.log('[MemoryWriter] Initialized new conversation:', currentConversationId);
    return currentConversationId;
}

/**
 * 增加对话轮次
 */
export function incrementTurn(): number {
    currentTurn++;
    return currentTurn;
}

/**
 * 获取当前对话ID
 */
export function getCurrentConversationId(): string {
    return currentConversationId;
}

/**
 * 获取当前轮次
 */
export function getCurrentTurn(): number {
    return currentTurn;
}

/**
 * 写入记忆条目
 */
export async function writeMemory(params: {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    tools?: string[];
    files?: string[];
}): Promise<boolean> {
    if (!ensureMemoryDir()) {
        return false;
    }
    
    const memoryFilePath = getMemoryFilePath();
    if (!memoryFilePath) {
        return false;
    }
    
    // 如果没有对话ID，初始化一个
    if (!currentConversationId) {
        initConversation();
    }
    
    const entry: MemoryEntry = {
        timestamp: new Date().toISOString(),
        conversationId: currentConversationId,
        turn: currentTurn,
        role: params.role,
        content: params.content,
        tools: params.tools,
        files: params.files,
        keywords: extractKeywords(params.content)
    };
    
    try {
        const jsonLine = JSON.stringify(entry) + '\n';
        fs.appendFileSync(memoryFilePath, jsonLine, 'utf-8');
        console.log('[MemoryWriter] Wrote memory entry for', params.role, 'turn', currentTurn);
        return true;
    } catch (error) {
        console.error('[MemoryWriter] Failed to write memory:', error);
        return false;
    }
}

/**
 * 读取所有记忆条目
 */
export function readAllMemories(): MemoryEntry[] {
    const memoryFilePath = getMemoryFilePath();
    if (!memoryFilePath || !fs.existsSync(memoryFilePath)) {
        return [];
    }
    
    try {
        const content = fs.readFileSync(memoryFilePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.length > 0);
        return lines.map(line => JSON.parse(line) as MemoryEntry);
    } catch (error) {
        console.error('[MemoryWriter] Failed to read memories:', error);
        return [];
    }
}

/**
 * 获取记忆文件统计信息
 */
export function getMemoryStats(): { totalEntries: number; totalConversations: number; fileSizeKB: number } {
    const memoryFilePath = getMemoryFilePath();
    if (!memoryFilePath || !fs.existsSync(memoryFilePath)) {
        return { totalEntries: 0, totalConversations: 0, fileSizeKB: 0 };
    }
    
    try {
        const stats = fs.statSync(memoryFilePath);
        const memories = readAllMemories();
        const conversationIds = new Set(memories.map(m => m.conversationId));
        
        return {
            totalEntries: memories.length,
            totalConversations: conversationIds.size,
            fileSizeKB: Math.round(stats.size / 1024 * 100) / 100
        };
    } catch (error) {
        console.error('[MemoryWriter] Failed to get memory stats:', error);
        return { totalEntries: 0, totalConversations: 0, fileSizeKB: 0 };
    }
}
