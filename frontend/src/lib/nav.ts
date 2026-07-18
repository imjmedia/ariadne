/**
 * Resuelve qué entrada del sidebar debe mostrarse activa según la ruta actual.
 */
export function getActiveNavHref(pathname: string): string {
  if (pathname.startsWith('/ayuda')) return '/ayuda';
  if (pathname.startsWith('/settings/system')) return '/settings/system';
  if (pathname.startsWith('/settings')) return '/settings';
  if (pathname.startsWith('/domains')) return '/domains';
  if (pathname.startsWith('/dashboard')) return '/dashboard';
  if (pathname.startsWith('/graph-explorer')) return '/graph-explorer';
  if (pathname.startsWith('/credentials')) return '/credentials';
  if (pathname.startsWith('/users')) return '/users';
  if (pathname.startsWith('/profile')) return '/profile';
  if (pathname.startsWith('/jobs')) return '/jobs';
  if (pathname.startsWith('/repos')) return '/repos';
  if (pathname.startsWith('/projects')) return '/projects';
  return '/dashboard';
}

/** Migas de pan para el header (rutas principales). */
export function breadcrumbsForPath(pathname: string): { to: string; label: string }[] {
  const home = { to: '/dashboard', label: 'Inicio' };

  if (pathname === '/dashboard') return [home, { to: '/dashboard', label: 'Dashboard' }];
  if (pathname === '/') return [home];
  if (pathname === '/projects') return [home, { to: '/projects', label: 'Proyectos' }];
  if (pathname.startsWith('/projects/new')) return [home, { to: '/projects', label: 'Proyectos' }, { to: '/projects/new', label: 'Crear proyecto' }];
  if (pathname.startsWith('/projects/')) {
    const rest = pathname.replace(/^\/projects\//, '');
    const [id, sub] = rest.split('/');
    if (sub === 'chat') {
      return [home, { to: '/projects', label: 'Proyectos' }, { to: `/projects/${id}`, label: 'Proyecto' }, { to: pathname, label: 'Chat' }];
    }
    return [home, { to: '/projects', label: 'Proyectos' }, { to: `/projects/${id}`, label: 'Detalle' }];
  }
  if (pathname.startsWith('/domains')) return [home, { to: '/domains', label: 'Dominios' }];
  if (pathname.startsWith('/jobs')) return [home, { to: '/jobs', label: 'Cola de Sync' }];
  if (pathname.startsWith('/repos/')) {
    const id = pathname.replace(/^\/repos\//, '').split('/')[0];
    return [home, { to: '/repos', label: 'Repositorios' }, { to: `/repos/${id}`, label: 'Repositorio' }];
  }
  if (pathname.startsWith('/repos')) return [home, { to: '/repos', label: 'Repositorios' }];
  if (pathname.startsWith('/credentials')) return [home, { to: '/credentials', label: 'Credenciales' }];
  if (pathname.startsWith('/graph-explorer')) return [home, { to: '/graph-explorer', label: 'Grafo' }];
  if (pathname.startsWith('/users')) return [home, { to: '/users', label: 'Usuarios' }];
  if (pathname.startsWith('/profile')) return [home, { to: '/profile', label: 'Perfil' }];
  if (pathname.startsWith('/settings/system')) {
    return [home, { to: '/settings', label: 'Ajustes' }, { to: '/settings/system', label: 'Sistema' }];
  }
  if (pathname.startsWith('/settings')) return [home, { to: '/settings', label: 'Ajustes IA' }];
  if (pathname.startsWith('/ayuda')) return [home, { to: '/ayuda', label: 'Ayuda' }];

  return [home, { to: pathname, label: 'Página' }];
}
