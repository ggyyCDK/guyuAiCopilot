/**
 * MultiSearchReplaceDiff Strategy
 * 
 * 实现 Roo Code 风格的 apply_diff 工具，支持带行号的 SEARCH/REPLACE 块格式：
 * 
 * <<<<<<< SEARCH
 * :start_line:1
 * -------
 * [要查找的精确内容]
 * =======
 * [替换后的新内容]
 * >>>>>>> REPLACE
 */

import { distance } from 'fastest-levenshtein'

const BUFFER_LINES = 40 // 搜索缓冲区行数

/**
 * 计算两个字符串的相似度 (0-1)
 */
function getSimilarity(original: string, search: string): number {
    if (search === '') {
        return 0
    }

    // 标准化字符串：处理智能引号和其他特殊字符
    const normalizedOriginal = normalizeString(original)
    const normalizedSearch = normalizeString(search)

    if (normalizedOriginal === normalizedSearch) {
        return 1
    }

    // 使用 Levenshtein 距离计算相似度
    const dist = distance(normalizedOriginal, normalizedSearch)
    const maxLength = Math.max(normalizedOriginal.length, normalizedSearch.length)
    return 1 - dist / maxLength
}

/**
 * 标准化字符串，处理智能引号等特殊字符
 */
function normalizeString(str: string): string {
    return str
        .replace(/[\u2018\u2019]/g, "'")  // 智能单引号
        .replace(/[\u201C\u201D]/g, '"')  // 智能双引号
        .replace(/\u2014/g, '--')         // 长破折号
        .replace(/\u2013/g, '-')          // 短破折号
        .replace(/\u2026/g, '...')        // 省略号
        .replace(/\r\n/g, '\n')           // 标准化换行符
}

/**
 * 从中间向两端进行模糊搜索
 */
function fuzzySearch(
    lines: string[],
    searchChunk: string,
    startIndex: number,
    endIndex: number
): { bestScore: number; bestMatchIndex: number; bestMatchContent: string } {
    let bestScore = 0
    let bestMatchIndex = -1
    let bestMatchContent = ''
    const searchLen = searchChunk.split(/\r?\n/).length

    // 从中间点开始向两端搜索
    const midPoint = Math.floor((startIndex + endIndex) / 2)
    let leftIndex = midPoint
    let rightIndex = midPoint + 1

    while (leftIndex >= startIndex || rightIndex <= endIndex - searchLen) {
        if (leftIndex >= startIndex) {
            const originalChunk = lines.slice(leftIndex, leftIndex + searchLen).join('\n')
            const similarity = getSimilarity(originalChunk, searchChunk)
            if (similarity > bestScore) {
                bestScore = similarity
                bestMatchIndex = leftIndex
                bestMatchContent = originalChunk
            }
            leftIndex--
        }

        if (rightIndex <= endIndex - searchLen) {
            const originalChunk = lines.slice(rightIndex, rightIndex + searchLen).join('\n')
            const similarity = getSimilarity(originalChunk, searchChunk)
            if (similarity > bestScore) {
                bestScore = similarity
                bestMatchIndex = rightIndex
                bestMatchContent = originalChunk
            }
            rightIndex++
        }
    }

    return { bestScore, bestMatchIndex, bestMatchContent }
}

/**
 * 添加行号到内容
 */
function addLineNumbers(content: string, startLine: number = 1): string {
    const lines = content.split('\n')
    return lines.map((line, index) => `${startLine + index} | ${line}`).join('\n')
}

/**
 * 检查每行是否都有行号前缀
 */
function everyLineHasLineNumbers(content: string): boolean {
    const lines = content.split('\n')
    return lines.every(line => /^\s*\d+\s*\|/.test(line))
}

/**
 * 移除行号前缀
 */
function stripLineNumbers(content: string, aggressive: boolean = false): string {
    const lines = content.split('\n')
    return lines.map(line => {
        if (aggressive) {
            // 激进模式：移除所有看起来像行号的前缀
            return line.replace(/^\s*\d+\s*[\|:]\s?/, '')
        }
        // 标准模式：只移除标准格式的行号
        return line.replace(/^\s*\d+\s*\|\s?/, '')
    }).join('\n')
}

/**
 * 反转义 diff 标记
 */
function unescapeMarkers(content: string): string {
    return content
        .replace(/^\\<<<<<<</gm, '<<<<<<<')
        .replace(/^\\=======/gm, '=======')
        .replace(/^\\>>>>>>>/gm, '>>>>>>>')
        .replace(/^\\-------/gm, '-------')
        .replace(/^\\:end_line:/gm, ':end_line:')
        .replace(/^\\:start_line:/gm, ':start_line:')
}

export interface DiffResult {
    success: boolean
    content?: string
    error?: string
    details?: {
        similarity?: number
        threshold?: number
        matchedRange?: { start: number; end: number }
        searchContent?: string
        bestMatch?: string
    }
    failParts?: DiffResult[]
}

export interface MultiSearchReplaceDiffOptions {
    fuzzyThreshold?: number
    bufferLines?: number
}

/**
 * MultiSearchReplaceDiff 策略实现
 * 
 * 支持 Roo Code 风格的 SEARCH/REPLACE 块格式
 */
export class MultiSearchReplaceDiffStrategy {
    private fuzzyThreshold: number
    private bufferLines: number

    constructor(options: MultiSearchReplaceDiffOptions = {}) {
        this.fuzzyThreshold = options.fuzzyThreshold ?? 1.0
        this.bufferLines = options.bufferLines ?? BUFFER_LINES
    }

    /**
     * 验证 diff 标记的顺序是否正确
     */
    private validateMarkerSequencing(diffContent: string): { success: boolean; error?: string } {
        enum State {
            START,
            AFTER_SEARCH,
            AFTER_SEPARATOR,
        }

        const state = { current: State.START, line: 0 }
        const SEARCH_PATTERN = /^<<<<<<< SEARCH>?$/
        const SEP = '======='
        const REPLACE = '>>>>>>> REPLACE'
        const SEARCH_PREFIX = '<<<<<<<'
        const REPLACE_PREFIX = '>>>>>>>'

        const reportError = (found: string, expected: string) => ({
            success: false,
            error: `错误：在第 ${state.line} 行发现标记 '${found}'，期望: ${expected}\n\n` +
                '正确格式:\n\n' +
                '<<<<<<< SEARCH\n' +
                ':start_line: (必需) 原始内容起始行号\n' +
                '-------\n' +
                '[要查找的精确内容]\n' +
                '=======\n' +
                '[替换后的新内容]\n' +
                '>>>>>>> REPLACE\n',
        })

        for (const line of diffContent.split('\n')) {
            state.line++
            const marker = line.trim()

            switch (state.current) {
                case State.START:
                    if (marker === SEP) return reportError(SEP, '<<<<<<< SEARCH')
                    if (marker === REPLACE) return reportError(REPLACE, '<<<<<<< SEARCH')
                    if (marker.startsWith(REPLACE_PREFIX)) return reportError(marker, '<<<<<<< SEARCH')
                    if (SEARCH_PATTERN.test(marker)) state.current = State.AFTER_SEARCH
                    else if (marker.startsWith(SEARCH_PREFIX)) return reportError(marker, '<<<<<<< SEARCH')
                    break

                case State.AFTER_SEARCH:
                    if (SEARCH_PATTERN.test(marker)) return reportError('<<<<<<< SEARCH', SEP)
                    if (marker.startsWith(SEARCH_PREFIX)) return reportError(marker, SEP)
                    if (marker === REPLACE) return reportError(REPLACE, SEP)
                    if (marker.startsWith(REPLACE_PREFIX)) return reportError(marker, SEP)
                    if (marker === SEP) state.current = State.AFTER_SEPARATOR
                    break

                case State.AFTER_SEPARATOR:
                    if (SEARCH_PATTERN.test(marker)) return reportError('<<<<<<< SEARCH', REPLACE)
                    if (marker.startsWith(SEARCH_PREFIX)) return reportError(marker, REPLACE)
                    if (marker === SEP) return reportError(SEP, REPLACE)
                    if (marker === REPLACE) state.current = State.START
                    else if (marker.startsWith(REPLACE_PREFIX)) return reportError(marker, REPLACE)
                    break
            }
        }

        return state.current === State.START
            ? { success: true }
            : {
                success: false,
                error: `错误：未找到预期的 '${state.current === State.AFTER_SEARCH ? '=======' : '>>>>>>> REPLACE'}'`,
            }
    }

    /**
     * 应用 diff 到原始内容
     */
    async applyDiff(
        originalContent: string,
        diffContent: string,
        _paramStartLine?: number,
        _paramEndLine?: number
    ): Promise<DiffResult> {
        // 验证标记顺序
        const validSeq = this.validateMarkerSequencing(diffContent)
        if (!validSeq.success) {
            return {
                success: false,
                error: validSeq.error!,
            }
        }

        // 正则匹配所有 SEARCH/REPLACE 块
        const matches = [
            ...diffContent.matchAll(
                /(?:^|\n)(?<!\\)<<<<<<< SEARCH>?\s*\n((?:\:start_line:\s*(\d+)\s*\n))?((?:\:end_line:\s*(\d+)\s*\n))?((?<!\\)-------\s*\n)?([\s\S]*?)(?:\n)?(?:(?<=\n)(?<!\\)=======\s*\n)([\s\S]*?)(?:\n)?(?:(?<=\n)(?<!\\)>>>>>>> REPLACE)(?=\n|$)/g
            ),
        ]

        if (matches.length === 0) {
            return {
                success: false,
                error: `无效的 diff 格式 - 缺少必需的部分\n\n` +
                    `调试信息:\n` +
                    `- 期望格式: <<<<<<< SEARCH\\n:start_line: 起始行\\n-------\\n[搜索内容]\\n=======\\n[替换内容]\\n>>>>>>> REPLACE\n` +
                    `- 提示: 确保包含 start_line/SEARCH/=======/REPLACE 部分，且标记在新行上`,
            }
        }

        // 检测原始内容的换行符类型
        const lineEnding = originalContent.includes('\r\n') ? '\r\n' : '\n'
        let resultLines = originalContent.split(/\r?\n/)
        let delta = 0
        const diffResults: DiffResult[] = []
        let appliedCount = 0

        // 解析并排序所有替换操作
        const replacements = matches
            .map((match) => ({
                startLine: Number(match[2] ?? 0),
                searchContent: match[6],
                replaceContent: match[7],
            }))
            .sort((a, b) => a.startLine - b.startLine)

        for (const replacement of replacements) {
            let { searchContent, replaceContent } = replacement
            let startLine = replacement.startLine + (replacement.startLine === 0 ? 0 : delta)

            // 反转义标记
            searchContent = unescapeMarkers(searchContent)
            replaceContent = unescapeMarkers(replaceContent)

            // 检查并处理行号
            const hasAllLineNumbers =
                (everyLineHasLineNumbers(searchContent) && everyLineHasLineNumbers(replaceContent)) ||
                (everyLineHasLineNumbers(searchContent) && replaceContent.trim() === '')

            if (hasAllLineNumbers && startLine === 0) {
                startLine = parseInt(searchContent.split('\n')[0].split('|')[0])
            }

            if (hasAllLineNumbers) {
                searchContent = stripLineNumbers(searchContent)
                replaceContent = stripLineNumbers(replaceContent)
            }

            // 验证搜索和替换内容不相同
            if (searchContent === replaceContent) {
                diffResults.push({
                    success: false,
                    error: `搜索和替换内容相同 - 不会进行任何更改\n\n` +
                        `调试信息:\n` +
                        `- 搜索和替换内容必须不同才能进行更改\n` +
                        `- 使用 read_file 验证要更改的内容`,
                })
                continue
            }

            // 分割内容为行
            const searchLines = searchContent === '' ? [] : searchContent.split(/\r?\n/)
            const replaceLines = replaceContent === '' ? [] : replaceContent.split(/\r?\n/)

            // 验证搜索内容不为空
            if (searchLines.length === 0) {
                diffResults.push({
                    success: false,
                    error: `空的搜索内容不允许\n\n调试信息:\n- 搜索内容不能为空\n- 对于插入操作，请使用 :start_line: 指定位置并提供要搜索的内容`,
                })
                continue
            }

            // 初始化搜索变量
            let matchIndex = -1
            let bestMatchScore = 0
            let bestMatchContent = ''
            const searchChunk = searchLines.join('\n')

            // 确定搜索范围
            let searchStartIndex = 0
            let searchEndIndex = resultLines.length

            // 如果提供了行号，先尝试精确匹配
            if (startLine) {
                const exactStartIndex = startLine - 1
                const searchLen = searchLines.length
                const exactEndIndex = exactStartIndex + searchLen - 1

                // 尝试精确匹配
                const originalChunk = resultLines.slice(exactStartIndex, exactEndIndex + 1).join('\n')
                const similarity = getSimilarity(originalChunk, searchChunk)
                if (similarity >= this.fuzzyThreshold) {
                    matchIndex = exactStartIndex
                    bestMatchScore = similarity
                    bestMatchContent = originalChunk
                } else {
                    // 设置缓冲区搜索范围
                    searchStartIndex = Math.max(0, startLine - (this.bufferLines + 1))
                    searchEndIndex = Math.min(resultLines.length, startLine + searchLines.length + this.bufferLines)
                }
            }

            // 如果还没找到匹配，尝试 middle-out 搜索
            if (matchIndex === -1) {
                const {
                    bestScore,
                    bestMatchIndex,
                    bestMatchContent: midContent,
                } = fuzzySearch(resultLines, searchChunk, searchStartIndex, searchEndIndex)
                matchIndex = bestMatchIndex
                bestMatchScore = bestScore
                bestMatchContent = midContent
            }

            // 如果仍然没有找到足够相似的匹配，尝试激进的行号剥离
            if (matchIndex === -1 || bestMatchScore < this.fuzzyThreshold) {
                const aggressiveSearchContent = stripLineNumbers(searchContent, true)
                const aggressiveReplaceContent = stripLineNumbers(replaceContent, true)

                const aggressiveSearchLines = aggressiveSearchContent ? aggressiveSearchContent.split(/\r?\n/) : []
                const aggressiveSearchChunk = aggressiveSearchLines.join('\n')

                const {
                    bestScore,
                    bestMatchIndex,
                    bestMatchContent: aggContent,
                } = fuzzySearch(resultLines, aggressiveSearchChunk, searchStartIndex, searchEndIndex)

                if (bestMatchIndex !== -1 && bestScore >= this.fuzzyThreshold) {
                    matchIndex = bestMatchIndex
                    bestMatchScore = bestScore
                    bestMatchContent = aggContent
                    searchContent = aggressiveSearchContent
                    replaceContent = aggressiveReplaceContent
                    searchLines.length = 0
                    searchLines.push(...(aggressiveSearchContent ? aggressiveSearchContent.split(/\r?\n/) : []))
                    replaceLines.length = 0
                    replaceLines.push(...(aggressiveReplaceContent ? aggressiveReplaceContent.split(/\r?\n/) : []))
                } else {
                    // 没有找到匹配
                    const originalContentSection =
                        startLine !== undefined
                            ? `\n\n原始内容:\n${addLineNumbers(
                                resultLines
                                    .slice(
                                        Math.max(0, startLine - 1 - this.bufferLines),
                                        Math.min(resultLines.length, startLine + searchLines.length + this.bufferLines)
                                    )
                                    .join('\n'),
                                Math.max(1, startLine - this.bufferLines)
                            )}`
                            : `\n\n原始内容:\n${addLineNumbers(resultLines.join('\n'))}`

                    const bestMatchSection = bestMatchContent
                        ? `\n\n最佳匹配:\n${addLineNumbers(bestMatchContent, matchIndex + 1)}`
                        : `\n\n最佳匹配:\n(无匹配)`

                    const lineRange = startLine ? ` 在行: ${startLine}` : ''

                    diffResults.push({
                        success: false,
                        error: `未找到足够相似的匹配${lineRange} (${Math.floor(bestMatchScore * 100)}% 相似度, 需要 ${Math.floor(this.fuzzyThreshold * 100)}%)\n\n` +
                            `调试信息:\n` +
                            `- 相似度: ${Math.floor(bestMatchScore * 100)}%\n` +
                            `- 阈值: ${Math.floor(this.fuzzyThreshold * 100)}%\n` +
                            `- 搜索范围: ${startLine ? `从行 ${startLine} 开始` : '从头到尾'}\n` +
                            `- 提示: 使用 read_file 工具获取文件最新内容后再尝试 apply_diff\n\n` +
                            `搜索内容:\n${searchChunk}${bestMatchSection}${originalContentSection}`,
                        details: {
                            similarity: bestMatchScore,
                            threshold: this.fuzzyThreshold,
                            searchContent: searchChunk,
                            bestMatch: bestMatchContent,
                        },
                    })
                    continue
                }
            }

            // 获取匹配的行
            const matchedLines = resultLines.slice(matchIndex, matchIndex + searchLines.length)

            // 获取原始缩进
            const originalIndents = matchedLines.map((line) => {
                const match = line.match(/^[\t ]*/)
                return match ? match[0] : ''
            })

            // 获取搜索块中每行的缩进
            const searchIndents = searchLines.map((line) => {
                const match = line.match(/^[\t ]*/)
                return match ? match[0] : ''
            })

            // 应用替换并保留缩进
            const indentedReplaceLines = replaceLines.map((line) => {
                const matchedIndent = originalIndents[0] || ''
                const currentIndentMatch = line.match(/^[\t ]*/)
                const currentIndent = currentIndentMatch ? currentIndentMatch[0] : ''
                const searchBaseIndent = searchIndents[0] || ''

                const searchBaseLevel = searchBaseIndent.length
                const currentLevel = currentIndent.length
                const relativeLevel = currentLevel - searchBaseLevel

                const finalIndent =
                    relativeLevel < 0
                        ? matchedIndent.slice(0, Math.max(0, matchedIndent.length + relativeLevel))
                        : matchedIndent + currentIndent.slice(searchBaseLevel)

                return finalIndent + line.trim()
            })

            // 构建最终内容
            const beforeMatch = resultLines.slice(0, matchIndex)
            const afterMatch = resultLines.slice(matchIndex + searchLines.length)
            resultLines = [...beforeMatch, ...indentedReplaceLines, ...afterMatch]
            delta = delta - matchedLines.length + replaceLines.length
            appliedCount++
        }

        const finalContent = resultLines.join(lineEnding)

        if (appliedCount === 0) {
            return {
                success: false,
                failParts: diffResults,
                error: diffResults.length > 0 ? diffResults[0].error : '没有应用任何更改',
            }
        }

        return {
            success: true,
            content: finalContent,
            failParts: diffResults.length > 0 ? diffResults : undefined,
        }
    }
}

/**
 * 默认实例
 */
export const multiSearchReplaceDiff = new MultiSearchReplaceDiffStrategy()
