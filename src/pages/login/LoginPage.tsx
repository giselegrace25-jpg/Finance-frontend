import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const refFromUrl = new URLSearchParams(window.location.search).get('ref') ?? '';
  const [mode, setMode] = useState<'login' | 'register'>(refFromUrl ? 'register' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [ref, setRef] = useState(refFromUrl);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, phone, password, ref || undefined);
      navigate('/app');
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Une erreur est survenue.');
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.page}>
      <div className="aurora"><span /><span /><span /></div>
      <div className="grain" />
      <div className={styles.card}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontFamily: 'Sora', fontWeight: 800, fontSize: 22, color: 'var(--text-hi)' }}>BetTrend</div>
          <div style={{ fontSize: 12, color: 'var(--text-low)', marginTop: 4 }}>Investissez, gagnez, retirez</div>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`} onClick={() => setMode('login')}>Connexion</button>
          <button className={`${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`} onClick={() => setMode('register')}>Inscription</button>
        </div>

        <form onSubmit={submit} className={styles.form}>
          {mode === 'register' && (
            <input className={styles.input} placeholder="Nom complet" value={name} onChange={e => setName(e.target.value)} required />
          )}
          <input className={styles.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          {mode === 'register' && (
            <input className={styles.input} type="tel" placeholder="Telephone (+237...)" value={phone} onChange={e => setPhone(e.target.value)} required />
          )}
          <input className={styles.input} type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required />
          {mode === 'register' && (
            <input className={styles.input} placeholder="Code parrainage (optionnel)" value={ref} onChange={e => setRef(e.target.value)} />
          )}
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
          </button>
        </form>
      </div>
    </div>
  );
}
