// No Firebase auth; JWT token is stored in localStorage

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  let token = localStorage.getItem('jwt') || '';
  // If token exists, set Authorization header
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }


  // Si c'est du JSON et pas spécifié, on ajoute l'entête
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  return response;
};
