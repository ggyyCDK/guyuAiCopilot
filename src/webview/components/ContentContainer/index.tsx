import React, { FC } from 'react';
import classNames from 'classnames'
import styles from './index.module.scss'

interface ContentContainerProps {
    title: string | React.ReactNode;
    children: React.ReactNode;
    contentClassName?: string;
    titleClassName?: string
}
const ContentContainer: FC<ContentContainerProps> = ({ title, children, titleClassName, contentClassName }) => {

    return <div className={styles.container} >
        <div className={styles.header}>
            <div className={classNames(styles.title, titleClassName)}>{title}</div>
        </div>
        <div className={classNames(styles.content, contentClassName)}>{children}</div>
    </div>
}

export default ContentContainer

