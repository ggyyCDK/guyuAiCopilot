# 扫描动画时间同步机制

## 🎯 设计目标

确保扫描动画的持续时间与工具执行时间同步，避免以下问题：
- ❌ 扫描完成但工具还在执行（用户等待时没有视觉反馈）
- ❌ 工具执行完成但扫描还在进行（不真实的延迟感）

## 🔄 新的工作机制

### 1. 循环扫描模式

扫描动画现在会**循环扫描**，直到工具执行完成：

```typescript
// 扫描到文件末尾后，自动循环回到开头
if (this.currentLine >= this.totalLines) {
    this.currentLine = 0;
    console.log('Scan animation looping back to start');
}
```

### 2. 快速完成机制

当工具执行完成时，调用 `finishScanning()` 快速完成当前扫描：

```typescript
// 在 toolExecutor.ts 中
if (scanAnimationController) {
    await scanAnimationController.finishScanning(); // 快速完成扫描
    scanAnimationController = null;
}
```

### 3. 工作流程

```
1. AI 开始发送 replace_in_file (partial=true)
   ↓
2. 启动循环扫描动画 (30ms/行)
   ↓
3. 扫描到文件末尾 → 循环回到开头
   ↓ (持续循环，直到工具执行完成)
4. AI 完成发送 (partial=false)
   ↓
5. 调用 finishScanning() - 快速扫描到末尾 (10ms/行)
   ↓
6. 执行文件替换
   ↓
7. 显示 diff view
```

## 📊 时间对比

### 场景 1: 小文件 (100 行)

**旧方案** (固定速度，不循环):
```
扫描时间: 100 行 × 30ms = 3 秒
工具执行: 5 秒
结果: 扫描完成后等待 2 秒 ❌
```

**新方案** (循环扫描):
```
第一轮扫描: 100 行 × 30ms = 3 秒
循环回到开头，继续扫描...
工具执行完成 (5 秒) → 快速完成扫描
结果: 始终有视觉反馈 ✅
```

### 场景 2: 大文件 (1000 行)

**旧方案** (固定速度，不循环):
```
扫描时间: 1000 行 × 30ms = 30 秒
工具执行: 5 秒
结果: 工具执行完成后扫描还在进行 ❌
```

**新方案** (循环扫描):
```
第一轮扫描: 1000 行 × 30ms = 30 秒
但工具在 5 秒时完成 → 快速完成当前扫描
结果: 及时响应工具完成 ✅
```

## 🎨 视觉效果

### 循环扫描阶段
```
行 0   🟢 ← 扫描线
行 1   
行 2   
...
行 99  
       ↓ 到达末尾
行 0   🟢 ← 循环回到开头
行 1   
行 2   
...
```

### 快速完成阶段
```
行 50  🟢 ← 当前位置
       ↓ 工具执行完成
行 51  🟢 ← 快速扫描 (10ms/行)
行 52  🟢
...
行 99  🟢 ← 完成
       ↓ 停止动画
显示 diff view
```

## 🔧 核心 API

### ScanAnimationController

#### `start(speed?: number): void`
启动循环扫描动画
- **参数**: `speed` - 扫描速度（毫秒/行），默认 30ms
- **行为**: 循环扫描，直到调用 `stop()` 或 `finishScanning()`

#### `finishScanning(): Promise<void>`
快速完成当前扫描
- **行为**: 以 10ms/行的速度快速扫描到文件末尾，然后停止
- **返回**: Promise，在扫描完成时 resolve

#### `stop(): void`
立即停止扫描动画
- **行为**: 清除所有装饰，停止定时器

#### `adjustSpeed(speed: number): void`
动态调整扫描速度
- **参数**: `speed` - 新的扫描速度（毫秒/行）
- **用途**: 可以根据文件大小或执行时间动态调整

## 💡 未来优化方向

### 1. 智能速度调整
根据文件大小自动调整扫描速度：
```typescript
const speed = Math.max(10, Math.min(50, totalLines / 10));
scanAnimationController.start(speed);
```

### 2. 预估执行时间
根据历史数据预估工具执行时间，调整扫描速度使其同步：
```typescript
const estimatedTime = estimateExecutionTime(fileSize, diffSize);
const speed = estimatedTime / totalLines;
scanAnimationController.start(speed);
```

### 3. 进度指示
在扫描过程中显示循环次数或进度百分比：
```
扫描中... (第 2 轮)
```

## ✅ 优势总结

1. **持续反馈**: 无论工具执行多久，始终有视觉反馈
2. **及时响应**: 工具完成时快速结束动画
3. **灵活适应**: 适用于各种文件大小和执行时间
4. **用户体验**: 避免等待时的空白期和不必要的延迟

## 🧪 测试场景

1. **快速执行** (< 3 秒): 扫描一轮未完成时工具就完成
2. **正常执行** (3-10 秒): 扫描循环 1-2 轮
3. **慢速执行** (> 10 秒): 扫描循环多轮
4. **小文件** (< 100 行): 快速循环
5. **大文件** (> 1000 行): 慢速循环

所有场景都应该有流畅的视觉反馈，没有明显的等待或延迟感。
