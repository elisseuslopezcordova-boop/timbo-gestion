import { useAuth } from "./hooks/useAuth";
import { Login } from "./pages/Login";
import { AppShell } from "./AppShell";

function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="timbo-app"><div className="t-loading">Cargando…</div></div>;
  }

  if (!session) {
    return <Login />;
  }

  return <AppShell userEmail={session.user.email ?? ""} />;
}

export default App;
