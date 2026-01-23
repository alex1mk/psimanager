import React from 'react';
import { LayoutDashboard, Users, Calendar, Receipt, FileText, Settings, LogOut, UserCircle, ChevronLeft, ChevronRight, UploadCloud } from 'lucide-react';

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
      className={`bg-[#599e4a] h-screen shadow-xl flex flex-col fixed left-0 top-0 z-10 hidden md:flex transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'
        }`}
    >
      {/* Header / Logo */}
      <div className={`p-6 flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''} border-b border-white/10`}>
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center shadow-inner flex-shrink-0">
          <span className="text-white font-bold text-lg">P</span>
        </div>
        {!isCollapsed && (
          <h1 className="text-xl font-bold text-white tracking-tight animate-fade-in whitespace-nowrap">
            PsiManager
          </h1>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto mt-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              title={isCollapsed ? item.label : ''}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-transform duration-200 hover:-translate-y-1 ${isCollapsed ? 'justify-center' : ''
                } ${isActive
                  ? 'bg-white text-[#599e4a] shadow-md font-semibold'
                  : 'text-white/90 hover:bg-white/20 hover:text-white'
                }`}
            >
              <Icon
                size={22}
                className={`flex-shrink-0 ${isActive ? 'text-[#599e4a]' : 'text-white'}`}
              />
              {!isCollapsed && (
                <span className="animate-fade-in text-sm">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / User / Toggle */}
      <div className="p-4 border-t border-white/10 space-y-4">
        {/* User Profile Snippet */}
        <div className={`flex flex-col items-center gap-2 ${isCollapsed ? 'justify-center' : ''}`}>
          {/* Avatar Photo */}
          <div className={`relative rounded-full border-4 border-[#B4DF9F] shadow-sm overflow-hidden flex-shrink-0 group cursor-pointer ${isCollapsed ? 'w-10 h-10' : 'w-16 h-16'}`}>
            <img
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
              alt="Administrator"
              className="w-full h-full object-cover transition-opacity group-hover:opacity-80"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
              <UploadCloud size={isCollapsed ? 12 : 20} className="text-white" />
            </div>
          </div>
          {!isCollapsed && (
            <div className="text-center animate-fade-in">
              <p className="text-sm font-bold text-white truncate max-w-[150px]">{userName}</p>
              <p className="text-xs text-white/80 font-medium">Administradora</p>
            </div>
          )}
        </div>

        <div className="pt-2">
          {/* Toggle Button */}
          <button
            onClick={toggleSidebar}
            className={`w-full flex items-center gap-3 px-2 py-2 text-xs font-medium text-white/70 hover:bg-white/10 rounded-lg transition-colors mb-1 ${isCollapsed ? 'justify-center' : 'justify-start'
              }`}
            title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!isCollapsed && <span>Recolher Menu</span>}
          </button>

          <button
            onClick={onLogout}
            className={`w-full flex items-center gap-3 px-2 py-2 text-xs font-medium text-red-100 hover:bg-red-900/30 rounded-lg transition-colors ${isCollapsed ? 'justify-center' : 'justify-start'
              }`}
            title="Sair"
          >
            <LogOut size={16} />
            {!isCollapsed && <span>Sair do Sistema</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;