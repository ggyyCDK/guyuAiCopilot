import React, { useEffect, useState } from 'react';
import { HistoryOutlined, FolderOpenOutlined, ClockCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import styles from './index.module.scss';
import { useIMStore } from '@/store/imStore/createStore';

interface HistoryPanelProps {
    onBack: () => void;
    conversationId: string;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ onBack, conversationId }) => {
    const { sessionList } = useIMStore();
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    useEffect(() => {

        const fetchSessions = async () => {


            setLoading(true);
            try {
                // 发送消息给插件去获取会话列表
                if ((window as any).vscode) {
                    (window as any).vscode.postMessage({
                        type: 'get-session-list',
                        payload: {
                            conversationId,
                            baseUrl: 'http://127.0.0.1:7001'
                        }
                    });
                }
            } catch (err: any) {
                console.error('Fetch sessions error:', err);
                setError(err.message || '网络请求失败');
            } finally {
                setTimeout(() => setLoading(false), 500);
            }
        };

        fetchSessions();
    }, []);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className={styles.historyContainer}>
            {loading && sessionList.length === 0 ? (
                <div className={styles.loadingState}>
                    <ClockCircleOutlined spin /> 加载中...
                </div>
            ) : error ? (
                <div className={styles.emptyState}>
                    <div>⚠️ {error}</div>
                </div>
            ) : sessionList.length === 0 ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📭</div>
                    <div>暂无历史记录</div>
                </div>
            ) : (
                <div className={styles.historyList}>
                    {sessionList.map((session) => (
                        <div key={session.id} className={styles.historyCard}>
                            <div className={styles.cardHeader}>
                                <div className={styles.cardTitle}>{session.name || '未命名会话'}</div>
                                <div className={styles.cardDate}>{formatDate(session.createDate)}</div>
                            </div>
                            <div className={styles.cardPath}>
                                <FolderOpenOutlined />
                                <span title={session.curPwd}>{session.curPwd || '未知路径'}</span>
                            </div>
                            <div className={styles.cardFooter}>
                                <span className={styles.tag}>{session.businessType || 'General'}</span>
                                {/* <span className={styles.tag}>ID: {session.id.slice(0, 8)}...</span> */}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HistoryPanel;
