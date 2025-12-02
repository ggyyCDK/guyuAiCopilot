import React, { FC } from 'react';
import { ChatMessage } from '@/type/imType/im';
import {
    FileAddOutlined
} from '@ant-design/icons';
import ContentContainer from '../ContentContainer';
import PathCard from '../PathCard'
import { parseXml } from '@/utils/parse'


interface MessageContentProps {
    message: ChatMessage
}
const ToolReadFileContent: FC<MessageContentProps> = ({ message }) => {
    const { params } = message.content
    
    // 处理文件点击事件
    const handleFileClick = (path: string) => {
        const vscode = (window as any).vscode;
        if (vscode) {
            vscode.postMessage({
                type: 'open-file',
                payload: { path }
            });
        }
    };
    
    // 支持多文件读取
    if (params.args) {
        try {
            const parsedXml = parseXml(params.args) as any
            const files = Array.isArray(parsedXml.file) ? parsedXml.file : [parsedXml.file]
            
            return <ContentContainer title='读取文件'>
                {files.map((file: any, index: number) => (
                    <PathCard
                        key={index}
                        path={file.path}
                        icon={<FileAddOutlined />}
                        onClick={() => handleFileClick(file.path)}
                    />
                ))}
            </ContentContainer>
        } catch (error) {
            console.error('Failed to parse args XML:', error)
            return <ContentContainer title='读取文件'>
                <div>文件读取中...</div>
            </ContentContainer>
        }
    }
    
    // 向后兼容：支持单文件读取
    return <ContentContainer title='读取文件'>
        <PathCard
            path={params.path}
            icon={<FileAddOutlined />}
            onClick={() => handleFileClick(params.path)}
        />
    </ContentContainer>
}

export default ToolReadFileContent

