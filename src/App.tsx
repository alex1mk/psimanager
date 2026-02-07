import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./views/Dashboard";
import Agenda from "./views/Agenda";
import Expenses from "./views/Expenses";
import Reports from "./views/Reports";
import Patients from "./views/Patients";
import Login from "./views/Login";
import PublicConfirmation from "./views/PublicConfirmation";
import ReconfirmAppointment from "./views/ReconfirmAppointment";
import { Menu, Coffee } from "lucide-react";

interface User {
  name: string;
  email: string;
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isPublicRoute, setIsPublicRoute] = useState(false);

  // Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Detectar se é uma rota pública (ex: /confirmar?token=...)
  const params = new URLSearchParams(window.location.search);
  const path = window.location.pathname;

  console.log(`[App] Path: ${path}, Token: ${params.get('token')}`);

  if (params.get('token') || path.includes('/confirmar')) {
    setIsPublicRoute(true);
  }
}, []);

const handleLogin = (userData: User) => {
  setUser(userData);
  setIsAuthenticated(true);
};

const handleLogout = () => {
  setUser(null);
  setIsAuthenticated(false);
  setCurrentView("dashboard");
};

const renderView = () => {
  switch (currentView) {
    case "dashboard":
      return <Dashboard onNavigate={setCurrentView} />;
    case "agenda":
      return <Agenda />;
    case "expenses":
      return <Expenses />;
    case "reports":
      return <Reports />;
    case "patients":
      return <Patients />;
    default:
      return <Dashboard onNavigate={setCurrentView} />;
  }
};

// Se for rota pública, renderiza sem autenticação
if (isPublicRoute) {
  return <PublicConfirmation />;
}

if (!isAuthenticated) {
  return <Login onLogin={handleLogin} />;
}

return (
  <div className="min-h-screen bg-bege-calmo flex font-sans text-verde-botanico relative overflow-hidden">
    {/* Watermark */}
    <div className="absolute inset-0 z-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
      <Coffee size={500} strokeWidth={1} />
    </div>

    <Sidebar
      currentView={currentView}
      setCurrentView={setCurrentView}
      onLogout={handleLogout}
      userName={user?.name}
      isCollapsed={isSidebarCollapsed}
      toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
    />

    {/* Mobile Header */}
    <div className="md:hidden fixed top-0 w-full bg-verde-botanico text-white z-20 shadow-md px-4 py-3 flex justify-between items-center">
      <span className="font-bold text-lg tracking-tight">PsiManager</span>
      <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
        <Menu className="text-white" />
      </button>
    </div>

    {/* Mobile Menu Overlay */}
    {mobileMenuOpen && (
      <div
        className="md:hidden fixed inset-0 z-30 bg-slate-900/50"
        onClick={() => setMobileMenuOpen(false)}
      >
        <div
          className="bg-verde-botanico w-64 h-full pt-16 flex flex-col justify-between"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col p-4 space-y-2">
            <button
              onClick={() => {
                setCurrentView("dashboard");
                setMobileMenuOpen(false);
              }}
              className="p-3 text-left hover:bg-white/10 rounded text-white font-medium"
            >
              Dashboard
            </button>
            <button
              onClick={() => {
                setCurrentView("agenda");
                setMobileMenuOpen(false);
              }}
              className="p-3 text-left hover:bg-white/10 rounded text-white font-medium"
            >
              Agenda
            </button>
            <button
              onClick={() => {
                setCurrentView("patients");
                setMobileMenuOpen(false);
              }}
              className="p-3 text-left hover:bg-white/10 rounded text-white font-medium"
            >
              Pacientes
            </button>
            <button
              onClick={() => {
                setCurrentView("expenses");
                setMobileMenuOpen(false);
              }}
              className="p-3 text-left hover:bg-white/10 rounded text-white font-medium"
            >
              Despesas
            </button>
            <button
              onClick={() => {
                setCurrentView("reports");
                setMobileMenuOpen(false);
              }}
              className="p-3 text-left hover:bg-white/10 rounded text-white font-medium"
            >
              Relatórios
            </button>
          </div>
          <div className="p-4 border-t border-white/10 text-white">
            <div className="mb-4 px-3">
              <p className="text-sm font-bold">{user?.name}</p>
              <p className="text-xs text-white/70">Administradora</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left p-3 text-red-300 hover:bg-red-900/20 rounded"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    )}

    <main
      className={`flex-1 p-6 md:p-10 pt-20 md:pt-10 transition-all duration-300 ease-in-out relative z-10 ${isSidebarCollapsed ? "md:ml-20" : "md:ml-64"
        }`}
    >
      {renderView()}
    </main>
  </div>
);
};

export default App;
