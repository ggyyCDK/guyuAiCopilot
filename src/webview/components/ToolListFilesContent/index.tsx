import React, { FC } from 'react';
import { ChatMessage } from '@/type/imType/im';
import {
    FolderOutlined
} from '@ant-design/icons';
import ContentContainer from '../ContentContainer';
import PathCard from '../PathCard'

interface MessageContentProps {
    message: ChatMessage
}
const ToolListFilesContent: FC<MessageContentProps> = ({ message }) => {
    const { params } = message.content
    return <ContentContainer title='当前列表文件'>
        <PathCard path={params.path || '.'} icon={<FolderOutlined />}></PathCard>
    </ContentContainer>
}

export default ToolListFilesContent

