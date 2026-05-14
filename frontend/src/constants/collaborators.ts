/**
 * Authors and contributors for the login footer (GitHub profile links).
 */

export type CollaboratorRole = 'primary' | 'contributor';

export interface Collaborator {
  readonly name: string;
  readonly githubUsername: string;
  readonly role: CollaboratorRole;
}

export const PRIMARY_AUTHOR: Collaborator = {
  name: 'Jorge Correa',
  githubUsername: 'kreodevs',
  role: 'primary',
};

export const SPECIAL_CONTRIBUTORS: readonly Collaborator[] = [
  {
    name: 'Maria Gregoria Ayala Calderon',
    githubUsername: 'MariaGregoria',
    role: 'contributor',
  },
  {
    name: 'Gerardo Olaf Ruvalcaba Aguirre',
    githubUsername: 'OlafRuv',
    role: 'contributor',
  },
  {
    name: 'Ricardo Mundo',
    githubUsername: 'rikimundo-dev',
    role: 'contributor',
  },
  {
    name: 'Luis Octavio Lara',
    githubUsername: 'luislara-dev',
    role: 'contributor',
  },
  {
    name: 'Oscar Rubio Sevilla',
    githubUsername: 'OscarRubioSevilla',
    role: 'contributor',
  },
  {
    name: 'Zeferino Martínez García',
    githubUsername: 'zefedev',
    role: 'contributor',
  },
  {
    name: 'André Martin García López',
    githubUsername: 'andremartingarcialopez',
    role: 'contributor',
  },
  {
    name: 'René Darío Carrillo Urquieta',
    githubUsername: 'rexdariodeveloper',
    role: 'contributor',
  },
  {
    name: 'Israel Alejandro Loera Pérez',
    githubUsername: 'IsraelAlejandro23',
    role: 'contributor',
  },
];

export const REPOSITORY_URL = 'https://github.com/kreodevs/ariadne';

export const APACHE_LICENSE_URL = 'https://www.apache.org/licenses/LICENSE-2.0';

export function getGithubAvatarUrl(username: string, size = 64): string {
  return `https://github.com/${username}.png?size=${String(size)}`;
}
