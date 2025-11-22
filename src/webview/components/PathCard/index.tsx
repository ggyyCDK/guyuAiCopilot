import classNames from 'classnames';
import React, { FC } from 'react';
import styles from './index.module.scss';

interface PathCardProps {
    path: string;
    icon?: React.ReactNode;
    children?: React.ReactNode;
    onClick?: () => void;
}

const PathCard: FC<PathCardProps> = ({ path, icon, children, onClick }) => {
    return (
        <div className={classNames(styles.card, styles.pathCard)} onClick={onClick}>
            <div className={styles.pathInfo}>
                <div className={styles.path}>{path}</div>
                <div className={styles.icon}>{icon}</div>
            </div>
            {children ? <div className={styles.content}>{children}</div> : null}
        </div>
    );
};

export default PathCard;