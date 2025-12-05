import { IToolExecutor } from '@/type/tools/msgToolsParse'
import { TodoItem, TodoStatus, todoStatusSchema } from '@/type/tools/todo'
import { formatResponse } from '@/helper/responsePrompt/responseFormatter'
import { multiRoundSharedState } from '@/utils/assisantPresentStore/multiRoundSharedState';

import crypto from "crypto"
import cloneDeep from "clone-deep"

export function parseMarkdownChecklist(md: string): TodoItem[] {
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
        const id = crypto
            .createHash("md5")
            .update(match[2] + status)
            .digest("hex")
        todos.push({
            id,
            content: match[2],
            status,
        })
    }
    return todos
}

function validateTodos(todos: any[]): { valid: boolean; error?: string } {
    if (!Array.isArray(todos)) return { valid: false, error: "todos must be an array" }
    for (const [i, t] of todos.entries()) {
        if (!t || typeof t !== "object") return { valid: false, error: `Item ${i + 1} is not an object` }
        if (!t.id || typeof t.id !== "string") return { valid: false, error: `Item ${i + 1} is missing id` }
        if (!t.content || typeof t.content !== "string")
            return { valid: false, error: `Item ${i + 1} is missing content` }
        if (t.status && !todoStatusSchema.options.includes(t.status as TodoStatus))
            return { valid: false, error: `Item ${i + 1} has invalid status` }
    }
    return { valid: true }
}

export function normalizeStatus(status: string | undefined): TodoStatus {
    if (status === "completed") return "completed"
    if (status === "in_progress") return "in_progress"
    return "pending"
}

function todoListToMarkdown(todos: TodoItem[]): string {
    return todos
        .map((t) => {
            let box = "[ ]"
            if (t.status === "completed") box = "[x]"
            else if (t.status === "in_progress") box = "[-]"
            return `${box} ${t.content}`
        })
        .join("\n")
}

export async function setTodoListForTask(todos?: TodoItem[]) {
    const todoList = Array.isArray(todos) ? todos : []
    // 通过 webview postMessage 发送 todoList 更新消息到前端

    console.log('我来更新啦', multiRoundSharedState.webviewView)
    if (multiRoundSharedState.webviewView) {
        multiRoundSharedState.webviewView.webview.postMessage({
            type: 'update-todo-list',
            payload: {
                todoList: todoList
            }
        });
    } else {
        console.warn('webviewView is not available, cannot update todo list');
    }
}

let approvedTodoList: TodoItem[] | undefined = undefined

export const updateTodoList: IToolExecutor = async (command) => {
    const { toolUseCommand } = command;
    try {
        const todosRaw = toolUseCommand.params.todos
        let todos: TodoItem[]
        try {
            todos = parseMarkdownChecklist(todosRaw || "")
        } catch (error) {
            return {
                toolResult: formatResponse.toolError("The todos parameter is not valid markdown checklist or JSON")
            }
        }

        const { valid, error } = validateTodos(todos)
        if (!valid && !toolUseCommand.partial) {
            return {
                toolResult: formatResponse.toolError(error || "todos parameter validation failed")
            }
        }

        let normalizedTodos: TodoItem[] = todos.map((t) => ({
            id: t.id,
            content: t.content,
            status: normalizeStatus(t.status),
        }))

        approvedTodoList = cloneDeep(normalizedTodos)
        const isTodoListChanged =
            approvedTodoList !== undefined && JSON.stringify(normalizedTodos) !== JSON.stringify(approvedTodoList)

        await setTodoListForTask(normalizedTodos)
        console.log('normalizedTodos is', isTodoListChanged, normalizedTodos)
        if (isTodoListChanged) {
            const md = todoListToMarkdown(normalizedTodos)
            return {
                toolResult: formatResponse.toolResult("User edits todo:\n\n" + md)
            }

        } else {
            return {
                toolResult: formatResponse.toolResult("Todo list updated successfully.")
            }
        }
    } catch (error) {
        return {
            toolResult: `update todo list:${error}`
        }
    }

}