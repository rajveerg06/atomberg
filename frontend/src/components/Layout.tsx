import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { LayoutDashboard, Target, Users, CheckSquare, Settings, LogOut, Bell, Search, Menu, X } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'My Goals', path: '/goals', icon: Target },
    ...(user?.role === 'manager' || user?.role === 'admin' ? [
      { name: 'Team Review', path: '/team/review', icon: Users },
      { name: 'Check-ins', path: '/team/checkins', icon: CheckSquare },
    ] : []),
    ...(user?.role === 'admin' ? [
      { name: 'Admin Settings', path: '/admin', icon: Settings },
    ] : []),
  ];

  return (
    <div className="app-container">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 glass-panel border-r border-t-0 border-b-0 border-l-0 border-subtle fixed h-full z-20">
        <div className="p-6 flex items-center gap-3 border-b border-subtle">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-glow">
            <Target className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold font-display tracking-tight text-gradient">GoalTrack</span>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-[inset_0_0_12px_rgba(99,102,241,0.1)]' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-subtle">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <div 
              className="avatar avatar-md flex-shrink-0"
              style={{ backgroundColor: user?.avatar_color || '#6366f1' }}
            >
              {getInitials(user?.name || '')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate capitalize">{user?.role}</p>
            </div>
            <button onClick={logout} className="p-2 text-slate-400 hover:text-red-400 transition-colors" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content md:ml-64 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="h-16 glass-panel border-b border-subtle border-l-0 border-r-0 border-t-0 flex items-center justify-between px-4 sticky top-0 z-10 rounded-none shadow-none">
          <div className="flex items-center md:hidden">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-400 hover:text-white">
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-3 font-bold font-display text-gradient">GoalTrack</span>
          </div>

          <div className="hidden md:block flex-1">
            <h1 className="text-lg font-semibold text-slate-200 font-display">
              {navItems.find(i => i.path === location.pathname)?.name || 'Goal Management'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-white transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-slate-900"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full animate-fade-in">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 md:hidden flex">
          <aside className="w-64 bg-slate-900 border-r border-slate-800 h-full flex flex-col animate-fade-in" style={{ animationDuration: '200ms' }}>
            <div className="p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Target className="w-6 h-6 text-indigo-500" />
                <span className="text-xl font-bold font-display">GoalTrack</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-4 px-3">
              <nav className="space-y-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-3 rounded-lg font-medium ${
                        isActive ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </NavLink>
                ))}
              </nav>
            </div>
          </aside>
          <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)}></div>
        </div>
      )}
    </div>
  );
};

export default Layout;
