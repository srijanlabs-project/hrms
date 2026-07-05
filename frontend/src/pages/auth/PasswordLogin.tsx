import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { ApiError } from '../../lib/apiClient';

export function PasswordLogin() {
  const { loginWithPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginWithPassword(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-lg shadow p-6">
        <h1 className="text-xl font-semibold mb-1">Admin / Finance Login</h1>
        <p className="text-sm text-gray-500 mb-4">Sign in with your email and password</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={loading} className="w-full bg-brand-600 text-white rounded py-2 text-sm font-medium disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-4 text-center">
          Employee/Manager? <Link to="/login" className="underline">Sign in with OTP</Link>
        </p>
      </div>
    </div>
  );
}
