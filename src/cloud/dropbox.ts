// Cliente mínimo de Dropbox para una PWA: OAuth con PKCE (sin secreto del cliente).
// PKCE + token_access_type=offline da un refresh token que no caduca, así que no hace falta
// volver a iniciar sesión cada hora. Solo se usa la carpeta de la app (App folder).

const APP_KEY = 'wojw716so0r2899'; // público: va en el código
// Debe coincidir exactamente con un Redirect URI registrado en Dropbox App Console.
const REDIRECT_URI = `${location.origin}${import.meta.env.BASE_URL}`;
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const REFRESH_KEY = 'gym-tracker-dropbox-refresh';
const VERIFIER_KEY = 'gym-tracker-dropbox-verifier';
const BACKUP_PATH = '/gym-tracker.json'; // una sola copia; Dropbox guarda el historial de versiones

const enc = new TextEncoder();
const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const isConnected = () => localStorage.getItem(REFRESH_KEY) !== null;

// Paso 1: manda al usuario a Dropbox. Vuelve a la app con ?code=...
export async function connect(): Promise<void> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  localStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(verifier))));
  const url = new URL('https://www.dropbox.com/oauth2/authorize');
  url.search = new URLSearchParams({
    client_id: APP_KEY,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    token_access_type: 'offline',
    redirect_uri: REDIRECT_URI,
  }).toString();
  location.href = url.toString();
}

// Paso 2: al volver con ?code=..., cambia el código por el refresh token. Devuelve true si conectó.
export async function finishConnect(): Promise<boolean> {
  const code = new URL(location.href).searchParams.get('code');
  if (!code) return false;
  const verifier = localStorage.getItem(VERIFIER_KEY);
  history.replaceState(null, '', REDIRECT_URI); // quita el código de la barra de direcciones
  if (!verifier) throw new Error('No se pudo terminar la conexión con Dropbox. Intenta de nuevo.');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      code_verifier: verifier,
      client_id: APP_KEY,
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!res.ok) throw new Error('Dropbox rechazó la conexión. Intenta de nuevo.');
  const { refresh_token } = await res.json();
  localStorage.setItem(REFRESH_KEY, refresh_token);
  localStorage.removeItem(VERIFIER_KEY);
  return true;
}

export function disconnect(): void {
  localStorage.removeItem(REFRESH_KEY);
}

// Access token de vida corta, cacheado en memoria. Se renueva con el refresh token.
let cached: { token: string; expiresAt: number } | undefined;
async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) throw new Error('Dropbox no está conectado.');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: APP_KEY }),
  });
  if (res.status === 400 || res.status === 401) {
    disconnect(); // el permiso fue revocado en Dropbox
    throw new Error('La conexión con Dropbox caducó. Vuelve a conectarla en Ajustes.');
  }
  if (!res.ok) throw new Error('No se pudo contactar a Dropbox.');
  const { access_token, expires_in } = await res.json();
  cached = { token: access_token, expiresAt: Date.now() + expires_in * 1000 };
  return access_token;
}

export async function uploadBackupFile(content: string): Promise<void> {
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Dropbox-API-Arg': JSON.stringify({ path: BACKUP_PATH, mode: 'overwrite', mute: true }),
      'Content-Type': 'application/octet-stream',
    },
    body: content,
  });
  if (!res.ok) throw new Error('No se pudo subir la copia a Dropbox.');
}

export async function downloadBackupFile(): Promise<string> {
  const res = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Dropbox-API-Arg': JSON.stringify({ path: BACKUP_PATH }),
    },
  });
  if (res.status === 409) throw new Error('Todavía no hay una copia en Dropbox.');
  if (!res.ok) throw new Error('No se pudo descargar la copia de Dropbox.');
  return res.text();
}
