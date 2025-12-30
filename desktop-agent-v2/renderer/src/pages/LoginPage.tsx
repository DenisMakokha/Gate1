import React, { useEffect, useState } from 'react';

type Props = {
  coreStatus: any;
  onDone: () => void;
};

export function LoginPage(props: Props) {
  const api = window.gate1;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [editorName, setEditorName] = useState('');
  const [groupCode, setGroupCode] = useState('');

  const [step, setStep] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');

  useEffect(() => {
    const hasToken = !!props.coreStatus?.hasToken && props.coreStatus?.tokenExpired === false;
    const hasAgent = !!props.coreStatus?.agentId;
    if (hasToken && !hasAgent) setStep('register');
    if (!hasToken) setStep('login');
  }, [props.coreStatus?.hasToken, props.coreStatus?.tokenExpired, props.coreStatus?.agentId]);

  const doLogin = async () => {
    if (!api?.auth?.login) return;
    if (!email.trim() || !password.trim()) {
      await api?.ui?.toast?.({ kind: 'warning', title: 'Missing details', message: 'Enter email and password.' });
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await api.auth.login({ email: email.trim(), password });
      await api?.ui?.toast?.({ kind: 'success', title: 'Signed in' });
      setStep('register');
      props.onDone();
    } catch (e: any) {
      // Extract validation error message from Axios 422 response
      const errMsg = e?.response?.data?.message 
        || e?.response?.data?.errors?.email?.[0]
        || e?.message 
        || 'Login failed';
      setMsg(errMsg);
      await api?.ui?.toast?.({ kind: 'error', title: 'Login failed', message: errMsg });
    } finally {
      setBusy(false);
    }
  };

  const doRegister = async () => {
    if (!api?.agent?.register) return;
    if (!editorName.trim()) {
      await api?.ui?.toast?.({ kind: 'warning', title: 'Missing name', message: 'Enter editor name.' });
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await api.agent.register({ editorName: editorName.trim(), groupCode: groupCode.trim() || undefined });
      if (res?.status === 'queued_offline') {
        await api?.ui?.toast?.({ kind: 'warning', title: 'Saved offline', message: 'Will register when internet returns.' });
      } else {
        await api?.ui?.toast?.({ kind: 'success', title: 'Agent registered' });
      }
      props.onDone();
    } catch (e: any) {
      setMsg(e?.message ?? 'Registration failed');
      await api?.ui?.toast?.({ kind: 'error', title: 'Registration failed', message: e?.message ?? 'unknown' });
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    try {
      await api?.auth?.logout?.();
      props.onDone();
    } catch {
      // ignore
    }
  };

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
        <div className="cardHeader">
          <strong>{step === 'login' ? 'Sign In' : 'Setup Profile'}</strong>
          <span className="pill pillBlue">Required</span>
        </div>

        <div className="muted">
          {step === 'login' 
            ? 'Sign in to connect this agent to your live event sessions.'
            : 'Set up your editor profile to label backups and sessions.'}
        </div>

        {step === 'login' ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
              <input 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="Email address" 
                type="email"
                autoComplete="email"
              />
              <input 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Password" 
                type="password"
                autoComplete="current-password"
              />
            </div>
            {msg && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{msg}</div>}
            <div style={{ marginTop: 20 }}>
              <button 
                className="btn btnPrimary" 
                onClick={doLogin} 
                disabled={busy || !api?.auth?.login}
                style={{ width: '100%', padding: '12px 16px' }}
              >
                {busy ? 'Signing in…' : 'Sign In'}
              </button>
            </div>
          </>
        ) : null}

        {step === 'register' ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
              <input 
                value={editorName} 
                onChange={(e) => setEditorName(e.target.value)} 
                placeholder="Your name (e.g. John Smith)" 
              />
              <input 
                value={groupCode} 
                onChange={(e) => setGroupCode(e.target.value)} 
                placeholder="Group code (optional)" 
              />
            </div>
            {msg && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button 
                className="btn btnPrimary" 
                onClick={doRegister} 
                disabled={busy || !api?.agent?.register}
                style={{ flex: 1, padding: '12px 16px' }}
              >
                {busy ? 'Setting up…' : 'Continue'}
              </button>
              <button 
                className="btn" 
                onClick={logout} 
                disabled={busy || !api?.auth?.logout}
              >
                Sign Out
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
