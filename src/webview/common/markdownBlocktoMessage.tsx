import React, { memo, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import styled from "styled-components"
import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"
import remarkGfm from "remark-gfm"
import { CopyOutlined, CheckOutlined } from '@ant-design/icons'
import { message } from 'antd'

interface MarkdownBlockProps {
    markdown?: string
}

const StyledMarkdown = styled.div`
	* {
		font-weight: 400;
	}

	strong {
		font-weight: 600;
	}

	code:not(pre > code) {
		font-family: var(--vscode-editor-font-family, monospace);
		font-size: 0.85em;
		filter: saturation(110%) brightness(95%);
		color: var(--vscode-textPreformat-foreground) !important;
		background-color: var(--vscode-textPreformat-background) !important;
		padding: 1px 2px;
		white-space: pre-line;
		word-break: break-word;
		overflow-wrap: anywhere;
	}

	/* Target only Dark High Contrast theme using the data attribute VS Code adds to the body */
	body[data-vscode-theme-kind="vscode-high-contrast"] & code:not(pre > code) {
		color: var(
			--vscode-editorInlayHint-foreground,
			var(--vscode-symbolIcon-stringForeground, var(--vscode-charts-orange, #e9a700))
		);
	}

	/* KaTeX styling */
	.katex {
		font-size: 1.1em;
		color: var(--vscode-editor-foreground);
		font-family: KaTeX_Main, "Times New Roman", serif;
		line-height: 1.2;
		white-space: normal;
		text-indent: 0;
	}

	.katex-display {
		display: block;
		margin: 1em 0;
		text-align: center;
		padding: 0.5em;
		overflow-x: auto;
		overflow-y: hidden;
		background-color: var(--vscode-textCodeBlock-background);
		border-radius: 3px;
	}

	.katex-error {
		color: var(--vscode-errorForeground);
	}

	font-family:
		var(--vscode-font-family),
		system-ui,
		-apple-system,
		BlinkMacSystemFont,
		"Segoe UI",
		Roboto,
		Oxygen,
		Ubuntu,
		Cantarell,
		"Open Sans",
		"Helvetica Neue",
		sans-serif;

	font-size: var(--vscode-font-size, 13px);

	p,
	li,
	ol,
	ul {
		line-height: 1.35em;
	}

	li {
		margin: 0.5em 0;
	}

	ol,
	ul {
		padding-left: 2em;
		margin-left: 0;
	}

	ol {
		list-style-type: decimal;
	}

	ul {
		list-style-type: disc;
	}

	ol ol {
		list-style-type: lower-alpha;
	}

	ol ol ol {
		list-style-type: lower-roman;
	}

	p {
		white-space: pre-wrap;
		margin: 1em 0 0.25em;
	}

	/* Prevent layout shifts during streaming */
	pre {
		min-height: 3em;
		transition: height 0.2s ease-out;
	}

	/* Code block container styling */
	div:has(> pre) {
		position: relative;
		contain: layout style;
		padding: 0.5em 1em;
	}

    /* Override for specific implementation in MarkdownBlocktoMessage */
    div > pre {
        background-color: var(--vscode-textCodeBlock-background) !important;
    }

	a {
		color: var(--vscode-textLink-foreground);
		text-decoration: none;
		text-decoration-color: var(--vscode-textLink-foreground);
		&:hover {
			color: var(--vscode-textLink-activeForeground);
			text-decoration: underline;
		}
	}

	h1 {
		font-size: 1.65em;
		font-weight: 700;
		margin: 1.35em 0 0.5em;
	}

	h2 {
		font-size: 1.35em;
		font-weight: 500;
		margin: 1.35em 0 0.5em;
	}

	h3 {
		font-size: 1.2em;
		font-weight: 500;
	}

	/* Table styles for remark-gfm */
	table {
		border-collapse: collapse;
		margin: 1em 0;
		width: auto;
		min-width: 50%;
		max-width: 100%;
		table-layout: fixed;
	}

	/* Table wrapper for horizontal scrolling */
	.table-wrapper {
		overflow-x: auto;
		margin: 1em 0;
	}

	th,
	td {
		border: 1px solid var(--vscode-panel-border);
		padding: 8px 12px;
		text-align: left;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	th {
		background-color: var(--vscode-editor-background);
		font-weight: 600;
		color: var(--vscode-foreground);
	}

	tr:nth-child(even) {
		background-color: var(--vscode-editor-inactiveSelectionBackground);
	}

	tr:hover {
		background-color: var(--vscode-list-hoverBackground);
	}
`

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
                    // Simple validation: must contain dot or slash, and prefer no spaces for now to avoid false positives on normal code
                    // Also check if it's not too long or multi-line
                    if (!text.includes('\n') && !text.includes(' ') && /\.(ts|tsx|js|jsx|json|css|scss|less|html|md|markdown|py|go|java|c|cpp|h|hpp|rs|rb|php|sh|bat|cmd|conf|config|yaml|yml|xml|toml|gitignore|sql|properties|gradle|txt)$/i.test(text)) {
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
                // STRICT MODE: Must end with a valid extension from the whitelist
                // This prevents clicking on 'console.log' (if log is not in list) or 'foo/bar' (no extension)
                const isLikelyPath = !text.includes('\n') && !text.includes(' ') &&
                    /\.(ts|tsx|js|jsx|json|css|scss|less|html|md|markdown|py|go|java|c|cpp|h|hpp|rs|rb|php|sh|bat|cmd|conf|config|yaml|yml|xml|toml|gitignore|sql|properties|gradle|txt)$/i.test(text);

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
        <StyledMarkdown>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex as any]}
                components={components}>
                {markdown || ""}
            </ReactMarkdown>
        </StyledMarkdown>
    )
})

export default MarkdownBlocktoMessage
