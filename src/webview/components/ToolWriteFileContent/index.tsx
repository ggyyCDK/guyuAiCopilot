import React, { FC } from 'react';
import { ChatMessage } from '@/type/imType/im';
import { EditOutlined } from '@ant-design/icons';
import ContentContainer from '../ContentContainer';
import PathCard from '../PathCard';
import { getToolStatus, getToolStatusText } from '@/webview/utils/toolStatus';

interface MessageContentProps {
    message: ChatMessage
}

const ToolWriteFileContent: FC<MessageContentProps> = ({ message }) => {
    const { params } = message.content;
    const toolStatus = getToolStatus(message.status);
    const statusText = getToolStatusText('write_to_file', toolStatus);
    const isScanning = toolStatus === 'pending';

    return (
        <ContentContainer title='写入文件' status={toolStatus} statusText={statusText}>
            <PathCard path={params.path} icon={<EditOutlined />} scanning={isScanning} />
        </ContentContainer>
    );
}

export default ToolWriteFileContent