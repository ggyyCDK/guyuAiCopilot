import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { globby, Options } from 'globby';
import { IToolExecutor } from '@/type/tools/msgToolsParse';

// Constants
const DEFAULT_IGNORE_DIRECTORIES = [
    'node_modules',
    '__pycache__',
    'env',
    'venv',
    'target/dependency',
    'build/dependencies',
    'dist',
    'out',
    'bundle',
    'vendor',
    'tmp',
    'temp',
    'deps',
    'Pods',
];

// Helper function to compare paths (case-insensitive on Windows)
function arePathsEqual(path1: string, path2: string): boolean {
    const normalized1 = path.normalize(path1).replace(/[/\\]+$/, '');
    const normalized2 = path.normalize(path2).replace(/[/\\]+$/, '');
    
    if (process.platform === 'win32') {
        return normalized1.toLowerCase() === normalized2.toLowerCase();
    }
    return normalized1 === normalized2;
}

// Helper function to check if path is restricted (root or home directory)
function isRestrictedPath(absolutePath: string): boolean {
    const root = process.platform === 'win32' ? path.parse(absolutePath).root : '/';
    const isRoot = arePathsEqual(absolutePath, root);
    if (isRoot) {
        return true;
    }

    const homeDir = os.homedir();
    const isHomeDir = arePathsEqual(absolutePath, homeDir);
    if (isHomeDir) {
        return true;
    }

    return false;
}

// Helper function to check if targeting hidden directory
function isTargetingHiddenDirectory(absolutePath: string): boolean {
    const dirName = path.basename(absolutePath);
    return dirName.startsWith('.');
}

// Build ignore patterns
function buildIgnorePatterns(absolutePath: string): string[] {
    const isTargetHidden = isTargetingHiddenDirectory(absolutePath);
    const patterns = [...DEFAULT_IGNORE_DIRECTORIES];

    // Only ignore hidden directories if we're not explicitly targeting a hidden directory
    if (!isTargetHidden) {
        patterns.push('.*');
    }

    return patterns.map((dir) => `**/${dir}/**`);
}

// Breadth-first traversal of directory structure level by level
async function globbyLevelByLevel(limit: number, options?: Options): Promise<string[]> {
    const results: Set<string> = new Set();
    const queue: string[] = ['*'];

    const globbingProcess = async () => {
        while (queue.length > 0 && results.size < limit) {
            const pattern = queue.shift()!;
            const filesAtLevel = await globby(pattern, options);

            for (const file of filesAtLevel) {
                if (results.size >= limit) {
                    break;
                }
                results.add(file);
                if (file.endsWith('/')) {
                    // Escape parentheses in the path to prevent glob pattern interpretation
                    const escapedFile = file.replace(/\(/g, '\\(').replace(/\)/g, '\\)');
                    queue.push(`${escapedFile}*`);
                }
            }
        }
        return Array.from(results).slice(0, limit);
    };

    // Timeout after 10 seconds and return partial results
    const timeoutPromise = new Promise<string[]>((_, reject) => {
        setTimeout(() => reject(new Error('Globbing timeout')), 10_000);
    });

    try {
        return await Promise.race([globbingProcess(), timeoutPromise]);
    } catch (_error) {
        console.warn('Globbing timed out, returning partial results');
        return Array.from(results);
    }
}

/**
 * 列出指定目录的文件
 * @param command 工具命令，包含 path (目录路径), recursive (是否递归), limit (限制数量) 等参数
 */
export const listFiles: IToolExecutor = async (command) => {
    const { toolUseCommand } = command;
    const dirPath = toolUseCommand.params.path?.trim() || '.';
    const recursiveParam = toolUseCommand.params.recursive;
    const recursive = recursiveParam === 'true';
    // limit 参数可能不在类型定义中，使用默认值
    const limit = 1000; // 默认限制为 1000 个文件

    // Resolve workspace path
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceRoot = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : undefined;

    if (!path.isAbsolute(dirPath) && !workspaceRoot) {
        throw new Error('Cannot resolve relative path because no workspace folder is open.');
    }

    const resolvedPath = path.isAbsolute(dirPath)
        ? dirPath
        : path.join(workspaceRoot as string, dirPath);

    const absolutePath = path.resolve(resolvedPath);

    // Do not allow listing files in root or home directory
    if (isRestrictedPath(absolutePath)) {
        return {
            toolResult: JSON.stringify({ files: [], hasMore: false }),
        };
    }

    const options: Options = {
        cwd: absolutePath,
        dot: true, // do not ignore hidden files/directories
        absolute: true,
        markDirectories: true, // Append a / on any directories matched
        gitignore: recursive, // globby ignores any files that are gitignored
        ignore: recursive ? buildIgnorePatterns(absolutePath) : undefined,
        onlyFiles: false, // include directories in results
        suppressErrors: true,
    };

    const filePaths = recursive
        ? await globbyLevelByLevel(limit, options)
        : (await globby('*', options)).slice(0, limit);

    const hasMore = filePaths.length >= limit;

    return {
        toolResult: JSON.stringify({
            files: filePaths,
            hasMore,
        }),
    };
};

