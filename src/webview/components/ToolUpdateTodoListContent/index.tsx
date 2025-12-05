import { ChatMessage } from '@/type/imType/im';
import React, { FC } from 'react';
import ContentContainer from '../ContentContainer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { TodoItem, TodoStatus } from '@/type/tools/todo'
import styles from './index.module.scss';

// 生成基于内容的稳定 ID（简单哈希）
const generateStableId = (content: string, index: number): string => {
    // 使用内容和索引生成稳定的 ID
    let hash = 0;
    const str = `${content}-${index}`;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return `todo-${Math.abs(hash)}`;
}

function parseMarkdownChecklist(md: string): TodoItem[] {
    if (typeof md !== "string") return []
    const lines = md
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    const todos: TodoItem[] = []
    let todoIndex = 0; // 用于生成稳定的索引
    for (const line of lines) {
        // Support both "[ ] Task" and "- [ ] Task" formats
        const match = line.match(/^(?:-\s*)?\[\s*([ xX\-~])\s*]\s+(.+)$/)
        if (!match) continue
        let status: TodoStatus = "pending"
        if (match[1] === "x" || match[1] === "X") status = "completed"
        else if (match[1] === "-" || match[1] === "~") status = "in_progress"
        const content = match[2];
        const id = generateStableId(content, todoIndex);
        todos.push({
            id,
            content,
            status,
        })
        todoIndex++;
    }
    return todos
}

function normalizeStatus(status: string | undefined): TodoStatus {
    if (status === "completed") return "completed"
    if (status === "in_progress") return "in_progress"
    return "pending"
}

interface MessageContentProps {
    message: ChatMessage
}

const ToolUpdateTodoListContent: FC<MessageContentProps> = ({ message }) => {
    const content = message?.content?.params?.todos ?? '';
    const todos = parseMarkdownChecklist(content || '')
    const normalizedTodos: TodoItem[] = todos.map((t) => ({
        id: t.id,
        content: t.content,
        status: normalizeStatus(t.status),
    }))

    return (
        <ContentContainer title={'待办事项：'}>
            <div className={styles.todoContainer}>
                {Array.isArray(normalizedTodos) && normalizedTodos.length > 0 ? (
                    <ul className={styles.todoList}>
                        {normalizedTodos.map((todo, idx) => {
                            let statusClass = styles.statusPending;
                            if (todo.status === "completed") {
                                statusClass = styles.statusCompleted;
                            } else if (todo.status === "in_progress") {
                                statusClass = styles.statusInProgress;
                            }

                            return (
                                <li key={todo.id || idx} className={styles.todoItem}>
                                    <span className={`${styles.statusIcon} ${statusClass}`} />
                                    <span className={`${styles.todoContent} ${statusClass}`}>
                                        {todo.content}
                                    </span>
                                </li>
                            )
                        })}
                    </ul>
                ) : (
                    <div className={styles.markdownFallback}>
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex as any]}
                        >
                            {content}
                        </ReactMarkdown>
                    </div>
                )}
            </div>
        </ContentContainer>
    )
}

export default ToolUpdateTodoListContent

