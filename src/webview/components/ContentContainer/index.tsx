import React, { FC } from 'react';
import classNames from 'classnames'
import styles from './index.module.scss'

export type ToolStatus = 'pending' | 'complete' | 'error';

interface ContentContainerProps {
    title: string | React.ReactNode;
    children: React.ReactNode;
    contentClassName?: string;
    titleClassName?: string;
    status?: ToolStatus;
    statusText?: string;
}

const statusClassMap: Record<ToolStatus, string> = {
    pending: styles.statusPending,
    complete: styles.statusComplete,
    error: styles.statusError,
};

const ContentContainer: FC<ContentContainerProps> = ({ 
    title, 
    children, 
    titleClassName, 
    contentClassName,
    status,
    statusText
}) => {
    const containerClass = classNames(
        styles.container,
        status && statusClassMap[status]
    );

    return (
        <div className={containerClass}>
            <div className={styles.header}>
                <div className={classNames(styles.title, titleClassName)}>{title}</div>
                {statusText && <span className={styles.statusText}>{statusText}</span>}
            </div>
            <div className={classNames(styles.content, contentClassName)}>{children}</div>
        </div>
    );
}

export default ContentContainer

