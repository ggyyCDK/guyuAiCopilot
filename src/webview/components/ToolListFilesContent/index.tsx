import React, { FC } from 'react';
import { ChatMessage } from '@/type/imType/im';
import { FolderOutlined } from '@ant-design/icons';
import ContentContainer from '../ContentContainer';
import PathCard from '../PathCard';
import { getToolStatus, getToolStatusText } from '@/webview/utils/toolStatus';

interface MessageContentProps {
    message: ChatMessage
}

const ToolListFilesContent: FC<MessageContentProps> = ({ message }) => {
    const { params } = message.content;
    const toolStatus = getToolStatus(message.status);
    const statusText = getToolStatusText('list_files', toolStatus);
    const isScanning = toolStatus === 'pending';

    return (
        <ContentContainer title='列出文件' status={toolStatus} statusText={statusText}>
            <PathCard path={params.path || '.'} icon={<FolderOutlined />} scanning={isScanning} />
        </ContentContainer>
    );
}

export default ToolListFilesContent

