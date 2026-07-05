import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { ApiError } from '../../lib/apiClient';

export function OtpLogin() {
  const { requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState<'mobile' | 'otp'>('mobile');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await requestOtp(mobileNumber);
      setDevOtp(res.devOtp ?? null);
      setStage('otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(mobileNumber, otp);
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
        <h1 className="text-xl font-semibold mb-1">HRMS Login</h1>
        <p className="text-sm text-gray-500 mb-4">Employee &amp; Manager sign-in via mobile OTP</p>

        {stage === 'mobile' && (
          <form onSubmit={handleRequestOtp} className="space-y-3">
            <input
              type="tel"
              placeholder="Mobile number"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={loading} className="w-full bg-brand-600 text-white rounded py-2 text-sm font-medium disabled:opacity-50">
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        )}

        {stage === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            {devOtp && <p className="text-xs text-amber-600">Dev OTP: {devOtp}</p>}
            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={loading} className="w-full bg-brand-600 text-white rounded py-2 text-sm font-medium disabled:opacity-50">
              {loading ? 'Verifying...' : 'Verify & Sign in'}
            </button>
            <button type="button" onClick={() => setStage('mobile')} className="w-full text-xs text-gray-500 underline">
              Use a different number
            </button>
          </form>
        )}

        <p className="text-xs text-gray-400 mt-4 text-center">
          Admin/Finance? <Link to="/login/password" className="underline">Sign in with email</Link>
        </p>
      </div>
    </div>
  );
}
