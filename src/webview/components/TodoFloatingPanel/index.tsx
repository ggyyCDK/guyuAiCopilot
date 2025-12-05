import React, { useState, useMemo } from 'react';
import { TodoItem } from '@/type/tools/todo';
import styles from './index.module.scss';

interface TodoFloatingPanelProps {
    todoList: TodoItem[];
}

const TodoFloatingPanel: React.FC<TodoFloatingPanelProps> = ({ todoList }) => {
    const [todoExpanded, setTodoExpanded] = useState<boolean>(false);

    // 找到当前正在处理的任务
    const currentTask = useMemo(() => {
        return todoList.find(todo => todo.status === 'in_progress');
    }, [todoList]);

    if (!todoList || todoList.length === 0) {
        return null;
    }

    return (
        <div className={styles.todoWrapper}>
            {/* 待办事项折叠按钮 */}
            <div
                className={styles.todoToggle}
                onClick={() => setTodoExpanded(!todoExpanded)}
            >
                {currentTask ? (
                    <>
                        <span className={styles.currentTaskLabel}>📋 当前步骤：</span>
                        <span className={styles.currentTaskContent}>{currentTask.content}</span>
                    </>
                ) : (
                    <>
                        <span>📋 待办 ({todoList.length})</span>
                    </>
                )}
                <span className={styles.toggleIcon}>{todoExpanded ? '▼' : '▶'}</span>
            </div>

            {/* 待办事项浮层 */}
            {todoExpanded && (
                <div className={styles.todoFloatingPanel}>
                    <div className={styles.todoListContainer}>
                        <ul>
                            {todoList.map((todo) => (
                                <li key={todo.id} className={styles.todoItem}>
                                    <span
                                        className={`${styles.todoStatus} ${todo.status === 'completed'
                                            ? styles.completed
                                            : todo.status === 'in_progress'
                                                ? styles.inProgress
                                                : styles.pending
                                            }`}
                                    >
                                        {todo.status === 'completed' ? '✓' :
                                            todo.status === 'in_progress' ? '⋯' : '○'}
                                    </span>
                                    <span className={styles.todoContent}>{todo.content}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TodoFloatingPanel;
