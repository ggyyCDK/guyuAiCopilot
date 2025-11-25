# 扫描动画闪烁问题修复

## 🐛 问题描述

扫描动画一直卡在第一行闪烁，无法正常从上到下扫描。

## 🔍 问题原因

1. **重复触发**: `replace_in_file` 的 `partial` 状态会被多次触发（因为 AI 在流式发送参数）
2. **动画重启**: 每次 `partial` 触发时，代码都会创建新的 `ScanAnimationController` 并重新启动动画
3. **闪烁效果**: 动画不断从第 0 行重新开始，导致看起来像是卡在第一行闪烁

## ✅ 修复方案

### 1. 添加路径追踪变量

在 `toolExecutor.ts` 中添加 `lastScannedPath` 变量来追踪当前正在扫描的文件：

```typescript
// 全局变量存储扫描动画控制器实例
let scanAnimationController: ScanAnimationController | null = null;
// 记录当前正在扫描的文件路径，避免重复启动动画
let lastScannedPath: string | null = null;
```

### 2. 路径检查逻辑

只在文件路径改变或首次启动时才创建新的扫描动画：

```typescript
// 只在文件路径改变或首次启动时才创建新的扫描动画
if (resolvedPath !== lastScannedPath) {
    // 停止旧动画
    if (scanAnimationController) {
        scanAnimationController.stop();
        scanAnimationController = null;
    }
    
    // 打开文件并启动新动画
    // ...
    
    // 记录当前扫描的文件路径
    lastScannedPath = resolvedPath;
    
    console.log('Started scan animation for:', resolvedPath);
} else {
    console.log('Scan animation already running for:', resolvedPath);
}
```

### 3. 重置路径记录

在文件实际修改时（非 partial 状态），重置 `lastScannedPath`：

```typescript
// 停止扫描动画（如果正在运行）
if (scanAnimationController) {
    scanAnimationController.stop();
    scanAnimationController = null;
}
// 重置扫描路径记录
lastScannedPath = null;
```

### 4. 修复 Promise 处理

在 `ScanAnimationController.ts` 中修复 `start` 方法的 Promise 处理：

```typescript
start(speed: number = 50): Promise<void> {
    return new Promise((resolve) => {
        if (this.isRunning) {
            console.log('Scan animation is already running');
            resolve(); // 确保 Promise 能正确 resolve
            return;
        }
        // ...
    });
}
```

## 📊 修复效果

### 修复前
```
partial 触发 1 → 启动动画（第 0 行）
partial 触发 2 → 重启动画（第 0 行）← 闪烁
partial 触发 3 → 重启动画（第 0 行）← 闪烁
partial 触发 4 → 重启动画（第 0 行）← 闪烁
...
```

### 修复后
```
partial 触发 1 → 启动动画（第 0 行）
partial 触发 2 → 检测到相同路径，跳过（第 1 行）
partial 触发 3 → 检测到相同路径，跳过（第 2 行）
partial 触发 4 → 检测到相同路径，跳过（第 3 行）
...                 ↓ 动画持续进行
非 partial → 停止动画，执行替换
```

## 🎯 工作流程

```
1. AI 开始发送 replace_in_file (partial=true, 第1次)
   ↓
2. 检测到新路径 → 启动扫描动画
   ↓
3. AI 继续发送参数 (partial=true, 第2-N次)
   ↓
4. 检测到相同路径 → 跳过，动画继续运行
   ↓
5. AI 完成发送 (partial=false)
   ↓
6. 停止动画，重置路径记录
   ↓
7. 执行文件替换，显示 diff view
```

## 🔧 修改的文件

1. **`toolExecutor.ts`**
   - 添加 `lastScannedPath` 变量
   - 添加路径检查逻辑
   - 在停止动画时重置路径记录

2. **`ScanAnimationController.ts`**
   - 修复 `start` 方法的 Promise 处理

## ✨ 现在的行为

- ✅ 扫描动画只在第一次 partial 时启动
- ✅ 后续的 partial 触发不会重启动画
- ✅ 动画能够正常从上到下扫描
- ✅ 不同文件的扫描会正确切换
- ✅ 完成后正确清理和重置状态

## 🧪 测试建议

1. 测试单个文件的 replace_in_file 操作
2. 测试连续对不同文件的 replace_in_file 操作
3. 测试对同一文件的多次 replace_in_file 操作
4. 观察控制台日志确认路径检查逻辑正常工作
