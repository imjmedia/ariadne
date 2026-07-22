/**
 * @fileoverview **App** principal del frontend Ariadne: `BrowserRouter`, layout con sidebar, rutas protegidas OTP
 * y páginas de proyectos, repos, dominios, chat, grafo de componentes, cola de sync, credenciales, usuarios y perfil.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { SetupPage } from './pages/SetupPage';
import { ProjectList } from './pages/ProjectList';
import { ProjectDetail } from './pages/ProjectDetail';
import { ProjectChat } from './pages/ProjectChat';
import { CreateProject } from './pages/CreateProject';
import { RepoList } from './pages/RepoList';
import { RepoDetail } from './pages/RepoDetail';
import { RepoChat } from './pages/RepoChat';
import { RepoIndex } from './pages/RepoIndex';
import { EditRepo } from './pages/EditRepo';
import { CredentialsList } from './pages/CredentialsList';
import { EditCredential } from './pages/EditCredential';
import { Ayuda } from './pages/Ayuda';
import { ErrorPage } from './pages/ErrorPage';
import { ComponentGraphExplorer } from './pages/ComponentGraph';
import { DomainsList } from './pages/DomainsList';
import { ActiveJobsQueue } from './pages/ActiveJobsQueue';
import { Dashboard } from './pages/Dashboard';
import { UsersManagement } from './pages/UsersManagement';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { SystemSettingsPage } from './pages/SystemSettingsPage';

/** Marcadores antiguos `/repos/new` y `/repos/new?projectId=` → lista con modal de alta. */
function LegacyReposNewRedirect() {
  const { search } = useLocation();
  const qs = new URLSearchParams(search);
  const next = new URLSearchParams();
  next.set('openCreate', '1');
  const projectId = qs.get('projectId');
  if (projectId) next.set('projectId', projectId);
  return <Navigate to={`/repos?${next.toString()}`} replace />;
}

/** Componente raíz con enrutamiento. */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/error" element={<ErrorPage />} />
        <Route path="/*" element={<Layout />}>
          {/* `/` → `/dashboard` sin pasar por auth; las rutas protegidas exigen JWT al entrar en cada vista */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route element={<ProtectedRoute />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="projects/new" element={<CreateProject />} />
            <Route path="projects/:id/chat" element={<ProjectChat />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="projects" element={<ProjectList />} />
            <Route path="repos" element={<RepoList />} />
            <Route path="repos/new" element={<LegacyReposNewRedirect />} />
            <Route path="repos/:id/edit" element={<EditRepo />} />
            <Route path="repos/:id/chat" element={<RepoChat />} />
            <Route path="repos/:id/index" element={<RepoIndex />} />
            <Route path="repos/:id" element={<RepoDetail />} />
            <Route path="jobs" element={<ActiveJobsQueue />} />
            <Route path="credentials" element={<CredentialsList />} />
            <Route path="credentials/new" element={<Navigate to="/credentials?create=1" replace />} />
            <Route path="credentials/:id/edit" element={<EditCredential />} />
            <Route path="graph-explorer" element={<ComponentGraphExplorer />} />
            <Route path="domains" element={<DomainsList />} />
            <Route path="users" element={<UsersManagement />} />
            <Route path="admin" element={<UsersManagement />} />
            <Route path="admin/users" element={<Navigate to="/admin" replace />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings/system" element={<SystemSettingsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="ayuda/*" element={<Ayuda />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
