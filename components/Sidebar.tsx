import React from 'react';
import { LayoutDashboard, Users, Calendar, Receipt, FileText, Settings, LogOut, UserCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  onLogout?: () => void;
  userName?: string;
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    currentView, 
    setCurrentView, 
    onLogout, 
    userName = 'Usuário',
    isCollapsed,
    toggleSidebar
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'patients', label: 'Pacientes', icon: Users },
    { id: 'expenses', label: 'Despesas', icon: Receipt },
    { id: 'reports', label: 'Relatórios', icon: FileText },
  ];

  return (
    <div 
        className={`bg-[#004D40] h-screen shadow-xl flex flex-col fixed left-0 top-0 z-10 hidden md:flex transition-all duration-300 ease-in-out ${
            isCollapsed ? 'w-20' : 'w-64'
        }`}
    >
      {/* Header / Logo */}
      <div className={`p-6 flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''} border-b border-white/10`}>
        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shadow-inner flex-shrink-0">
           <span className="text-white font-bold text-lg">P</span>
        </div>
        {!isCollapsed && (
            <h1 className="text-xl font-bold text-white tracking-tight animate-fade-in whitespace-nowrap">
                PsiManager
            </h1>
        )}
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto mt-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              title={isCollapsed ? item.label : ''}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${
                isCollapsed ? 'justify-center' : ''
              } ${
                isActive 
                  ? 'bg-white text-[#004D40] shadow-md font-semibold' 
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon 
                size={22} 
                className={`flex-shrink-0 ${isActive ? 'text-[#004D40]' : 'text-white/70 group-hover:text-white'}`} 
              />
              {!isCollapsed && (
                  <span className="animate-fade-in text-sm">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / User / Toggle */}
      <div className="p-3 border-t border-white/10 space-y-2">
        {/* User Profile Snippet */}
        <div className={`flex items-center gap-3 px-2 py-2 rounded-lg bg-black/20 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                <UserCircle size={20} />
            </div>
            {!isCollapsed && (
                <div className="overflow-hidden animate-fade-in">
                    <p className="text-xs font-bold text-white truncate max-w-[120px]" title={userName}>{userName}</p>
                    <p className="text-[10px] text-white/60">Administradora</p>
                </div>
            )}
        </div>

        <div className="pt-1">
             {/* Toggle Button */}
             <button 
                onClick={toggleSidebar}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 rounded-lg transition-colors mb-1 ${
                    isCollapsed ? 'justify-center' : ''
                }`}
                title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
            >
                {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                {!isCollapsed && <span>Recolher</span>}
            </button>

            <button 
                onClick={onLogout}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-200 hover:bg-red-900/30 rounded-lg transition-colors ${
                    isCollapsed ? 'justify-center' : ''
                }`}
                title="Sair"
            >
                <LogOut size={20} />
                {!isCollapsed && <span>Sair</span>}
            </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;