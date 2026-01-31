import { IToolExecutor } from '@/type/tools/msgToolsParse'
import { writeMemory, incrementTurn } from './memoryWriter'

export const attemptCompletion: IToolExecutor = async (command) => {

    const { toolUseCommand } = command

    const { params } = toolUseCommand

    const result = params.result;

    if (toolUseCommand.partial) {
        return {
            toolResult: ''
        }
    }

    // 写入AI响应到记忆
    if (result) {
        writeMemory({
            role: 'assistant',
            content: result
        });
        incrementTurn();
    }

    return {
        toolResult: ''
    }

}