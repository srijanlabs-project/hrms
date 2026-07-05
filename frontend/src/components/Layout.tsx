import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

interface NavItem {
  to: string;
  label: string;
}

export function Layout({ navItems, title }: { navItems: NavItem[]; title: string }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 bg-brand-700 text-white flex flex-col">
        <div className="px-4 py-5 font-semibold text-lg border-b border-brand-600">{title}</div>
        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm ${isActive ? 'bg-brand-600 font-medium' : 'hover:bg-brand-600/60'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-brand-600 text-xs">
          <div className="opacity-80">{user?.roleName}</div>
          <button onClick={logout} className="mt-1 underline">
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
