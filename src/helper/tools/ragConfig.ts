import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface RagConfig {
    defaultCollection: string;
    queryDefaults: {
        topk: number;
        scoreThreshold?: number;
        useRerank: boolean;
        rerankTopN?: number;
    };
}

const DEFAULT_CONFIG: RagConfig = {
    defaultCollection: 'my-collection',
    queryDefaults: {
        topk: 5,
        useRerank: true
    }
};

/**
 * 获取RAG配置文件路径
 */
function getRagConfigPath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    return path.join(workspaceFolders[0].uri.fsPath, '.schoober', 'rag-config.json');
}

/**
 * 读取RAG配置
 */
export function loadRagConfig(): RagConfig {
    const configPath = getRagConfigPath();
    if (!configPath || !fs.existsSync(configPath)) {
        console.log('[RagConfig] No config file found, using defaults');
        return DEFAULT_CONFIG;
    }

    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content);
        const knowledgeBase = config.knowledgeBase || {};
        
        return {
            defaultCollection: knowledgeBase.defaultCollection || DEFAULT_CONFIG.defaultCollection,
            queryDefaults: {
                ...DEFAULT_CONFIG.queryDefaults,
                ...knowledgeBase.queryDefaults
            }
        };
    } catch (error) {
        console.error('[RagConfig] Failed to load config:', error);
        return DEFAULT_CONFIG;
    }
}

/**
 * 获取默认的collection名称
 */
export function getDefaultCollectionName(): string {
    const config = loadRagConfig();
    return config.defaultCollection;
}

/**
 * 获取默认查询参数
 */
export function getDefaultQueryParams(): RagConfig['queryDefaults'] {
    const config = loadRagConfig();
    return config.queryDefaults;
}
