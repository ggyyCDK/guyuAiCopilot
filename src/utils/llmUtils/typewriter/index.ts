import { createTypewriterPipeline } from './pipe';
import { eager } from './strategies/eager';
import { toWord } from './strategies/toWord';
import { linear } from './strategies/linear';

interface ITypewriterOptions {
    stream: AsyncIterableIterator<string>;
    onMessage?: (message: string) => void;
    onComplete?: () => void;
}

export const typewriter = async (command: ITypewriterOptions) => {
    const { stream, onMessage, onComplete } = command;
    const pipeline = createTypewriterPipeline(stream, [
        //快速吞吐，尽快输出
        eager({ eagerInterval: 1, flushInterval: 0 }),
        toWord({ locale: 'en' }),
        //每50ms输出一个字符
        linear(20)]);
    // console.log('pipeline', pipeline);
    try {
        for await (const item of pipeline) {
            onMessage?.(item);
            // console.log('item finish', item);
        }
    } catch (error) {
        console.error('here stop', error);
    }
    // console.log('pipeline done');
    onComplete?.();
}