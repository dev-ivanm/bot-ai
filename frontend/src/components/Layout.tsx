import { useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import { Menu } from "lucide-react";


interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] w-full bg-[#111b21] overflow-hidden relative">
      {/* Sidebar - Desktop (siempre visible) y Mobile (condicional con overlay) */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Backdrop for mobile */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        {/* Mobile Header (Solo visible en pantallas < lg) */}
        <header className="lg:hidden h-14 bg-[#202c33] border-b border-[#2a3942] flex items-center px-4 shrink-0 z-30">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-[#8696a0] hover:text-[#e9edef] transition-colors"
          >
            <Menu size={24} />
          </button>
          <span className="ml-4 font-bold text-[#e9edef] tracking-tight">Bot AI</span>
        </header>

        {/* Contenedor principal para el contenido de la página */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
