import { ChatMessage } from '@/type/imType/im';
import React, { FC } from 'react';
import { SwapOutlined } from '@ant-design/icons';
import ContentContainer from '../ContentContainer';
import PathCard from '../PathCard';
import { getToolStatus, getToolStatusText } from '@/webview/utils/toolStatus';

interface MessageContentProps {
    message: ChatMessage
}

const ToolReplaceInFileContent: FC<MessageContentProps> = ({ message }) => {
    const { params } = message.content;
    const toolStatus = getToolStatus(message.status);
    const statusText = getToolStatusText('replace_in_file', toolStatus);
    const isScanning = toolStatus === 'pending';

    return (
        <ContentContainer title='编辑文件' status={toolStatus} statusText={statusText}>
            <PathCard
                path={params.path}
                icon={<SwapOutlined />}
                scanning={isScanning}
            />
        </ContentContainer>
    );
}

export default ToolReplaceInFileContent