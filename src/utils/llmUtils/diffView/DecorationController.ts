/**
 * 文件说明：装饰控制器
 * 用于管理 VSCode 编辑器中的文本装饰效果，支持淡化覆盖层和活动行高亮两种装饰类型
 */

import * as vscode from "vscode"

/**
 * 淡化覆盖层装饰类型
 * 用于显示半透明的黄色背景，通常用于标记待处理或次要的代码行
 */
const fadedOverlayDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(255, 255, 0, 0.1)", // 浅黄色背景
    opacity: "0.4", // 40% 不透明度
    isWholeLine: true, // 应用于整行
})

/**
 * 活动行装饰类型
 * 用于高亮显示当前活动的代码行，具有更明显的视觉效果
 */
const activeLineDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(255, 255, 0, 0.3)", // 较深的黄色背景
    opacity: "1", // 完全不透明
    isWholeLine: true, // 应用于整行
    border: "1px solid rgba(255, 255, 0, 0.5)", // 黄色边框
})

/**
 * 装饰类型枚举
 * - fadedOverlay: 淡化覆盖层
 * - activeLine: 活动行高亮
 */
type DecorationType = "fadedOverlay" | "activeLine"

/**
 * 装饰控制器类
 * 负责管理编辑器中的文本装饰效果，包括添加、清除和更新装饰范围
 */
export class DecorationController {
    /** 装饰类型 */
    private decorationType: DecorationType
    /** 目标编辑器实例 */
    private editor: vscode.TextEditor
    /** 装饰应用的行范围数组 */
    private ranges: vscode.Range[] = []

    /**
     * 构造函数
     * @param decorationType 装饰类型（淡化覆盖层或活动行）
     * @param editor VSCode 文本编辑器实例
     */
    constructor(decorationType: DecorationType, editor: vscode.TextEditor) {
        this.decorationType = decorationType
        this.editor = editor
    }

    /**
     * 获取当前装饰类型对应的装饰对象
     * @returns VSCode 文本编辑器装饰类型对象
     */
    getDecoration() {
        switch (this.decorationType) {
            case "fadedOverlay":
                return fadedOverlayDecorationType
            case "activeLine":
                return activeLineDecorationType
        }
    }

    /**
     * 添加装饰行
     * 从指定的起始行开始，为连续的多行添加装饰效果
     * 如果新添加的行与最后一个范围相邻，则会合并范围以提高效率
     *
     * @param startIndex 起始行索引（从 0 开始）
     * @param numLines 要添加装饰的行数
     */
    addLines(startIndex: number, numLines: number) {
        // 防止无效输入
        if (startIndex < 0 || numLines <= 0) {
            return
        }

        // 获取最后一个装饰范围
        const lastRange = this.ranges[this.ranges.length - 1]
        // 如果新范围与最后一个范围相邻，则扩展最后一个范围
        if (lastRange && lastRange.end.line === startIndex - 1) {
            this.ranges[this.ranges.length - 1] = lastRange.with(undefined, lastRange.end.translate(numLines))
        } else {
            // 否则创建新的装饰范围
            const endLine = startIndex + numLines - 1
            this.ranges.push(new vscode.Range(startIndex, 0, endLine, Number.MAX_SAFE_INTEGER))
        }

        // 应用装饰到编辑器
        this.editor.setDecorations(this.getDecoration(), this.ranges)
    }

    /**
     * 清除所有装饰
     * 移除编辑器中所有由此控制器管理的装饰效果
     */
    clear() {
        this.ranges = []
        this.editor.setDecorations(this.getDecoration(), this.ranges)
    }

    /**
     * 更新指定行之后的覆盖层装饰
     * 移除当前行及之后的所有装饰，然后为当前行之后的所有行添加新的装饰
     * 通常用于在逐行处理文件时，标记尚未处理的行
     *
     * @param line 当前处理的行号
     * @param totalLines 文件总行数
     */
    updateOverlayAfterLine(line: number, totalLines: number) {
        // 移除所有在当前行或之后开始的现有范围
        this.ranges = this.ranges.filter((range) => range.end.line < line)

        // 为当前行之后的所有行添加新的装饰范围
        if (line < totalLines - 1) {
            this.ranges.push(
                new vscode.Range(new vscode.Position(line + 1, 0), new vscode.Position(totalLines - 1, Number.MAX_SAFE_INTEGER)),
            )
        }

        // 应用更新后的装饰
        this.editor.setDecorations(this.getDecoration(), this.ranges)
    }

    /**
     * 设置活动行
     * 清除所有现有装饰，并仅高亮显示指定的单行
     * 通常用于标记当前正在编辑或处理的行
     *
     * @param line 要设置为活动行的行号
     */
    setActiveLine(line: number) {
        this.ranges = [new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER)]
        this.editor.setDecorations(this.getDecoration(), this.ranges)
    }
}
