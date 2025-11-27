export function addLineNumbers(content: string, startLine: number = 1): string {
    // If content is empty, return empty string - empty files should not have line numbers
    // If content is empty but startLine > 1, return "startLine | " because we know the file is not empty
    // but the content is empty at that line offset
    if (content === "") {
        return startLine === 1 ? "" : `${startLine} | \n`
    }

    // Split into lines and handle trailing line feeds (\n)
    const lines = content.split("\n")
    const lastLineEmpty = lines[lines.length - 1] === ""
    if (lastLineEmpty) {
        lines.pop()
    }

    const maxLineNumberWidth = String(startLine + lines.length - 1).length
    const numberedContent = lines
        .map((line, index) => {
            const lineNumber = String(startLine + index).padStart(maxLineNumberWidth, " ")
            return `${lineNumber} | ${line}`
        })
        .join("\n")

    return numberedContent + "\n"
}