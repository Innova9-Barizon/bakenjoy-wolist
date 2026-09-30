import React, { useState, useEffect } from 'react';

const setCookie = (name, value, minutes = 30) => { const expires = new Date(Date.now() + minutes * 60 * 1000).toUTCString(); document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`; };
const getCookie = (name) => { const value = `; ${document.cookie}`; const parts = value.split(`; ${name}=`); if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift()); return null; };
const deleteCookie = (name) => { document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`; };
const LOGO_URL = 'https://chatjdevibe.innova9.io/vibe/images/Logo_thin.png';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const trimDisplay = (v) => String(v ?? '').trim();
const displayOrDash = (v) => trimDisplay(v) || '—';
const parseAisError = (data, fallback) => {
  if (!data) return fallback;
  if (typeof data === 'string' && data.trim()) return data.trim();
  const msg = data.jde__simpleMessage || data.message || data.exception || data.error;
  if (typeof msg === 'string' && msg.trim()) return msg.trim();
  return fallback;
};

export default function BakeNJoyWOList() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState('DV');
  const [assignedTo, setAssignedTo] = useState('');
  const [woStatus, setWoStatus] = useState('');
  const [workOrders, setWorkOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [message, setMessage] = useState(null);
  const [startConfirm, setStartConfirm] = useState(null);

  const ENVIRONMENTS = {
    DV: { label: 'DV', description: 'Development', aisBaseUrl: 'https://studio.chatjde.ai/jderest/v2', orchBaseUrl: 'https://studio.chatjde.ai/jderest/v3/orchestrator', jdeEnv: 'JDV920', color: '#2563eb' },
    PD: { label: 'PD', description: 'Production', aisBaseUrl: 'http://10.9.4.139:8002/jderest/v2', orchBaseUrl: 'http://10.9.4.139:8002/jderest/v3/orchestrator', jdeEnv: 'JPD920', color: '#dc2626' },
  };
  const envConfig = ENVIRONMENTS[selectedEnv];
  const TK = 'jde_bnjwolist_token'; const UK = 'jde_bnjwolist_username'; const EK = 'jde_bnjwolist_env';
  const clearSession = (msg) => { setIsLoggedIn(false); setToken(null); deleteCookie(TK); deleteCookie(UK); if (msg) setSessionExpiredMessage(msg); };
  const refreshCookieTTL = (t, u) => { setCookie(TK, t, 30); setCookie(UK, u, 30); setCookie(EK, selectedEnv, 30); };
  const handleApiError = (r) => { if ([444,401,403].includes(r.status)) { clearSession('Your session has expired. Please sign in again.'); return true; } return false; };

  useEffect(() => { document.title = 'Bake n Joy — My Work Orders'; }, []);
  useEffect(() => {
    const t = getCookie(TK); const u = getCookie(UK); const e = getCookie(EK);
    if (e && ENVIRONMENTS[e]) setSelectedEnv(e);
    if (t && u) { setToken(t); setUsername(u); setIsLoggedIn(true); }
    setValidatingToken(false);
  }, []);

  const orchFetch = async (name, body, overrideToken) => {
    const active = overrideToken || token;
    const response = await fetch(`${envConfig.orchBaseUrl}/${name}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'jde-AIS-Auth': active },
      body: JSON.stringify({ deviceName: 'ChatJDE', ...body }),
    });
    if (!response.ok) { if (handleApiError(response)) return null; const d = await response.json().catch(() => null); throw new Error(parseAisError(d, `Failed (${response.status})`)); }
    const data = await response.json(); refreshCookieTTL(active, username); return data;
  };

  const loadList = async (overrideToken) => {
    setLoading(true); setError(null);
    try {
      const body = {};
      if (trimDisplay(assignedTo)) body.assignedTo = trimDisplay(assignedTo);
      if (trimDisplay(woStatus)) body.woStatus = trimDisplay(woStatus);
      const data = await orchFetch('listMyMaintenanceWOs', body, overrideToken);
      if (!data) return;
      const rows = Array.isArray(data.workOrders) ? data.workOrders : [];
      setWorkOrders(rows);
      setMessage(`${rows.length} work order(s)`);
    } catch (err) { setError(err.message); setWorkOrders([]); }
    finally { setLoading(false); }
  };

  const openDetail = async (wo) => {
    setSelected(wo); setLoading(true); setError(null);
    try {
      const data = await orchFetch('getMaintenanceWODetail', { woNumber: String(wo.orderNumber ?? '') });
      if (!data) return;
      setDetail(data);
    } catch (err) { setError(err.message); setDetail(null); }
    finally { setLoading(false); }
  };

  const startWO = async () => {
    if (!startConfirm) return;
    const wo = startConfirm; setStartConfirm(null); setLoading(true); setError(null);
    try {
      await orchFetch('startMaintenanceWO', { woNumber: String(wo.orderNumber ?? ''), remark: 'Bake n Joy field start' });
      setMessage(`Started WO ${wo.orderNumber} → MH`);
      await loadList();
      await openDetail(wo);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault(); if (loginLoading) return;
    setLoginLoading(true); setError(null); setSessionExpiredMessage(null);
    try {
      const response = await fetch(`${envConfig.aisBaseUrl}/tokenrequest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceName: 'ChatJDE', username, environment: envConfig.jdeEnv, password }) });
      if (!response.ok) throw new Error('Invalid credentials. Please try again.');
      const data = await response.json();
      const newToken = data.userInfo?.token || data.token || null;
      if (!newToken) throw new Error('Authentication failed. No token received.');
      setCookie(TK, newToken, 30); setCookie(UK, username, 30); setCookie(EK, selectedEnv, 30);
      setToken(newToken); setIsLoggedIn(true);
      await loadList(newToken);
    } catch (err) { setError(err.message || 'Login failed.'); }
    finally { setLoginLoading(false); }
  };
  const handleLogout = async () => {
    if (token) { try { await fetch(`${envConfig.aisBaseUrl}/tokenrequest/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }); } catch {} }
    clearSession(); setUsername(''); setPassword('');
  };

  const inputStyle = { padding: '12px 16px', fontSize: 16, color: '#111827', border: '1px solid #d1d5db', borderRadius: 8, width: '100%', boxSizing: 'border-box' };
  const labelStyle = { fontSize: 14, fontWeight: 500, color: '#1f2937', marginBottom: 6, display: 'block' };
  const header = detail?.header;
  const headerRow = Array.isArray(header) ? header[0] : header;

  if (validatingToken) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>Loading…</div>;
  if (!isLoggedIn) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#1e3a8a,#3b82f6,#60a5fa)', padding: 20, fontFamily: FONT }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: '100%', maxWidth: 420, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <img src={LOGO_URL} alt="Innova9" style={{ display: 'block', height: 56, margin: '0 auto 12px', objectFit: 'contain' }} />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>Bake n Joy — My Work Orders</h1>
            <p style={{ margin: 0, color: '#4b5563', fontSize: 14 }}>JD Edwards EnterpriseOne</p>
            <span style={{ display: 'inline-block', marginTop: 10, padding: '4px 10px', borderRadius: 20, background: '#f5f3ff', color: '#7c3aed', fontSize: 12, fontWeight: 600 }}>listMyMaintenanceWOs</span>
          </div>
          {sessionExpiredMessage && <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8, color: '#92400e', marginBottom: 12 }}>{sessionExpiredMessage}</div>}
          {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', marginBottom: 12 }}>{error}</div>}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {Object.entries(ENVIRONMENTS).map(([key, env]) => (
                <button key={key} type="button" onClick={() => { setSelectedEnv(key); setCookie(EK, key, 43200); }}
                  style={{ flex: 1, padding: 12, borderRadius: 8, border: `2px solid ${selectedEnv === key ? env.color : '#e5e7eb'}`, background: selectedEnv === key ? `${env.color}10` : '#fff', cursor: 'pointer', fontWeight: 700, color: selectedEnv === key ? env.color : '#1f2937' }}>{env.label}</button>
              ))}
            </div>
            <div><label style={labelStyle}>Username</label><input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} required /></div>
            <div><label style={labelStyle}>Password</label><input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            <button type="submit" disabled={loginLoading} style={{ padding: 14, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>{loginLoading ? 'Signing in…' : 'Sign In'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: FONT }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <img src={LOGO_URL} alt="Innova9" style={{ height: 32 }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Bake n Joy — My Work Orders</h1>
          <span style={{ background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>{workOrders.length}</span>
          <a href="https://chatjdevibe.innova9.io/bakenjoy-home" style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>← Home</a>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13 }}>{username}</span>
          <button type="button" onClick={() => handleLogout()} style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Logout</button>
        </div>
      </header>
      {error && <div style={{ padding: 12, background: '#fef2f2', color: '#dc2626' }}>{error}</div>}
      {message && !error && <div style={{ padding: 12, background: '#f0fdf4', color: '#15803d' }}>{message}</div>}
      <main style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 140px' }}><label style={labelStyle}>Assigned to (AN8)</label><input style={inputStyle} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="optional" /></div>
            <div style={{ flex: '1 1 100px' }}><label style={labelStyle}>Status</label><input style={inputStyle} value={woStatus} onChange={(e) => setWoStatus(e.target.value)} placeholder="10 / MH" /></div>
            <button type="button" disabled={loading} onClick={() => loadList()} style={{ padding: '10px 18px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>{loading ? 'Loading…' : 'Refresh'}</button>
            <button type="button" onClick={() => { setWoStatus('10'); }} style={{ padding: '10px 18px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Status 10</button>
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Orchs: listMyMaintenanceWOs · getMaintenanceWODetail · startMaintenanceWO (reuse)</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1.2fr)', gap: 16 }}>
          <div>
            {workOrders.length === 0 ? <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 40, textAlign: 'center', color: '#9ca3af' }}>No work orders.</div> : workOrders.map((wo, idx) => (
              <div key={idx} onClick={() => openDetail(wo)} style={{ background: selected?.orderNumber === wo.orderNumber ? '#f5f3ff' : '#fff', border: selected?.orderNumber === wo.orderNumber ? '2px solid #7c3aed' : '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 10, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong style={{ color: '#111827' }}>WO {displayOrDash(wo.orderNumber)}</strong>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: '#eff6ff', color: '#2563eb' }}>{displayOrDash(wo.woStatus)}</span>
                </div>
                <div style={{ fontSize: 13, color: '#4b5563', marginTop: 4 }}>{displayOrDash(wo.problem || wo.equipmentNumberDescription)}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Equip {displayOrDash(wo.equipmentNumber)} · Branch {displayOrDash(wo.branch)} · ANP {displayOrDash(wo.assignedTo)}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
            {!selected ? <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Select a work order.</div> : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>WO {selected.orderNumber}</h2>
                  {String(selected.woStatus || headerRow?.woStatus || '').trim() === '10' && (
                    <button type="button" onClick={() => setStartConfirm(selected)} style={{ padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>Start → MH</button>
                  )}
                </div>
                {headerRow && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
                    {[
                      ['Status', headerRow.woStatus], ['Type', headerRow.woType], ['Equip', headerRow.equipmentNumber],
                      ['Branch', headerRow.branchPlant], ['Assigned', headerRow.assignedTo], ['Est hrs', headerRow.estimatedHours],
                      ['Actual hrs', headerRow.actualHours], ['Desc', headerRow.description],
                    ].map(([lab, val]) => (
                      <div key={lab}><div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{lab}</div><div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{displayOrDash(val)}</div></div>
                    ))}
                  </div>
                )}
                <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>Parts ({Array.isArray(detail?.parts) ? detail.parts.length : 0})</h3>
                <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 12 }}>{(detail?.parts || []).slice(0, 5).map((p, i) => <div key={i}>{displayOrDash(p.description)} · qty {displayOrDash(p.qtyOrdered)}</div>)}</div>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>Labor ({Array.isArray(detail?.labor) ? detail.labor.length : 0})</h3>
                <div style={{ fontSize: 12, color: '#4b5563' }}>{(detail?.labor || []).slice(0, 5).map((p, i) => <div key={i}>{displayOrDash(p.description)} · {displayOrDash(p.workCenter)}</div>)}</div>
              </>
            )}
          </div>
        </div>
      </main>
      {startConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 420, width: '100%', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 8px' }}>Start WO {startConfirm.orderNumber}?</h3>
            <p style={{ fontSize: 14, color: '#1f2937' }}>Calls <strong>startMaintenanceWO</strong> → status <strong>MH</strong>.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button type="button" onClick={() => setStartConfirm(null)} style={{ padding: '10px 24px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={() => startWO()} style={{ padding: '10px 24px', border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer' }}>Start</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
