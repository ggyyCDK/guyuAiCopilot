import { IToolExecutor } from '@/type/tools/msgToolsParse';
import { getDefaultCollectionName, getDefaultQueryParams } from './ragConfig';
import axios from 'axios';

interface QdrantResult {
    id: string;
    score: number;
    payload: {
        document: string;
        [key: string]: any;
    };
    rerank_score?: number;
}

interface QdrantQueryResponse {
    success: boolean;
    data: {
        results: QdrantResult[];
        total: number;
        timing?: {
            vectorization: number;
            query: number;
            rerank?: number;
        };
    };
    message?: string;
}

/**
 * 格式化知识库搜索结果为XML字符串
 */
function formatKnowledgeBaseResults(
    results: QdrantResult[], 
    query: string, 
    collectionName: string
): string {
    if (results.length === 0) {
        return `<knowledge_base_search_results>
<query>${escapeXml(query)}</query>
<collection>${escapeXml(collectionName)}</collection>
<message>No relevant documents found in the knowledge base.</message>
</knowledge_base_search_results>`;
    }

    const formattedResults = results.map((result, index) => {
        // 截断过长的文档内容
        const documentPreview = result.payload.document.length > 1000 
            ? result.payload.document.substring(0, 1000) + '...' 
            : result.payload.document;

        // 提取payload中的其他元数据（排除document字段）
        const metadata = Object.entries(result.payload)
            .filter(([key]) => key !== 'document')
            .map(([key, value]) => `    <${key}>${escapeXml(String(value))}</${key}>`)
            .join('\n');

        // 构建分数显示（如果有rerank_score则同时显示）
        const scoreAttr = result.rerank_score !== undefined
            ? `score="${result.score.toFixed(4)}" rerank_score="${result.rerank_score.toFixed(4)}"`
            : `score="${result.score.toFixed(4)}"`;

        return `  <result index="${index + 1}" ${scoreAttr} id="${result.id}">
    <document>${escapeXml(documentPreview)}</document>
${metadata ? metadata + '\n' : ''}  </result>`;
    });

    return `<knowledge_base_search_results count="${results.length}">
<query>${escapeXml(query)}</query>
<collection>${escapeXml(collectionName)}</collection>
${formattedResults.join('\n')}
</knowledge_base_search_results>`;
}

/**
 * 转义XML特殊字符
 */
function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * search_knowledge_base 工具实现
 * 从RAG知识库检索相关文档
 */
export const searchKnowledgeBase: IToolExecutor = async (command) => {
    const { toolUseCommand } = command;
    const { params } = toolUseCommand;

    // 获取默认配置
    const defaultParams = getDefaultQueryParams();

    // 获取查询参数
    const query = params.query?.trim();
    const collectionName = params.collection || getDefaultCollectionName();
    const topk = params.topk ? parseInt(params.topk, 10) : defaultParams.topk;
    const scoreThreshold = params.score_threshold 
        ? parseFloat(params.score_threshold) 
        : defaultParams.scoreThreshold;
    const useRerank = params.use_rerank === 'true' || defaultParams.useRerank;
    const rerankTopN = params.rerank_top_n 
        ? parseInt(params.rerank_top_n, 10) 
        : defaultParams.rerankTopN;

    // 参数验证
    if (!query) {
        return {
            toolResult: '<knowledge_base_search_results>\n<error>Missing required parameter: query</error>\n</knowledge_base_search_results>'
        };
    }

    console.log('[SearchKnowledgeBase] Querying:', {
        query,
        collectionName,
        topk,
        scoreThreshold,
        useRerank
    });

    try {
        // 构建请求参数
        const requestBody: Record<string, any> = {
            text: query,
            topk,
            collectionName,
            useRerank,
        };

        // 可选参数
        if (scoreThreshold !== undefined) {
            requestBody.scoreThreshold = scoreThreshold;
        }
        if (rerankTopN !== undefined) {
            requestBody.rerankTopN = rerankTopN;
        }

        // 调用后端Qdrant查询接口
        const baseUrl = 'http://127.0.0.1:7001';
        const response = await axios.post<QdrantQueryResponse>(
            `${baseUrl}/api/v1/qdrant/query`,
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30秒超时
            }
        );

        if (!response.data.success) {
            const errorMsg = response.data.message || 'Query failed';
            console.error('[SearchKnowledgeBase] Query failed:', errorMsg);
            return {
                toolResult: `<knowledge_base_search_results>\n<error>${escapeXml(errorMsg)}</error>\n</knowledge_base_search_results>`
            };
        }

        const results = response.data.data.results || [];
        console.log('[SearchKnowledgeBase] Found', results.length, 'results');

        return {
            toolResult: formatKnowledgeBaseResults(results, query, collectionName)
        };

    } catch (error: any) {
        const errorMessage = error.response?.data?.message || error.message || String(error);
        console.error('[SearchKnowledgeBase] Error:', errorMessage);

        return {
            toolResult: `<knowledge_base_search_results>
<error>Failed to query knowledge base: ${escapeXml(errorMessage)}</error>
</knowledge_base_search_results>`
        };
    }
};
