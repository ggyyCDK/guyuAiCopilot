import { IToolExecutor } from '@/type/tools/msgToolsParse'
export const attemptCompletion: IToolExecutor = async (command) => {

    const { toolUseCommand } = command

    const { params } = toolUseCommand

    const result = params.result;

    if (toolUseCommand.partial) {
        return {
            toolResult: ''
        }
    }

    return {
        toolResult: ''
    }

}