//获取vscode环境信息
export const getEnvironmentDetails = (visibleFiles, openTabs) => {
    let details = '';
    details += `\n\n VSCode Visible Files`
    if (visibleFiles) {
        details += `\n${visibleFiles}`;
    } else {
        details += `\n no visible files`;
    }
    details += `\n\n VSCode Open Tabs`
    if (openTabs) {
        details += `\n${openTabs}`;
    } else {
        details += `\n no open tabs`;
    }
    return `\n<environment_details>${details.trim()}\n</environment_details>`
}