import AppRoutes from "./routes/AppRoutes";
import { useAuth } from "./context/AuthContext";

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        Loading MediCore...
      </div>
    );
  }

  return <AppRoutes />;
}