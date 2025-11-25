/**
 * 文件说明：扫描动画控制器
 * 用于在 replace_in_file 操作时显示从上到下的扫描动画效果
 * 单次扫描模式，通过动态调整速度确保扫描在工具执行完成时正好结束
 */

import * as vscode from "vscode";

/**
 * 扫描线装饰类型
 * 使用浅绿色背景表示正在扫描的行
 */
const scanLineDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(144, 238, 144, 0.3)", // 浅绿色背景
    isWholeLine: true,
});

/**
 * 已扫描区域装饰类型
 * 使用更淡的绿色表示已经扫描过的区域
 */
const scannedAreaDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(144, 238, 144, 0.1)", // 更淡的绿色
    isWholeLine: true,
});

/**
 * 扫描动画控制器类
 * 单次扫描模式，动态调整速度以匹配工具执行时间
 */
export class ScanAnimationController {
    private editor: vscode.TextEditor;
    private currentLine: number = 0;
    private totalLines: number;
    private animationInterval: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private scanSpeed: number = 30; // 扫描速度（毫秒/行）
    private startTime: number = 0; // 扫描开始时间

    /**
     * 构造函数
     * @param editor VSCode 文本编辑器实例
     */
    constructor(editor: vscode.TextEditor) {
        this.editor = editor;
        this.totalLines = editor.document.lineCount;
    }

    /**
     * 开始扫描动画（单次扫描）
     * @param speed 可选的扫描速度（毫秒/行），默认为 30ms
     */
    start(speed: number = 30): void {
        if (this.isRunning) {
            console.log('Scan animation is already running');
            return;
        }

        this.isRunning = true;
        this.currentLine = 0;
        this.scanSpeed = speed;
        this.startTime = Date.now();

        this.animationInterval = setInterval(() => {
            // 更新扫描线
            this.updateScanLine();
            this.currentLine++;

            // 如果到达文件末尾，停止（单次扫描）
            if (this.currentLine >= this.totalLines) {
                console.log('Scan animation completed naturally');
                // 不清除装饰，保持最后的状态
                if (this.animationInterval) {
                    clearInterval(this.animationInterval);
                    this.animationInterval = null;
                }
                this.isRunning = false;
            }
        }, this.scanSpeed);

        console.log(`Scan animation started with speed ${speed}ms/line, total lines: ${this.totalLines}`);
    }

    /**
     * 停止扫描动画并清除装饰
     */
    stop(): void {
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
        this.isRunning = false;
        this.clear();
        console.log('Scan animation stopped');
    }

    /**
     * 完成扫描动画
     * 根据剩余行数和时间，调整速度使其正好在工具执行完成时结束
     */
    async finishScanning(): Promise<void> {
        if (!this.isRunning) {
            // 如果动画已经自然结束，直接清除装饰
            this.clear();
            return;
        }

        const remainingLines = this.totalLines - this.currentLine;

        if (remainingLines <= 0) {
            // 已经扫描完成，直接清除
            this.stop();
            return;
        }

        console.log(`Finishing scan animation, remaining lines: ${remainingLines}`);

        // 快速完成剩余的扫描
        const fastSpeed = Math.max(5, Math.min(20, remainingLines / 2)); // 5-20ms/行

        return new Promise((resolve) => {
            if (this.animationInterval) {
                clearInterval(this.animationInterval);
            }

            this.animationInterval = setInterval(() => {
                this.updateScanLine();
                this.currentLine++;

                if (this.currentLine >= this.totalLines) {
                    this.stop();
                    resolve();
                }
            }, fastSpeed);
        });
    }

    /**
     * 更新扫描线位置
     */
    private updateScanLine(): void {
        // 当前扫描线
        const scanLineRange = new vscode.Range(
            this.currentLine,
            0,
            this.currentLine,
            Number.MAX_SAFE_INTEGER
        );

        // 已扫描区域（从第0行到当前行的前一行）
        const scannedRanges: vscode.Range[] = [];
        if (this.currentLine > 0) {
            scannedRanges.push(
                new vscode.Range(
                    0,
                    0,
                    this.currentLine - 1,
                    Number.MAX_SAFE_INTEGER
                )
            );
        }

        // 应用装饰
        this.editor.setDecorations(scanLineDecorationType, [scanLineRange]);
        this.editor.setDecorations(scannedAreaDecorationType, scannedRanges);

        // 滚动到当前行，使其可见
        const range = new vscode.Range(this.currentLine, 0, this.currentLine, 0);
        this.editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }

    /**
     * 清除所有装饰
     */
    clear(): void {
        this.editor.setDecorations(scanLineDecorationType, []);
        this.editor.setDecorations(scannedAreaDecorationType, []);
    }

    /**
     * 获取当前是否正在运行
     */
    isAnimationRunning(): boolean {
        return this.isRunning;
    }

    /**
     * 动态调整扫描速度
     * 根据已用时间和剩余行数，计算新的速度以确保同步完成
     * @param estimatedRemainingTime 预估的剩余执行时间（毫秒）
     */
    adjustSpeedToMatch(estimatedRemainingTime: number): void {
        if (!this.isRunning) {
            return;
        }

        const remainingLines = this.totalLines - this.currentLine;

        if (remainingLines <= 0) {
            return;
        }

        // 计算新的速度：剩余时间 / 剩余行数
        const newSpeed = Math.max(10, Math.min(100, estimatedRemainingTime / remainingLines));

        if (Math.abs(newSpeed - this.scanSpeed) > 5) { // 只在速度变化明显时调整
            this.scanSpeed = newSpeed;

            // 重新启动定时器以应用新速度
            if (this.animationInterval) {
                clearInterval(this.animationInterval);

                this.animationInterval = setInterval(() => {
                    this.updateScanLine();
                    this.currentLine++;

                    if (this.currentLine >= this.totalLines) {
                        if (this.animationInterval) {
                            clearInterval(this.animationInterval);
                            this.animationInterval = null;
                        }
                        this.isRunning = false;
                    }
                }, this.scanSpeed);
            }

            console.log(`Scan speed adjusted to ${newSpeed.toFixed(1)}ms/line, remaining lines: ${remainingLines}`);
        }
    }

    /**
     * 获取扫描进度（0-1）
     */
    getProgress(): number {
        return this.totalLines > 0 ? this.currentLine / this.totalLines : 0;
    }
}
