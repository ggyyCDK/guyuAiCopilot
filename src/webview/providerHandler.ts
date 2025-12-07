import { useIMStore } from '@/store/imStore/createStore';
import { ChatMessage, MessageStatus, MessageType } from '@/type/imType/im';
import { transformServerMessage } from '@/utils/llmRequest/transformServerMessage';

export const createProviderMessageHandler = (setError: (error: string) => void) => {
    return (event: any) => {
        const data = event.data;
        const { type, payload } = data;
        const { mergeMessages } = useIMStore.getState();

        switch (type) {
            case 'stream-data':
                // 如果当前不在 loading 状态（比如用户取消了），则不接收流式数据
                if (!useIMStore.getState().chatLoading) {
                    return;
                }
                const { serverMessageList } = payload;
                mergeMessages(serverMessageList.map(transformServerMessage));
                break;

            case 'update-loading':
                // 更新 loading 状态
                useIMStore.setState({
                    chatLoading: payload.chatLoading
                });
                break;

            case 'update-tokens':
                // 更新为最新的 token 数（不是累加）
                const { totalTokens: newTokens } = payload;
                useIMStore.setState({
                    totalTokens: newTokens
                });
                break;

            case 'stream-error':
                console.error('Stream error:', payload.error);
                setError(payload.error);
                break;

            case 'update-todo-list':
                // 更新待办事项列表
                console.log('更新待办事项列表 is', useIMStore.getState().todoList);
                useIMStore.setState({
                    todoList: payload.todoList || []
                });
                break;

            //获取当前待办工作区
            case 'set-pwd':
                useIMStore.getState().setPwd(payload.cwd);
                break;

            case 'update-session-list':
                useIMStore.getState().setSessionList(payload.sessionList || []);
                break;

            case 'compress-complete':
                // 压缩完成
                useIMStore.setState({ compressing: false });

                // 添加压缩成功的消息
                const successMsgId = `${new Date().getTime()}_compress_success`;
                const successMessage: ChatMessage = {
                    msgId: successMsgId,
                    sender: {
                        targetId: 'llm'
                    },
                    status: MessageStatus.Complete,
                    sendTime: new Date().getTime(),
                    type: MessageType.Text,
                    content: '✅ 上下文压缩成功',
                    ext: {}
                };
                mergeMessages([successMessage]);
                break;

            case 'chat-canceled':
                const canceledMsgId = `${new Date().getTime()}_canceled`;
                const canceledMessage: ChatMessage = {
                    msgId: canceledMsgId,
                    sender: {
                        targetId: 'llm'
                    },
                    status: MessageStatus.Complete,
                    sendTime: new Date().getTime(),
                    type: MessageType.Text,
                    content: '🚫 对话已取消',
                    ext: {}
                };
                mergeMessages([canceledMessage]);
                break;
        }
    };
};
