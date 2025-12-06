import classNames from 'classnames';
import React, { FC } from 'react';
import styles from './index.module.scss';

interface PathCardProps {
    path: string;
    icon?: React.ReactNode;
    children?: React.ReactNode;
    onClick?: () => void; // 可选的自定义点击事件，如果不传则使用默认的 open-file 行为
}

const PathCard: FC<PathCardProps> = ({ path, icon, children, onClick }) => {
    // 默认的文件打开处理函数
    const handleDefaultClick = () => {
        const vscode = (window as any).vscode;
        if (vscode) {
            vscode.postMessage({
                type: 'open-file',
                payload: { path }
            });
        }
    };

    // 如果传入了自定义 onClick，使用自定义的；否则使用默认的文件打开逻辑
    const handleClick = onClick || handleDefaultClick;

    return (
        <div className={classNames(styles.card, styles.pathCard)} onClick={handleClick}>
            <div className={styles.pathInfo}>
                <div className={styles.path}>{path}</div>
                <div className={styles.icon}>{icon}</div>
            </div>
            {children ? <div className={styles.content}>{children}</div> : null}
        </div>
    );
};

export default PathCard;