import Sidebar from "../components/Sidebar";
import {Topbar} from "../components/Topbar";
import { Outlet } from "react-router-dom";

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:block">
        <Sidebar isOpen={false} onClose={function (): void {
          throw new Error("Function not implemented.");
        } } />
      </aside>

      {/* MAIN WRAPPER */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* TOP BAR */}
        <Topbar />

        {/* CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <Sidebar isOpen={false} onClose={function (): void {
          throw new Error("Function not implemented.");
        } } />
      </div>
    </div>
  );
}