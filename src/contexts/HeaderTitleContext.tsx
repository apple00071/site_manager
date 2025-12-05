'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type HeaderTitleContextType = {
    title: string | null;
    setTitle: (title: string | null) => void;
};

const HeaderTitleContext = createContext<HeaderTitleContextType | undefined>(undefined);

export function HeaderTitleProvider({ children }: { children: ReactNode }) {
    const [title, setTitle] = useState<string | null>(null);

    return (
        <HeaderTitleContext.Provider value={{ title, setTitle }}>
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
