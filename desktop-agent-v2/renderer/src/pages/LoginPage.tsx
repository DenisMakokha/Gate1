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
      setMsg(e?.message ?? 'Login failed');
      await api?.ui?.toast?.({ kind: 'error', title: 'Login failed', message: e?.message ?? 'unknown' });
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
      <div className="card">
        <div className="cardHeader">
          <strong>Sign in</strong>
          <span className="muted">required</span>
        </div>

        <div className="muted" style={{ marginTop: 6 }}>
          This agent needs a quick sign-in before it can connect to a live event session.
        </div>

        {step === 'login' ? (
          <>
            <div className="sectionTitle" style={{ marginTop: 16 }}>Account</div>
            <div className="row" style={{ marginTop: 8 }}>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={{ minWidth: 240, flex: 1 }} />
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" style={{ minWidth: 200, flex: 1 }} />
            </div>
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <button className="btn" onClick={doLogin} disabled={busy || !api?.auth?.login}>Sign in</button>
              {msg ? <span className="muted">{msg}</span> : null}
            </div>
          </>
        ) : null}

        {step === 'register' ? (
          <>
            <div className="sectionTitle" style={{ marginTop: 16 }}>Editor profile</div>
            <div className="muted">This labels backups and sessions for the event team.</div>
            <div className="row" style={{ marginTop: 8 }}>
              <input value={editorName} onChange={(e) => setEditorName(e.target.value)} placeholder="Editor name" style={{ minWidth: 240, flex: 1 }} />
              <input value={groupCode} onChange={(e) => setGroupCode(e.target.value)} placeholder="Group code (optional)" style={{ minWidth: 200, flex: 1 }} />
            </div>
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <button className="btn" onClick={doRegister} disabled={busy || !api?.agent?.register}>Continue</button>
              <button className="btn" onClick={logout} disabled={busy || !api?.auth?.logout}>Sign out</button>
              {msg ? <span className="muted">{msg}</span> : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
