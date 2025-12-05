import { ChatMessage, MessageType, MessageStatus } from '@/type/imType/im';
import React, { FC, useEffect, useState } from 'react';
import ContentContainer from '../ContentContainer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { TodoItem, TodoStatus, todoStatusSchema } from '@/type/tools/todo'
import styles from './index.module.scss';
const nextId = () => {
    return `${new Date().getTime()}`
}
function parseMarkdownChecklist(md: string): TodoItem[] {
    if (typeof md !== "string") return []
    const lines = md
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    const todos: TodoItem[] = []
    for (const line of lines) {
        // Support both "[ ] Task" and "- [ ] Task" formats
        const match = line.match(/^(?:-\s*)?\[\s*([ xX\-~])\s*\]\s+(.+)$/)
        if (!match) continue
        let status: TodoStatus = "pending"
        if (match[1] === "x" || match[1] === "X") status = "completed"
        else if (match[1] === "-" || match[1] === "~") status = "in_progress"
        const id = nextId()
        todos.push({
            id,
            content: match[2],
            status,
        })
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
    let normalizedTodos: TodoItem[] = todos.map((t) => ({
        id: t.id,
        content: t.content,
        status: normalizeStatus(t.status),
    }))
    console.log('render normalizedTodos is', normalizedTodos)
    return <ContentContainer title={'待办事项：'}>

        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath,]} rehypePlugins={[rehypeKatex as any]}>
            {content}
        </ReactMarkdown>

    </ContentContainer >
}

export default ToolUpdateTodoListContent

