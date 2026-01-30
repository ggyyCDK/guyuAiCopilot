import { ChatMessage } from '@/type/imType/im';
import React, { FC } from 'react';
import { DiffOutlined } from '@ant-design/icons';
import ContentContainer from '../ContentContainer';
import PathCard from '../PathCard';

interface MessageContentProps {
    message: ChatMessage
}

const ToolApplyDiffContent: FC<MessageContentProps> = ({ message }) => {
    const { params } = message.content

    return (
        <ContentContainer title='编辑文件(apply_diff)'>
            <PathCard
                path={params.path}
                icon={<DiffOutlined />}
            />
        </ContentContainer>
    )
}

export default ToolApplyDiffContent
