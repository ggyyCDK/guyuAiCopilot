import { ToolUse } from "@/type/tools/msgToolsParse";
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ExecuteCommandResult {
    toolResult: string;
}

export const executeCommand = async ({
    toolUseCommand,
}: {
    toolUseCommand: ToolUse;
}): Promise<ExecuteCommandResult> => {
    try {
        const command = toolUseCommand.params.command;
        let cwd = toolUseCommand.params.cwd;

        if (!command) {
            return {
                toolResult: "Error: The 'command' parameter is required for execute_command."
            };
        }

        // Determine working directory
        if (!cwd) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                cwd = workspaceFolders[0].uri.fsPath;
            } else {
                // Return error if no workspace is open and no cwd provided
                return {
                    toolResult: "Error: No workspace is open and no 'cwd' parameter was provided. Please provide a absolute path for 'cwd'."
                }
            }
        }

        console.log(`Executing command: ${command} in ${cwd}`);

        try {
            const { stdout, stderr } = await execAsync(command, { cwd });

            let output = "";
            if (stdout) {
                output += `stdout:\n${stdout}\n`;
            }
            if (stderr) {
                output += `stderr:\n${stderr}\n`;
            }
            if (!output) {
                output = "Command executed successfully with no output.";
            }

            return {
                toolResult: output
            };

        } catch (error: any) {
            const errorMessage = error.message || String(error);
            const stderr = error.stderr ? `\nstderr:\n${error.stderr}` : "";
            const stdout = error.stdout ? `\nstdout:\n${error.stdout}` : "";

            return {
                toolResult: `Command failed: ${errorMessage}${stdout}${stderr}`
            };
        }

    } catch (err: any) {
        return {
            toolResult: `Detailed Error executing command: ${err.message || String(err)}`
        };
    }
};
