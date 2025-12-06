import { recursivelyMakeRequests } from "./recursivelyMakeRequests"
import { multiRoundTaskParams } from "@/type/imType/aiRequest"
import { multiRoundSharedState } from "../assisantPresentStore/multiRoundSharedState"
import * as vscode from 'vscode'

export const StartMultiRoundTask = async function (command: multiRoundTaskParams, webview: vscode.WebviewView) {
    //开启一次多轮对话
    multiRoundSharedState.abortController = new AbortController();
    multiRoundSharedState.abort = false;

    await recursivelyMakeRequests({
        ...command,
        question: [{ type: "text", text: command.question }],
        includeFileDetails: true
    }, webview)
}