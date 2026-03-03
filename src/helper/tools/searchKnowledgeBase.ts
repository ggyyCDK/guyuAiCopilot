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
    original_score?: number;
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

export interface RagStats {
    returnRate: number;      // 返回率: results.length / topk
    highScoreRate: number;   // 高分命中率: score > threshold 的数量 / results.length
    avgScore: number;        // 平均分数
    rerankBoostRate: number; // Rerank 提升率: rerank_score > original_score 的比例
    totalResults: number;    // 返回结果数
    requestedTopk: number;   // 请求的 topk
}

/**
 * 计算 RAG 检索统计指标
 */
function calculateRagStats(
    results: QdrantResult[], 
    topk: number, 
    scoreThreshold: number = 0.4
): RagStats {
    const totalResults = results.length;
    
    // 返回率
    const returnRate = topk > 0 ? totalResults / topk : 0;
    
    // 平均分数 (使用 rerank_score 如果有，否则使用 score)
    const scores = results.map(r => r.rerank_score ?? r.score);
    const avgScore = scores.length > 0 
        ? scores.reduce((sum, s) => sum + s, 0) / scores.length 
        : 0;
    
    // 高分命中率
    const highScoreCount = scores.filter(s => s >= scoreThreshold).length;
    const highScoreRate = totalResults > 0 ? highScoreCount / totalResults : 0;
    
    // Rerank 提升率 (只有启用 rerank 时才计算)
    // 计算因rerank而获得更靠前排序位次的文档数量
    const rerankResults = results.filter(r => 
        r.rerank_score !== undefined && r.original_score !== undefined
    );
    
    let boostedCount = 0;
    if (rerankResults.length > 0) {
        // 当前顺序就是按 rerank_score 排序后的顺序
        // 计算按 original_score 排序时每个文档的位置
        const originalOrder = [...rerankResults].sort((a, b) => 
            b.original_score! - a.original_score!
        );
        
        // 对比每个文档: 如果当前位置比按original_score排序时的位置更靠前，则计为提升
        for (let currentIdx = 0; currentIdx < rerankResults.length; currentIdx++) {
            const doc = rerankResults[currentIdx];
            const originalIdx = originalOrder.findIndex(d => d.id === doc.id);
            if (currentIdx < originalIdx) {
                // 当前位置更靠前，说明rerank提升了这个文档
                boostedCount++;
            }
        }
    }
    
    const rerankBoostRate = rerankResults.length > 0 
        ? boostedCount / rerankResults.length 
        : -1; // -1 表示未启用 rerank
    
    return {
        returnRate,
        highScoreRate,
        avgScore,
        rerankBoostRate,
        totalResults,
        requestedTopk: topk
    };
}

/**
 * 格式化知识库搜索结果为XML字符串
 */
function formatKnowledgeBaseResults(
    results: QdrantResult[], 
    query: string, 
    collectionName: string,
    stats: RagStats
): string {
    // 统计信息部分
    const statsXml = `<stats>
    <return_rate>${(stats.returnRate * 100).toFixed(1)}</return_rate>
    <high_score_rate>${(stats.highScoreRate * 100).toFixed(1)}</high_score_rate>
    <avg_score>${stats.avgScore.toFixed(4)}</avg_score>
    <rerank_boost_rate>${stats.rerankBoostRate >= 0 ? (stats.rerankBoostRate * 100).toFixed(1) : 'N/A'}</rerank_boost_rate>
    <total_results>${stats.totalResults}</total_results>
    <requested_topk>${stats.requestedTopk}</requested_topk>
  </stats>`;

    if (results.length === 0) {
        return `<knowledge_base_search_results>
<query>${escapeXml(query)}</query>
<collection>${escapeXml(collectionName)}</collection>
${statsXml}
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
${statsXml}
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
    // scoreThreshold 强制最低 0.6
    const scoreThreshold = params.score_threshold 
        ? Math.max(parseFloat(params.score_threshold), 0.4)
        : defaultParams.scoreThreshold || 0.4;
    const useRerank = params.use_rerank === 'true' || defaultParams.useRerank;
    const rerankTopN = params.rerank_top_n 
        ? parseInt(params.rerank_top_n, 10) 
        : defaultParams.rerankTopN;
    
    // 解析 filter 参数 (JSON 字符串)
    let filter: Record<string, any> | undefined;
    if (params.filter) {
        try {
            filter = JSON.parse(params.filter);
            console.log('[SearchKnowledgeBase] Parsed filter:', filter);
        } catch (e) {
            console.error('[SearchKnowledgeBase] Failed to parse filter:', e);
        }
    }

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
        useRerank,
        filter
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
        // 添加 filter 参数
        if (filter) {
            requestBody.filter = filter;
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

        // 计算统计指标
        const stats = calculateRagStats(results, topk, scoreThreshold || 0.6);
        console.log('[SearchKnowledgeBase] Stats:', stats);

        return {
            toolResult: formatKnowledgeBaseResults(results, query, collectionName, stats),
            extra: { ragStats: stats }
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
