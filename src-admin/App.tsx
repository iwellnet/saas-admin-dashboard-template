import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Organizations } from "./pages/Organizations";
import { AdminLayout } from "./components/AdminLayout";

function ProtectedLayout() {
  const { profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Загрузка…
      </div>
    );
  }
  if (!profile) return <Navigate to="/login" replace />;
  return <AdminLayout />;
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-muted-foreground mt-2">Будет добавлено в следующих спринтах.</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orgs" element={<Organizations />} />
        <Route path="/payments" element={<Placeholder title="Платежи" />} />
        <Route path="/audit" element={<Placeholder title="Audit log" />} />
        <Route path="/admins" element={<Placeholder title="Super-admins" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
