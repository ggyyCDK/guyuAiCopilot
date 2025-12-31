import React, { FC } from 'react';
import { ChatMessage } from '@/type/imType/im';
import {
    SearchOutlined
} from '@ant-design/icons';
import ContentContainer from '../ContentContainer';
import PathCard from '../PathCard'

interface MessageContentProps {
    message: ChatMessage
}
const ToolSearchFilesContent: FC<MessageContentProps> = ({ message }) => {
    const { params } = message.content
    return <ContentContainer title='搜索文件内容'>
        <div style={{ padding: '0 12px 8px' }}>
            <div style={{ marginBottom: 4 }}>
                <span style={{ opacity: 0.7, marginRight: 8 }}>Regex:</span>
                <span style={{ fontFamily: 'monospace', background: 'rgba(127, 127, 127, 0.1)', padding: '2px 4px', borderRadius: 3 }}>
                    {params.regex}
                </span>
            </div>
            {params.file_pattern && (
                <div style={{ marginBottom: 4 }}>
                    <span style={{ opacity: 0.7, marginRight: 8 }}>Pattern:</span>
                    <span style={{ fontFamily: 'monospace', background: 'rgba(127, 127, 127, 0.1)', padding: '2px 4px', borderRadius: 3 }}>
                        {params.file_pattern}
                    </span>
                </div>
            )}
        </div>
        <PathCard path={params.path || '.'} icon={<SearchOutlined />}></PathCard>
    </ContentContainer>
}

export default ToolSearchFilesContent
