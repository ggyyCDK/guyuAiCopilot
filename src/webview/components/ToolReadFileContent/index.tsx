import React, { FC } from 'react';
import { ChatMessage } from '@/type/imType/im';
import {
    FileAddOutlined
} from '@ant-design/icons';
import ContentContainer from '../ContentContainer';
import PathCard from '../PathCard'

interface MessageContentProps {
    message: ChatMessage
}
const ToolReadFileContent: FC<MessageContentProps> = ({ message }) => {
    const { params } = message.content
    return <ContentContainer title='读取文件'>
        <PathCard path={params.path} icon={<FileAddOutlined />}></PathCard>
    </ContentContainer>
}

export default ToolReadFileContent

