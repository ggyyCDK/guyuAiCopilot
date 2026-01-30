import React, { FC, useMemo, useRef } from 'react';
import { ChatMessage } from '@/type/imType/im';
import { FileAddOutlined } from '@ant-design/icons';
import ContentContainer from '../ContentContainer';
import PathCard from '../PathCard'
import { parseXml } from '@/utils/parse'
import { getToolStatus, getToolStatusText } from '@/webview/utils/toolStatus';

interface MessageContentProps {
    message: ChatMessage
}

const ToolReadFileContent: FC<MessageContentProps> = ({ message }) => {
    const { params } = message.content
    const toolStatus = getToolStatus(message.status);
    const statusText = getToolStatusText('read_file', toolStatus);
    const isScanning = toolStatus === 'pending';

    // 缓存上一次成功解析的文件列表，避免闪烁
    const cachedFilesRef = useRef<string[]>([]);

    // 解析文件路径列表
    const files = useMemo(() => {
        let result: string[] = [];

        if (params.path) {
            result = [params.path];
        } else if (params.args) {
            try {
                const parsedXml = parseXml(params.args) as any;
                if (parsedXml && parsedXml.file) {
                    const fileList = Array.isArray(parsedXml.file) ? parsedXml.file : [parsedXml.file];
                    result = fileList
                        .filter(Boolean)
                        .map((f: any) => {
                            if (typeof f === 'string') return f;
                            if (typeof f?.path === 'string') return f.path;
                            if (typeof f?.path?.['#text'] === 'string') return f.path['#text'];
                            return null;
                        })
                        .filter(Boolean);
                }
            } catch (error) {
                // 解析失败，使用缓存的结果
            }
        }

        // 只有解析成功才更新缓存
        if (result.length > 0) {
            cachedFilesRef.current = result;
        }

        // 返回当前结果或缓存结果
        return result.length > 0 ? result : cachedFilesRef.current;
    }, [params.path, params.args]);

    return (
        <ContentContainer title='读取文件' status={toolStatus} statusText={statusText}>
            {files.length > 0 ? (
                files.map((filePath: string, index: number) => (
                    <PathCard
                        key={index}
                        path={filePath}
                        icon={<FileAddOutlined />}
                        scanning={isScanning}
                    />
                ))
            ) : (
                <PathCard
                    path="..."
                    icon={<FileAddOutlined />}
                    scanning={isScanning}
                />
            )}
        </ContentContainer>
    );
}

export default ToolReadFileContent