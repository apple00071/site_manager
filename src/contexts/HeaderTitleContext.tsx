'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type HeaderTab = {
    id: string;
    label: string;
    icon?: React.ReactNode;
};

export type HeaderAction = {
    id: string;
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
    icon?: React.ReactNode;
};

type HeaderTitleContextType = {
    title: string | null;
    subtitle: string | null;
    tabs: HeaderTab[];
    activeTab: string | null;
    onTabChange: ((tabId: string) => void) | null;
    actions: HeaderAction[];
    setTitle: (title: string | null) => void;
    setSubtitle: (subtitle: string | null) => void;
    setTabs: (tabs: HeaderTab[], activeTab: string | null, onTabChange: (id: string) => void) => void;
    setActions: (actions: HeaderAction[]) => void;
    clearHeader: () => void;
};

const HeaderTitleContext = createContext<HeaderTitleContextType | undefined>(undefined);

export function HeaderTitleProvider({ children }: { children: ReactNode }) {
    const [title, setTitle] = useState<string | null>(null);
    const [subtitle, setSubtitle] = useState<string | null>(null);
    const [tabs, setTabsState] = useState<HeaderTab[]>([]);
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [onTabChange, setOnTabChange] = useState<((tabId: string) => void) | null>(null);
    const [actions, setActionsState] = useState<HeaderAction[]>([]);

    const setTabs = useCallback((
        newTabs: HeaderTab[],
        newActiveTab: string | null,
        newOnTabChange: (id: string) => void
    ) => {
        setTabsState(newTabs);
        setActiveTab(newActiveTab);
        setOnTabChange(() => newOnTabChange);
    }, []);

    const setActions = useCallback((newActions: HeaderAction[]) => {
        setActionsState(newActions);
    }, []);

    const clearHeader = useCallback(() => {
        setTitle(null);
        setSubtitle(null);
        setTabsState([]);
        setActiveTab(null);
        setOnTabChange(null);
        setActionsState([]);
    }, []);

    return (
        <HeaderTitleContext.Provider value={{
            title,
            subtitle,
            tabs,
            activeTab,
            onTabChange,
            actions,
            setTitle,
            setSubtitle,
            setTabs,
            setActions,
            clearHeader
        }}>
            {children}
        </HeaderTitleContext.Provider>
    );
}

export function useHeaderTitle() {
    const context = useContext(HeaderTitleContext);
    if (context === undefined) {
        throw new Error('useHeaderTitle must be used within a HeaderTitleProvider');
    }
    return context;
}
