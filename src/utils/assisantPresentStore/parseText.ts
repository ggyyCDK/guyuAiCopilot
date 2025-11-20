import { TextContent } from "@/type/tools/msgToolsParse";

/**
 * 清洗流式助手消息中的临时标签、未闭合标签以及残留的代码围栏标记。
 * 该函数在渲染前对文本做安全处理，防止中间态标记直接展示给用户。
 */
export const parseText = (block: TextContent): string => {
    // 复制原始内容，避免直接修改引用
    let content = block.content.text;
    if (content) {
        // 移除思考过程与函数调用相关的标签
        content = content.replace(/<thinking>\s?/g, "")
        content = content.replace(/\s?<\/thinking>/g, "")
        content = content.replace(/<think>\s?/g, "")
        content = content.replace(/\s?<\/think>/g, "")
        content = content.replace(/<function_calls>\s?/g, "")
        content = content.replace(/\s?<\/function_calls>/g, "")
        // 检测末尾是否存在未闭合的标签（常见于打字机流式输出中断）
        const lastOpenBracketIndex = content.lastIndexOf("<")
        if (lastOpenBracketIndex !== -1) {
            const possibleTag = content.slice(lastOpenBracketIndex)
            // Check if there's a '>' after the last '<' (i.e., if the tag is complete) (complete thinking and tool tags will have been removed by now)
            const hasCloseBracket = possibleTag.includes(">")
            if (!hasCloseBracket) {
                // 提取潜在的标签名称，区分开标签 / 闭标签
                let tagContent: string
                if (possibleTag.startsWith("</")) {
                    tagContent = possibleTag.slice(2).trim()
                } else {
                    tagContent = possibleTag.slice(1).trim()
                }
                // 仅在疑似合法标签名时才进行裁剪（字母和下划线）
                const isLikelyTagName = /^[a-zA-Z_]+$/.test(tagContent)
                // 若只是单独的 "<" 或 "</" 也直接清理，避免渲染异常字符
                const isOpeningOrClosing = possibleTag === "<" || possibleTag === "</"
                // 当检测到未完成标签时，截断到标签起始位置
                if (isOpeningOrClosing || isLikelyTagName) {
                    content = content.slice(0, lastOpenBracketIndex).trim()
                }
            }
        }
    }

    if (!block.partial) {
        // 非 partial 的块如果以 ```lang 结尾，可能是尚未闭合的代码块，移除避免展示残缺围栏
        const match = content?.trimEnd().match(/```[a-zA-Z0-9_-]+$/)
        if (match) {
            const matchLength = match[0].length
            content = content.trimEnd().slice(0, -matchLength)
        }
    }
    return content
}