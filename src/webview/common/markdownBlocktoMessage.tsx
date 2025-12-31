import React, { memo, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"
import remarkGfm from "remark-gfm"
import { CopyOutlined, CheckOutlined } from '@ant-design/icons'
import { message } from 'antd'

interface MarkdownBlockProps {
    markdown?: string
}

const MarkdownBlocktoMessage = memo(({ markdown }: MarkdownBlockProps) => {

    const components = useMemo(
        () => ({
            a: ({ href, children, ...props }: any) => {
                const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                    const isLocalPath = href?.startsWith("file://") || href?.startsWith("/") || !href?.includes("://")

                    if (!isLocalPath) {
                        return
                    }

                    e.preventDefault()

                    let filePath = href.replace("file://", "")
                    // Clean up file path logic if needed

                    // Call vscode api to open file
                    if ((window as any).vscode) {
                        (window as any).vscode.postMessage({
                            type: 'open-file',
                            payload: {
                                path: filePath
                            }
                        });
                    }
                }

                return (
                    <a {...props} href={href} onClick={handleClick}>
                        {children}
                    </a>
                )
            },
            pre: ({ children, ..._props }: any) => {
                const codeEl = children as React.ReactElement
                if (!codeEl || !codeEl.props) {
                    return <pre>{children}</pre>
                }

                const { className = "", children: codeChildren } = codeEl.props
                // Extract language from className
                const match = /language-(\w+)/.exec(className)
                const language = match ? match[1] : "text"

                let codeString = ""
                if (typeof codeChildren === "string") {
                    codeString = codeChildren
                } else if (Array.isArray(codeChildren)) {
                    codeString = codeChildren.filter((child) => typeof child === "string").join("")
                }

                return <div style={{ position: 'relative', marginTop: '8px', marginBottom: '8px' }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#2d2d2d',
                        padding: '4px 8px',
                        borderTopLeftRadius: '4px',
                        borderTopRightRadius: '4px',
                        fontSize: '12px',
                        color: '#ccc'
                    }}>
                        <span>{language}</span>
                        <CopyOutlined
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                                navigator.clipboard.writeText(codeString)
                                message.success('Copied!')
                            }}
                        />
                    </div>
                    <pre style={{ margin: 0, padding: '8px', background: '#1e1e1e', overflowX: 'auto', borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px' }}>
                        {children}
                    </pre>
                </div>
            },
            code: ({ node, inline, className, children, ...props }: any) => {
                const handleClick = (e: React.MouseEvent<HTMLElement>) => {
                    const text = String(children);
                    // Simple validation: must contain dot or slash, and prefer no spaces for now to avoid false positives on normal code
                    // Also check if it's not too long or multi-line
                    if (!text.includes('\n') && (text.includes('/') || text.includes('.'))) {
                        e.preventDefault();
                        e.stopPropagation();
                        if ((window as any).vscode) {
                            (window as any).vscode.postMessage({
                                type: 'open-file',
                                payload: {
                                    path: text
                                }
                            });
                        }
                    }
                }

                const text = String(children);
                // Heuristic to check if the text is a file path or filename
                // 1. Contains path separators (/ or \)
                // 2. OR matches a filename with common extensions
                const hasPathSeparator = text.includes('/') || text.includes('\\');
                const hasExtension = /^[a-zA-Z0-9_\-\.]+\.(ts|tsx|js|jsx|json|css|scss|less|html|md|py|go|java|c|cpp|h|hpp|rs|rb|php|sh|bat|cmd|conf|config|yaml|yml|xml|toml|gitignore|sql)$/i.test(text);

                const isLikelyPath = !text.includes('\n') && !text.includes(' ') && (hasPathSeparator || hasExtension);

                return <code
                    className={className}
                    {...props}
                    onClick={isLikelyPath ? handleClick : undefined}
                    style={{
                        cursor: isLikelyPath ? 'pointer' : 'default',
                        ...(isLikelyPath ? { textDecoration: 'underline', textUnderlineOffset: '2px', textDecorationStyle: 'dotted', textDecorationColor: '#666' } : {})
                    }}
                    title={isLikelyPath ? "Click to open file" : undefined}
                >
                    {children}
                </code>
            }

        }),
        [],
    )

    return (
        <div className="markdown-body">
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex as any]}
                components={components}>
                {markdown || ""}
            </ReactMarkdown>
        </div>
    )
})

export default MarkdownBlocktoMessage
