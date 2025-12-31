import * as childProcess from "child_process"
import * as path from "path"
import * as readline from "readline"
import * as vscode from "vscode"
import * as fs from 'fs'

const isWindows = process.platform.startsWith("win")
const binName = isWindows ? "rg.exe" : "rg"

interface SearchFileResult {
    file: string
    searchResults: SearchResult[]
}

interface SearchResult {
    lines: SearchLineResult[]
}

interface SearchLineResult {
    line: number
    text: string
    isMatch: boolean
    column?: number
}

const MAX_RESULTS = 300
const MAX_LINE_LENGTH = 500

export function truncateLine(line: string, maxLength: number = MAX_LINE_LENGTH): string {
    return line.length > maxLength ? line.substring(0, maxLength) + " [truncated...]" : line
}

async function fileExistsAtPath(path: string): Promise<boolean> {
    try {
        await fs.promises.access(path)
        return true
    } catch {
        return false
    }
}

export async function getBinPath(vscodeAppRoot: string): Promise<string | undefined> {
    const checkPath = async (pkgFolder: string) => {
        const fullPath = path.join(vscodeAppRoot, pkgFolder, binName)
        return (await fileExistsAtPath(fullPath)) ? fullPath : undefined
    }

    return (
        (await checkPath("node_modules/@vscode/ripgrep/bin/")) ||
        (await checkPath("node_modules/vscode-ripgrep/bin")) ||
        (await checkPath("node_modules.asar.unpacked/vscode-ripgrep/bin/")) ||
        (await checkPath("node_modules.asar.unpacked/@vscode/ripgrep/bin/"))
    )
}

async function execRipgrep(bin: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const rgProcess = childProcess.spawn(bin, args)

        const rl = readline.createInterface({
            input: rgProcess.stdout,
            crlfDelay: Infinity,
        })

        let output = ""
        let lineCount = 0
        const maxLines = MAX_RESULTS * 5

        rl.on("line", (line) => {
            if (lineCount < maxLines) {
                output += line + "\n"
                lineCount++
            } else {
                rl.close()
                rgProcess.kill()
            }
        })

        let errorOutput = ""
        rgProcess.stderr.on("data", (data) => {
            errorOutput += data.toString()
        })
        rl.on("close", () => {
            if (errorOutput) {
                reject(new Error(`ripgrep process error: ${errorOutput}`))
            } else {
                resolve(output)
            }
        })
        rgProcess.on("error", (error) => {
            reject(new Error(`ripgrep process error: ${error.message}`))
        })
    })
}

export async function regexSearchFiles(
    cwd: string,
    directoryPath: string,
    regex: string,
    filePattern?: string
): Promise<string> {
    const vscodeAppRoot = vscode.env.appRoot
    const rgPath = await getBinPath(vscodeAppRoot)

    if (!rgPath) {
        throw new Error("Could not find ripgrep binary")
    }

    const args = ["--json", "-e", regex]

    if (filePattern) {
        args.push("--glob", filePattern)
    }

    args.push("--context", "1", "--no-messages", directoryPath)

    let output: string
    try {
        output = await execRipgrep(rgPath, args)
    } catch (error) {
        console.error("Error executing ripgrep:", error)
        return "No results found"
    }

    const results: SearchFileResult[] = []
    let currentFile: SearchFileResult | null = null

    output.split("\n").forEach((line) => {
        if (line) {
            try {
                const parsed = JSON.parse(line)
                if (parsed.type === "begin") {
                    currentFile = {
                        file: parsed.data.path.text.toString(),
                        searchResults: [],
                    }
                } else if (parsed.type === "end") {
                    results.push(currentFile as SearchFileResult)
                    currentFile = null
                } else if ((parsed.type === "match" || parsed.type === "context") && currentFile) {
                    const line = {
                        line: parsed.data.line_number,
                        text: truncateLine(parsed.data.lines.text),
                        isMatch: parsed.type === "match",
                        ...(parsed.type === "match" && { column: parsed.data.absolute_offset }),
                    }

                    const lastResult = currentFile.searchResults[currentFile.searchResults.length - 1]
                    if (lastResult?.lines.length > 0) {
                        const lastLine = lastResult.lines[lastResult.lines.length - 1]

                        if (parsed.data.line_number <= lastLine.line + 1) {
                            lastResult.lines.push(line)
                        } else {
                            currentFile.searchResults.push({
                                lines: [line],
                            })
                        }
                    } else {
                        currentFile.searchResults.push({
                            lines: [line],
                        })
                    }
                }
            } catch (error) {
                console.error("Error parsing ripgrep output:", error)
            }
        }
    })

    return formatResults(results, cwd)
}

function formatResults(fileResults: SearchFileResult[], cwd: string): string {
    const groupedResults: { [key: string]: SearchResult[] } = {}

    let totalResults = fileResults.reduce((sum, file) => sum + file.searchResults.length, 0)
    let output = ""
    if (totalResults >= MAX_RESULTS) {
        output += `Showing first ${MAX_RESULTS} of ${MAX_RESULTS}+ results. Use a more specific search if necessary.\n\n`
    } else {
        output += `Found ${totalResults === 1 ? "1 result" : `${totalResults.toLocaleString()} results`}.\n\n`
    }

    fileResults.slice(0, MAX_RESULTS).forEach((file) => {
        const relativeFilePath = path.relative(cwd, file.file)
        if (!groupedResults[relativeFilePath]) {
            groupedResults[relativeFilePath] = []

            groupedResults[relativeFilePath].push(...file.searchResults)
        }
    })

    for (const [filePath, fileResults] of Object.entries(groupedResults)) {
        output += `# ${filePath.split(path.sep).join('/')}\n`

        fileResults.forEach((result) => {
            if (result.lines.length > 0) {
                result.lines.forEach((line) => {
                    const lineNumber = String(line.line).padStart(3, " ")
                    output += `${lineNumber} | ${line.text.trimEnd()}\n`
                })
                output += "----\n"
            }
        })

        output += "\n"
    }

    return output.trim()
}
