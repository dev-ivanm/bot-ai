import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import { Toaster } from "react-hot-toast";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex h-screen w-full bg-[#0b141a] overflow-hidden">
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: "#202c33",
            color: "#e9edef",
            border: "1px solid #2a3942",
          },
          success: {
            iconTheme: {
              primary: "#00a884",
              secondary: "#e9edef",
            },
          },
        }}
      />
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        {children}
      </main>
    </div>
  );
};

export default Layout;
