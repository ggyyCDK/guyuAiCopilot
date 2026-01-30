import classNames from 'classnames';
import React, { FC } from 'react';
import styles from './index.module.scss';

interface PathCardProps {
    path: string;
    icon?: React.ReactNode;
    children?: React.ReactNode;
    onClick?: () => void;
    scanning?: boolean;
}

const PathCard: FC<PathCardProps> = ({ path, icon, children, onClick, scanning }) => {
    const handleDefaultClick = () => {
        const vscode = (window as any).vscode;
        if (vscode) {
            vscode.postMessage({
                type: 'open-file',
                payload: { path }
            });
        }
    };

    const handleClick = onClick || handleDefaultClick;

    return (
        <div 
            className={classNames(styles.card, styles.pathCard, { [styles.scanning]: scanning })} 
            onClick={handleClick}
        >
            <div className={styles.pathInfo}>
                <div className={styles.path}>{path}</div>
                <div className={styles.icon}>{icon}</div>
            </div>
            {children ? <div className={styles.content}>{children}</div> : null}
        </div>
    );
};

export default PathCard;