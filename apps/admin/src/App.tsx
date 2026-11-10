import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api, session } from './api';
import { AppShell, BrandMark } from './components/AppShell';
import { Alert, Button, Field, Input } from './components/ui';
import { AuditPage } from './pages/AuditPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { RunDetailPage } from './pages/RunDetailPage';
import { RunsPage } from './pages/RunsPage';
import { TasksPage } from './pages/TasksPage';
import { WorkflowEditorPage } from './pages/WorkflowEditorPage';
import { WorkflowsPage } from './pages/WorkflowsPage';

function SignIn({ onSignIn }: { onSignIn: () => void }) {
  const [token, setToken] = useState('');
  const [actor, setActor] = useState(session.actor);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    session.save(token, actor);
    try {
      await api('/workflows');
      onSignIn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-gray-50 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center sm:mx-auto sm:w-full sm:max-w-md">
        <BrandMark className="size-10 text-sm" />
        <h2 className="mt-6 text-center text-2xl/9 font-bold tracking-tight text-gray-900">Sign in to OpenJidoka</h2>
        <p className="mt-2 px-4 text-center text-sm text-gray-500">Use the admin API token configured on the server.</p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
        <div className="bg-white px-6 py-12 shadow-sm sm:rounded-lg sm:px-12">
          <form onSubmit={submit} className="space-y-6">
            <Field label="Your name or email" hint="Recorded in the audit log for your actions.">
              {(id) => <Input id={id} value={actor} onChange={(e) => setActor(e.target.value)} autoComplete="email" required />}
            </Field>
            <Field label="Admin API token">
              {(id) => (
                <Input id={id} type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="current-password" required />
              )}
            </Field>
            {error && <Alert tone="error" title="Could not sign in">{error}</Alert>}
            <Button type="submit" variant="primary" className="w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [authed, setAuthed] = useState(Boolean(session.token));
  useEffect(() => {
    const logout = () => setAuthed(false);
    window.addEventListener('openjidoka:logout', logout);
    return () => window.removeEventListener('openjidoka:logout', logout);
  }, []);

  if (!authed) return <SignIn onSignIn={() => setAuthed(true)} />;

  return (
    <AppShell
      actor={session.actor}
      onSignOut={() => {
        session.clear();
        setAuthed(false);
      }}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/workflows" replace />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/workflows/:id" element={<WorkflowEditorPage />} />
        <Route path="/runs" element={<RunsPage />} />
        <Route path="/runs/:id" element={<RunDetailPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/connections" element={<ConnectionsPage />} />
        <Route path="/audit" element={<AuditPage />} />
      </Routes>
    </AppShell>
  );
}
