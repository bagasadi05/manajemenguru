import React, { createContext, useContext, useState } from 'react';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export interface TabsProps {
    children: React.ReactNode;
    defaultValue: string;
    className?: string;
    onValueChange?: (value: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ children, defaultValue, className, onValueChange }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);

  const handleSetActiveTab = (value: string) => {
    setActiveTab(value);
    if (onValueChange) {
      onValueChange(value);
    }
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleSetActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

const useTabs = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('useTabs must be used within a Tabs component');
  }
  return context;
};

export const TabsList: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => (
  <div role="tablist" className={`inline-flex h-auto items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800/60 p-1 text-gray-600 dark:text-gray-300 overflow-x-auto ${className}`}>
    {children}
  </div>
);

export const TabsTrigger: React.FC<{ children: React.ReactNode, value: string, className?: string }> = ({ children, value, className }) => {
  const { activeTab, setActiveTab } = useTabs();
  const isActive = activeTab === value;
  
  return (
    <button
      onClick={() => setActiveTab(value)}
      data-state={isActive ? 'active' : 'inactive'}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ring-offset-white dark:ring-offset-gray-950 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md flex-shrink-0 ${className}`}
      aria-selected={isActive}
      role="tab"
    >
      {children}
    </button>
  );
};

export const TabsContent: React.FC<{ children: React.ReactNode, value: string, className?: string }> = ({ children, value, className }) => {
  const { activeTab } = useTabs();
  const isActive = activeTab === value;

  if (!isActive) return null;

  return (
     <div
      key={value}
      role="tabpanel"
      data-state={isActive ? 'active' : 'inactive'}
      className={`ring-offset-white dark:ring-offset-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${className}`}
    >
      {children}
    </div>
  );
};