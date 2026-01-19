
import React from 'react';
import { ICONS, LAYOUT, COLORS } from '../constants';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <ICONS.Analysis className="w-4 h-4" /> },
    { id: 'research', label: 'In-Depth Research', icon: <ICONS.Search className="w-4 h-4" /> },
    { id: 'history', label: 'Analysis History', icon: <ICONS.History className="w-4 h-4" /> },
    { id: 'settings', label: 'System Settings', icon: <ICONS.Settings className="w-4 h-4" /> },
  ];

  return (
    <aside className={`${LAYOUT.SIDEBAR_WIDTH} flex flex-col h-screen border-r border-slate-200 bg-white sticky top-0`}>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold">N</div>
          <span className="font-semibold text-lg tracking-tight text-slate-900">Nexus AI</span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === item.id
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Usage</p>
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
            <span>Quota Used</span>
            <span>42%</span>
          </div>
          <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
            <div className="bg-indigo-600 h-full w-[42%]" />
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
