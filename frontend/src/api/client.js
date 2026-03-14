const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api';

export const apiClient = {
  async request(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    // Add timeout for requests (default 60 seconds, 120 for stats endpoint)
    const timeout = path.includes('/stats') ? 120000 : 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errorData;
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            errorData = await res.json();
          } catch {
            errorData = { message: 'Request failed' };
          }
        } else {
          const text = await res.text();
          errorData = { message: text || 'Request failed' };
        }

        // Handle 401 Unauthorized - token expired or invalid
        if (res.status === 401) {
          console.error('Authentication failed:', errorData.message);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }

        const error = new Error(errorData.message || 'Request failed');
        error.response = { data: errorData, status: res.status };
        throw error;
      }
      if (res.status === 204) return null;
      return res.json();
    } catch (err) {
      clearTimeout(timeoutId);

      // Handle timeout errors
      if (err.name === 'AbortError') {
        console.error('Request timeout:', path);
        const timeoutError = new Error('Request timed out. The server is taking too long to respond. Please try again.');
        timeoutError.response = { status: 408, data: { message: 'Request timeout' } };
        throw timeoutError;
      }

      // Handle network errors
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        console.error('Network error - backend server may not be running:', err);
        const networkError = new Error('Unable to connect to server. Please check if the backend server is running.');
        networkError.response = { status: 0, data: { message: 'Network error' } };
        throw networkError;
      }
      throw err;
    }
  },

  get(path) {
    return this.request(path, { method: 'GET' });
  },
  post(path, body) {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) });
  },
  put(path, body) {
    return this.request(path, { method: 'PUT', body: JSON.stringify(body) });
  },
  delete(path) {
    return this.request(path, { method: 'DELETE' });
  },
};


