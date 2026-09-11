import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { adminApi, setAdminKey, clearAdminKey, adminAuthHeaders } from '../../api/admin';
import { API_BASE_URL, API_ORIGIN_URL } from '../../api/base';
import styles from './AdminPage.module.css';

type User = { id: number; name: string; email: string; phone: string; balance: number; referralCode: string; referredBy: number | null; banned?: boolean; createdAt: string };
type Tx = { id: number; userId: number; type: string; amount: number; description: string; createdAt: string; user?: { name: string } };
type Plan = { id: number; slug: string; platform: string; planType: string; amount: number; dailyRatePercent: number; dailyRevenue: number; monthlyRevenue: number; monthDays: number; daysToRecover: number; active: boolean };
type Dashboard = { users: number; plans: number; activePositions: number; txCount: number; pendingDeposits: number; totalDeposits: number; totalWithdrawn: number; totalYield: number; totalFees: number; totalReferral: number; poolCash: number };
type DepositReq = { id: number; userId: number; amount: number; proofUrl: string; status: string; adminNote: string | null; createdAt: string; user?: { name: string; email: string; phone: string } };
type WithdrawalReq = { id: number; userId: number; amount: number; netAmount: number; fee: number; accountNumber: string; accountName: string; status: string; adminNote: string | null; createdAt: string; user?: { name: string; phone: string } };
type Analytics = {
  flows: { daily: { deposits: number; withdrawals: number; net: number }; weekly: { deposits: number; withdrawals: number; net: number }; monthly: { deposits: number; withdrawals: number; net: number } };
  yields: { daily: number; weekly: number; monthly: number };
  platformRevenue: { withdrawalFees: { daily: number; weekly: number; monthly: number }; maintenanceFees: { daily: number; weekly: number; monthly: number }; total: { daily: number; weekly: number; monthly: number } };
  byPlatform: { platform: string; positions: number; totalInvested: number; totalEarned: number }[];
};
type Position = { id: number; userId: number; platform: string; planType: string; investedAmount: number; dailyRatePercent: number; totalEarned: number; active: boolean; user?: { name: string } };

const fmt = (n: number) => Number(n).toLocaleString('fr-FR');
const fmtDate = (d: string) => new Date(d).toLocaleString('fr-FR');

const TABS = [
  { id: 'dashboard',    label: 'Vue générale' },
  { id: 'analyses',     label: 'Courbes & tendances' },
  { id: 'deposits',     label: 'Valider les dépôts' },
  { id: 'withdrawals',  label: 'Retraits clients' },
  { id: 'users',        label: 'Gérer les clients' },
  { id: 'transactions', label: 'Historique finances' },
  { id: 'plans',        label: 'Offres investissement' },
  { id: 'positions',    label: 'Investissements actifs' },
  { id: 'referrals',    label: 'Réseau parrainage' },
  { id: 'settings',     label: 'Réglages' },
  { id: 'ai',           label: 'IA & Rapports PDF' },
];

// ─── Icônes SVG ──────────────────────────────────────────
function NavIcon({ id, className }: { id: string; className?: string }) {
  const icons: Record<string, ReactElement> = {
    dashboard: (
      <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1" width="7" height="7" rx="1.5" />
        <rect x="10" y="1" width="7" height="7" rx="1.5" />
        <rect x="1" y="10" width="7" height="7" rx="1.5" />
        <rect x="10" y="10" width="7" height="7" rx="1.5" />
      </svg>
    ),
    analyses: (
      <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="10" width="3" height="6" rx="1" fill="currentColor" stroke="none" />
        <rect x="6" y="6" width="3" height="10" rx="1" fill="currentColor" stroke="none" />
        <rect x="11" y="3" width="3" height="13" rx="1" fill="currentColor" stroke="none" />
        <line x1="2.5" y1="1" x2="2.5" y2="9" strokeOpacity="0.3" />
      </svg>
    ),
    deposits: (
      <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="9" y1="2" x2="9" y2="12" />
        <polyline points="5,8 9,12 13,8" />
        <line x1="2" y1="16" x2="16" y2="16" />
      </svg>
    ),
    users: (
      <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="6" r="3" />
        <path d="M1 16c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <path d="M13 4c1.7 0 3 1.3 3 3s-1.3 3-3 3" strokeOpacity="0.6" />
        <path d="M16 16c0-2.2-1.3-4-3-4.5" strokeOpacity="0.6" />
      </svg>
    ),
    transactions: (
      <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="2" y1="5" x2="16" y2="5" />
        <line x1="2" y1="9" x2="13" y2="9" />
        <line x1="2" y1="13" x2="10" y2="13" />
      </svg>
    ),
    plans: (
      <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2L15 6V12L9 16L3 12V6Z" />
        <path d="M9 6L13 8.5V12.5L9 15L5 12.5V8.5Z" opacity="0.4" fill="currentColor" stroke="none" />
      </svg>
    ),
    positions: (
      <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="9" r="7" />
        <polyline points="9,5 9,9 12,11" />
      </svg>
    ),
    referrals: (
      <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="5" r="2" />
        <circle cx="3" cy="14" r="2" />
        <circle cx="15" cy="14" r="2" />
        <line x1="9" y1="7" x2="3" y2="12" />
        <line x1="9" y1="7" x2="15" y2="12" />
      </svg>
    ),
    settings: (
      <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="9" r="2.5" />
        <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.2 3.2l1.4 1.4M13.4 13.4l1.4 1.4M3.2 14.8l1.4-1.4M13.4 4.6l1.4-1.4" />
      </svg>
    ),
    ai: (
      <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3a1 1 0 011-1h12a1 1 0 011 1v9a1 1 0 01-1 1H6l-4 3V3z" />
        <line x1="5" y1="7" x2="13" y2="7" />
        <line x1="5" y1="10" x2="10" y2="10" />
      </svg>
    ),
    withdrawals: (
      <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="9" y1="14" x2="9" y2="4" />
        <polyline points="5,8 9,4 13,8" />
        <line x1="2" y1="16" x2="16" y2="16" />
      </svg>
    ),
  };
  return icons[id] ?? <svg className={className} viewBox="0 0 18 18" />;
}

// ─── KPI component ────────────────────────────────────────
function KPI({ label, value, color, accent }: { label: string; value: string | number; color?: string; accent?: string }) {
  return (
    <div className={styles.kpiCard} style={{ '--kpi-accent': accent || color || 'transparent' } as React.CSSProperties}>
      <div className={styles.kpiVal} style={color ? { color } : {}}>{value}</div>
      <div className={styles.kpiLabel}>{label}</div>
    </div>
  );
}

function Spinner() {
  return <div className={styles.spinner}>Chargement...</div>;
}

// ─── Login ───────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (k: string) => void }) {
  const [email, setEmail] = useState('admin@bettrend.com');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const submit = async () => {
    setErr('');
    try {
      const res = await adminApi.login(email.trim(), password);
      if (!res.user?.isAdmin) {
        setErr('Ce compte n est pas administrateur.');
        return;
      }
      setAdminKey(res.token);
      onLogin(res.token);
    }
    catch { setErr('Email ou mot de passe incorrect.'); }
  };
  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginCard}>
        <div className={styles.loginLogo}>BT</div>
        <h1 className={styles.loginTitle}>Back Office BetTrend</h1>
        <p className={styles.loginSub}>Acces administrateur uniquement</p>
        <input className={styles.input} type="email" placeholder="Email admin" value={email}
          onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />
        <input className={styles.input} type="password" placeholder="Mot de passe" value={password}
          onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
        {err && <div className={styles.errMsg}>{err}</div>}
        <button className={styles.btn} onClick={submit}>Connexion</button>
      </div>
    </div>
  );
}

// ─── AdminPage ───────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('admin_token'));
  const [tab, setTab] = useState('dashboard');
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState<DepositReq[]>([]);
  const [allDeposits, setAllDeposits] = useState<DepositReq[]>([]);
  const [allWithdrawals, setAllWithdrawals] = useState<WithdrawalReq[]>([]);
  const [positionsList, setPositionsList] = useState<Position[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ user: User; transactions: Tx[]; positions: any[]; deposits: DepositReq[] } | null>(null);
  const [toast, setToast] = useState('');
  const [adjustModal, setAdjustModal] = useState<{ user: User } | null>(null);
  const [adjAmt, setAdjAmt] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [planModal, setPlanModal] = useState<'create' | 'edit' | null>(null);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState({ slug: '', platform: '1XBET', planType: 'Simple', amount: '', dailyRatePercent: '', monthDays: '30' });
  const [proofModal, setProofModal] = useState<DepositReq | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [advAnalytics, setAdvAnalytics] = useState<any>(null);
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});
  const [referrals, setReferrals] = useState<any[]>([]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async (t: string) => {
    try {
      if (t === 'dashboard') { setDash(await adminApi.dashboard()); setAnalytics(await adminApi.analytics()); }
      else if (t === 'analyses') { setAdvAnalytics(await adminApi.advancedAnalytics()); }
      else if (t === 'deposits') { setPendingDeposits(await adminApi.pendingDeposits()); setAllDeposits(await adminApi.deposits()); }
      else if (t === 'withdrawals') setAllWithdrawals(await adminApi.withdrawals());
      else if (t === 'users') setUsers(await adminApi.users());
      else if (t === 'transactions') setTxs(await adminApi.transactions(200));
      else if (t === 'plans') setPlans(await adminApi.plans());
      else if (t === 'positions') setPositionsList(await adminApi.positions(true));
      else if (t === 'settings') { const s = await adminApi.getSettings(); setSettings(s); setSettingsForm(s); }
      else if (t === 'referrals') setReferrals(await adminApi.referrals());
    } catch { showToast('Erreur de chargement'); }
  }, []);

  useEffect(() => { if (authed) load(tab); }, [authed, tab, load]);

  if (!authed) return <LoginScreen onLogin={k => { setAdminKey(k); setAuthed(true); }} />;

  const uploadsBase = API_ORIGIN_URL;

  // ─── TAB: DASHBOARD ──────────────────────────────────────
  const TabDashboard = () => {
    if (!dash) return <Spinner />;
    const margin = dash.totalFees - dash.totalYield - dash.totalReferral;

    return (
      <div>
        {dash.pendingDeposits > 0 && (
          <div className={`${styles.alertBanner} ${styles.alertOrange}`}>
            {dash.pendingDeposits} dépôt(s) en attente de validation
          </div>
        )}

        {/* Ligne 1 : activité */}
        <div className={styles.kpiGrid6}>
          <KPI label="Utilisateurs" value={dash.users} />
          <KPI label="Positions actives" value={dash.activePositions} />
          <KPI label="Transactions" value={dash.txCount} />
          <KPI label="Déposé" value={`${fmt(dash.totalDeposits)} F`} color="var(--green-t)" accent="var(--green-t)" />
          <KPI label="Retiré" value={`${fmt(dash.totalWithdrawn)} F`} color="var(--red-t)" accent="var(--red-t)" />
          <KPI label="Caisse" value={`${fmt(dash.poolCash)} F`} color={dash.poolCash > 0 ? 'var(--green-t)' : 'var(--red-t)'} accent={dash.poolCash > 0 ? 'var(--green-t)' : 'var(--red-t)'} />
        </div>

        {/* Ligne 2 : P&L */}
        <div className={styles.kpiGrid} style={{ marginTop: 8 }}>
          <KPI label="Frais gagnés" value={`${fmt(dash.totalFees)} F`} color="var(--green-t)" accent="var(--green-t)" />
          <KPI label="Yields + parrainage" value={`${fmt(dash.totalYield + dash.totalReferral)} F`} color="var(--red-t)" accent="var(--red-t)" />
          <KPI label={margin >= 0 ? 'Bénéfice net' : 'Perte nette'} value={`${margin >= 0 ? '+' : ''}${fmt(margin)} F`} color={margin >= 0 ? 'var(--green-t)' : 'var(--red-t)'} accent={margin >= 0 ? 'var(--green-t)' : 'var(--red-t)'} />
        </div>

        {analytics && (
          <>
            <h3 className={styles.sectionTitle}>Flux par période</h3>
            <div style={{ display: 'grid', gridTemplateColumns: analytics.byPlatform.length > 0 ? '1fr 1fr' : '1fr', gap: 8 }}>
              <div className={styles.tableWrap} style={{ marginBottom: 0 }}>
                <table className={styles.table}>
                  <thead><tr><th>Période</th><th>Dépôts</th><th>Retraits</th><th>Yields</th><th>Frais</th><th>Marge</th></tr></thead>
                  <tbody>
                    {(['daily', 'weekly', 'monthly'] as const).map(p => {
                      const marge = analytics.platformRevenue.total[p] - analytics.yields[p];
                      return (
                        <tr key={p}>
                          <td className={styles.bold}>{p === 'daily' ? "Aujourd'hui" : p === 'weekly' ? '7j' : '30j'}</td>
                          <td className={`${styles.mono} ${styles.positive}`}>{fmt(analytics.flows[p].deposits)}</td>
                          <td className={`${styles.mono} ${styles.negative}`}>{fmt(analytics.flows[p].withdrawals)}</td>
                          <td className={`${styles.mono} ${styles.negative}`}>{fmt(analytics.yields[p])}</td>
                          <td className={`${styles.mono} ${styles.positive}`}>{fmt(analytics.platformRevenue.total[p])}</td>
                          <td className={`${styles.mono} ${marge >= 0 ? styles.positive : styles.negative}`}>{marge >= 0 ? '+' : ''}{fmt(marge)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {analytics.byPlatform.length > 0 && (
                <div className={styles.tableWrap} style={{ marginBottom: 0 }}>
                  <table className={styles.table}>
                    <thead><tr><th>Plateforme</th><th>Pos.</th><th>Capital</th><th>Yields</th></tr></thead>
                    <tbody>
                      {analytics.byPlatform.map(p => (
                        <tr key={p.platform}>
                          <td className={styles.bold}>{p.platform}</td>
                          <td className={styles.mono}>{p.positions}</td>
                          <td className={styles.mono}>{fmt(p.totalInvested)}</td>
                          <td className={`${styles.mono} ${styles.negative}`}>{fmt(p.totalEarned)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  // ─── TAB: ANALYSES ───────────────────────────────────────
  const TabAnalyses = () => {
    if (!advAnalytics) return <Spinner />;
    const a = advAnalytics;
    const runway = a.riskMetrics.runwayDays;
    const runwayColor = runway === Infinity ? 'var(--green-t)' : runway > 30 ? 'var(--green-t)' : runway > 7 ? 'var(--orange-t)' : 'var(--red-t)';

    return (
      <div>
        {runway !== Infinity && runway <= 7 && (
          <div className={`${styles.alertBanner} ${styles.alertRed}`}>
            Caisse critique : {runway} jour(s) de yields restants.
          </div>
        )}
        {runway !== Infinity && runway > 7 && runway <= 30 && (
          <div className={`${styles.alertBanner} ${styles.alertOrange}`}>
            Caisse : {runway} jours d'autonomie.
          </div>
        )}

        {/* KPIs condensés sur 2 lignes */}
        <div className={styles.kpiGrid6}>
          <KPI label="Yields/jour" value={`${fmt(a.riskMetrics.dailyObligations)} F`} color="var(--orange-t)" accent="var(--orange-t)" />
          <KPI label="Yields/mois" value={`${fmt(a.riskMetrics.monthlyObligations)} F`} color="var(--orange-t)" accent="var(--orange-t)" />
          <KPI label="Autonomie" value={runway === Infinity ? 'Illimitée' : `${runway}j`} color={runwayColor} accent={runwayColor} />
          <KPI label="Conversion" value={`${a.conversionRate.percent}%`} color={a.conversionRate.percent > 30 ? 'var(--green-t)' : 'var(--orange-t)'} accent={a.conversionRate.percent > 30 ? 'var(--green-t)' : 'var(--orange-t)'} />
          <KPI label="Dépôts approuvés" value={a.depositValidation.approved} color="var(--green-t)" accent="var(--green-t)" />
          <KPI label="Délai validation" value={a.depositValidation.avgValidationMinutes != null ? `${a.depositValidation.avgValidationMinutes} min` : '—'} />
        </div>

        {/* 4 charts en grille 2×2 */}
        <h3 className={styles.sectionTitle}>Tendances 30 jours</h3>
        <div className={styles.chartsGrid}>
          <div className={styles.chartWrap}>
            <div className={styles.chartTitle}>Inscriptions</div>
            <div className={styles.chartBar}>
              {a.userGrowth.map((d: any) => {
                const max = Math.max(...a.userGrowth.map((x: any) => x.count), 1);
                return (
                  <div key={d.date} className={styles.barCol} title={`${d.date}: ${d.count}`}>
                    <div className={styles.bar} style={{ height: `${Math.max(3, d.count / max * 80)}px`, background: '#a5b4fc' }} />
                    <div className={styles.barLabel}>{d.date.slice(8)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.chartWrap}>
            <div className={styles.chartTitle}>Dépôts</div>
            <div className={styles.chartBar}>
              {a.depositTrend.map((d: any) => {
                const max = Math.max(...a.depositTrend.map((x: any) => x.total), 1);
                return (
                  <div key={d.date} className={styles.barCol} title={`${d.date}: ${fmt(d.total)} F`}>
                    <div className={styles.bar} style={{ height: `${Math.max(3, d.total / max * 80)}px`, background: 'var(--green-t)' }} />
                    <div className={styles.barLabel}>{d.date.slice(8)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.chartWrap}>
            <div className={styles.chartTitle}>Retraits</div>
            <div className={styles.chartBar}>
              {a.withdrawTrend.map((d: any) => {
                const max = Math.max(...a.withdrawTrend.map((x: any) => x.total), 1);
                return (
                  <div key={d.date} className={styles.barCol} title={`${d.date}: ${fmt(d.total)} F`}>
                    <div className={styles.bar} style={{ height: `${Math.max(3, d.total / max * 80)}px`, background: 'var(--red-t)' }} />
                    <div className={styles.barLabel}>{d.date.slice(8)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {a.revenueTrend && (
          <div className={styles.chartWrap}>
            <div className={styles.chartTitle}>Gains plateforme</div>
            <div className={styles.chartBar}>
              {a.revenueTrend.map((d: any) => {
                const max = Math.max(...a.revenueTrend.map((x: any) => x.total), 1);
                return (
                  <div key={d.date} className={styles.barCol} title={`${d.date}: ${fmt(d.total)} F`}>
                    <div className={styles.bar} style={{ height: `${Math.max(3, d.total / max * 80)}px`, background: 'var(--gold-t)' }} />
                    <div className={styles.barLabel}>{d.date.slice(8)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>{/* end chartsGrid */}

        {/* Tables côte à côte */}
        <h3 className={styles.sectionTitle}>Classements</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {a.topReferrers.length > 0 && (
            <div className={styles.tableWrap}>
              <div className={styles.chartTitle} style={{ marginBottom: 6 }}>Meilleurs parrains</div>
              <table className={styles.table}>
                <thead><tr><th>#</th><th>Nom</th><th>Code</th><th>Filleuls</th></tr></thead>
                <tbody>
                  {a.topReferrers.map((r: any, i: number) => (
                    <tr key={r.id}>
                      <td className={styles.bold}>{i + 1}</td>
                      <td className={styles.bold}>{r.name}</td>
                      <td><span className={styles.badge}>{r.referralCode}</span></td>
                      <td className={styles.mono}>{r.filleuls}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {a.topInvestors.length > 0 && (
            <div className={styles.tableWrap}>
              <div className={styles.chartTitle} style={{ marginBottom: 6 }}>Plus gros investisseurs</div>
              <table className={styles.table}>
                <thead><tr><th>#</th><th>Nom</th><th>Capital</th><th>Yields</th></tr></thead>
                <tbody>
                  {a.topInvestors.map((r: any, i: number) => (
                    <tr key={r.userId}>
                      <td className={styles.bold}>{i + 1}</td>
                      <td className={styles.bold}>{r.name}</td>
                      <td className={styles.mono}>{fmt(r.totalInvested)} F</td>
                      <td className={`${styles.mono} ${styles.negative}`}>{fmt(r.totalEarned)} F</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {a.planPerformance.length > 0 && (
          <>
            <h3 className={styles.sectionTitle}>Performance des plans</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Plan</th><th>Plateforme</th><th>Souscriptions</th><th>Capital</th><th>Yields payés</th></tr></thead>
                <tbody>
                  {a.planPerformance.map((r: any) => (
                    <tr key={r.slug}>
                      <td className={styles.bold}>{r.slug}</td>
                      <td>{r.platform}</td>
                      <td className={styles.mono}>{r.totalPositions}</td>
                      <td className={styles.mono}>{fmt(r.totalInvested)} F</td>
                      <td className={`${styles.mono} ${styles.negative}`}>{fmt(r.totalYieldPaid)} F</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  };

  // ─── TAB: WITHDRAWALS ────────────────────────────────────
  const TabWithdrawals = () => {
    const pending = allWithdrawals.filter(w => w.status === 'pending');
    const processed = allWithdrawals.filter(w => w.status !== 'pending');
    return (
      <div>
        <p className={styles.dim} style={{ marginBottom: 16 }}>Liste des demandes de retrait clients. Pour chaque demande en attente, effectue manuellement le virement sur le numéro indiqué, puis clique sur "Valider". En cas de problème, tu peux rejeter — le solde sera remboursé automatiquement.</p>

        <h3 className={styles.sectionTitle}>En attente ({pending.length})</h3>
        {pending.length === 0 && <p className={styles.dim}>Aucune demande en attente.</p>}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Client</th><th>Numéro</th><th>Titulaire</th><th>Montant</th><th>Frais</th><th>Net</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {pending.map(w => (
                <tr key={w.id}>
                  <td className={styles.bold}>{w.user?.name ?? `#${w.userId}`}</td>
                  <td className={styles.mono}>{w.accountNumber}</td>
                  <td>{w.accountName}</td>
                  <td className={styles.mono}>{fmt(Number(w.amount))} F</td>
                  <td className={`${styles.mono} ${styles.negative}`}>{fmt(Number(w.fee))} F</td>
                  <td className={`${styles.mono} ${styles.positive}`}>{fmt(Number(w.netAmount))} F</td>
                  <td className={styles.dim}>{fmtDate(w.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className={styles.btnApprove} onClick={async () => {
                        if (!confirm(`Confirmer le virement de ${fmt(Number(w.netAmount))} F à ${w.accountName} (${w.accountNumber}) ?`)) return;
                        try { await adminApi.completeWithdrawal(w.id); showToast('Retrait validé'); load('withdrawals'); }
                        catch { showToast('Erreur'); }
                      }}>Valider</button>
                      <button className={styles.btnReject} onClick={async () => {
                        const note = prompt('Raison du rejet (optionnel) :') ?? '';
                        try { await adminApi.rejectWithdrawal(w.id, note); showToast('Retrait rejeté — solde remboursé'); load('withdrawals'); }
                        catch { showToast('Erreur'); }
                      }}>Rejeter</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className={styles.sectionTitle} style={{ marginTop: 24 }}>Historique</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Client</th><th>Numéro</th><th>Montant</th><th>Net</th><th>Statut</th><th>Note</th><th>Date</th></tr></thead>
            <tbody>
              {processed.map(w => (
                <tr key={w.id}>
                  <td className={styles.bold}>{w.user?.name ?? `#${w.userId}`}</td>
                  <td className={styles.mono}>{w.accountNumber}</td>
                  <td className={styles.mono}>{fmt(Number(w.amount))} F</td>
                  <td className={`${styles.mono} ${styles.positive}`}>{fmt(Number(w.netAmount))} F</td>
                  <td><span className={`${styles.badge} ${w.status === 'completed' ? styles.green : styles.red}`}>{w.status === 'completed' ? 'Validé' : 'Rejeté'}</span></td>
                  <td className={styles.dim}>{w.adminNote || '-'}</td>
                  <td className={styles.dim}>{fmtDate(w.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── TAB: DEPOSITS ───────────────────────────────────────
  const TabDeposits = () => (
    <div>
      <p className={styles.dim} style={{ marginBottom: 16 }}>Quand un client dépose de l'argent, il t'envoie une capture d'écran de son paiement. Tu vérifies la preuve ici et tu valides ou rejettes. Une fois validé, son compte est crédité automatiquement.</p>
      <h3 className={styles.sectionTitle}>En attente ({pendingDeposits.length})</h3>
      {pendingDeposits.length === 0 && <p className={styles.dim}>Aucun dépôt en attente.</p>}
      <div className={styles.depositGrid}>
        {pendingDeposits.map(d => (
          <div key={d.id} className={styles.depositCard}>
            <div className={styles.depositProofArea} onClick={() => setProofModal(d)}>
              <img src={`${uploadsBase}${d.proofUrl}`} alt="Preuve" />
              <div className={styles.depositProofOverlay} />
            </div>
            <div className={styles.depositBody}>
              <div className={styles.depositHeader}>
                <div>
                  <div className={styles.depositUser}>{d.user?.name ?? `#${d.userId}`}</div>
                  <div className={styles.depositPhone}>{d.user?.phone}</div>
                </div>
                <div className={styles.depositAmount}>{fmt(d.amount)} F</div>
              </div>
              <div className={styles.depositDate}>{fmtDate(d.createdAt)}</div>
              <div className={styles.depositActions}>
                <button className={styles.btnApprove} onClick={async () => {
                  try { await adminApi.approveDeposit(d.id); showToast('Dépôt approuvé'); load('deposits'); }
                  catch { showToast('Erreur'); }
                }}>Valider</button>
                <button className={styles.btnReject} onClick={() => { setProofModal(d); setRejectNote(''); }}>Rejeter</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h3 className={styles.sectionTitle}>Historique</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Utilisateur</th><th>Montant</th><th>Statut</th><th>Note</th><th>Date</th><th>Preuve</th></tr></thead>
          <tbody>
            {allDeposits.map(d => (
              <tr key={d.id}>
                <td className={styles.bold}>{d.user?.name ?? `#${d.userId}`}</td>
                <td className={styles.mono}>{fmt(d.amount)} F</td>
                <td><span className={`${styles.badge} ${d.status === 'approved' ? styles.green : d.status === 'rejected' ? styles.red : styles.gold}`}>{d.status === 'approved' ? 'Validé' : d.status === 'rejected' ? 'Rejeté' : 'En attente'}</span></td>
                <td className={styles.dim}>{d.adminNote || '-'}</td>
                <td className={styles.dim}>{fmtDate(d.createdAt)}</td>
                <td><button className={styles.btnSm} onClick={() => setProofModal(d)}>Voir</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {proofModal && (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) { setProofModal(null); setRejectNote(''); } }}>
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <div>
                <div className={styles.bold}>{proofModal.user?.name} — {fmt(proofModal.amount)} F</div>
                <div className={styles.dim}>{fmtDate(proofModal.createdAt)}</div>
              </div>
              <button className={styles.closeBtn} onClick={() => { setProofModal(null); setRejectNote(''); }}>✕</button>
            </div>
            <img src={`${uploadsBase}${proofModal.proofUrl}`} alt="Preuve" style={{ width: '100%', borderRadius: 12, margin: '16px 0' }} />
            {proofModal.status === 'pending' && (
              <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
                <input className={styles.input} placeholder="Note de rejet (optionnel)" value={rejectNote} onChange={e => setRejectNote(e.target.value)} />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className={styles.btnApprove} style={{ flex: 1 }} onClick={async () => {
                    try { await adminApi.approveDeposit(proofModal.id); showToast('Dépôt approuvé'); setProofModal(null); load('deposits'); }
                    catch { showToast('Erreur'); }
                  }}>Valider le dépôt</button>
                  <button className={styles.btnReject} style={{ flex: 1 }} onClick={async () => {
                    try { await adminApi.rejectDeposit(proofModal.id, rejectNote); showToast('Dépôt rejeté'); setProofModal(null); setRejectNote(''); load('deposits'); }
                    catch { showToast('Erreur'); }
                  }}>Rejeter</button>
                </div>
              </div>
            )}
            {proofModal.status !== 'pending' && (
              <div className={`${styles.badge} ${proofModal.status === 'approved' ? styles.green : styles.red}`} style={{ fontSize: 14, padding: '8px 16px' }}>
                {proofModal.status === 'approved' ? 'Approuvé' : 'Rejeté'}{proofModal.adminNote ? ` — ${proofModal.adminNote}` : ''}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // ─── TAB: USERS ──────────────────────────────────────────
  const TabUsers = () => (
    <div>
      <p className={styles.dim} style={{ marginBottom: 16 }}>Liste de tous les clients inscrits. Tu peux ajuster leur solde manuellement, les bannir (ils ne pourront plus se connecter ni retirer), ou les supprimer.</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <button className={styles.btnSm} onClick={async () => {
          try {
            const res = await fetch(adminApi.exportUsersUrl(), { headers: adminAuthHeaders() });
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'users.csv'; a.click();
            URL.revokeObjectURL(url);
          } catch { showToast('Erreur export'); }
        }}>Exporter utilisateurs CSV</button>
        <button className={styles.btnSm} onClick={async () => {
          try {
            const res = await fetch(adminApi.exportTransactionsUrl(), { headers: adminAuthHeaders() });
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'transactions.csv'; a.click();
            URL.revokeObjectURL(url);
          } catch { showToast('Erreur export'); }
        }}>Exporter transactions CSV</button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Nom</th><th>Email</th><th>Tél</th><th>Solde</th><th>Statut</th><th>Inscrit le</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td className={styles.bold}>{u.name}</td>
                <td className={styles.dim}>{u.email}</td>
                <td className={styles.dim}>{u.phone}</td>
                <td className={styles.mono}>{fmt(u.balance)} F</td>
                <td>{u.banned ? <span className={`${styles.badge} ${styles.red}`}>Banni</span> : <span className={`${styles.badge} ${styles.green}`}>Actif</span>}</td>
                <td className={styles.dim}>{fmtDate(u.createdAt)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className={styles.btnSm} onClick={async () => { try { setSelectedUser(await adminApi.userDetail(u.id)); } catch { showToast('Erreur'); } }}>Détail</button>
                    <button className={styles.btnSm} onClick={() => { setAdjustModal({ user: u }); setAdjAmt(''); setAdjReason(''); }}>Solde</button>
                    <button className={styles.btnSm} style={{ background: u.banned ? 'rgba(34,197,94,0.12)' : 'rgba(251,146,60,0.12)', color: u.banned ? 'var(--green-t)' : 'var(--orange-t)' }}
                      onClick={async () => {
                        try {
                          if (u.banned) { await adminApi.unbanUser(u.id); showToast(`${u.name} débanni`); }
                          else { await adminApi.banUser(u.id); showToast(`${u.name} banni`); }
                          load('users');
                        } catch { showToast('Erreur'); }
                      }}>{u.banned ? 'Débannir' : 'Bannir'}</button>
                    <button className={styles.btnDanger} onClick={async () => {
                      if (!confirm(`Supprimer ${u.name} ?`)) return;
                      try { await adminApi.deleteUser(u.id); setUsers(us => us.filter(x => x.id !== u.id)); showToast(`${u.name} supprimé`); }
                      catch { showToast('Erreur'); }
                    }}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedUser && (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) setSelectedUser(null); }}>
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <div><div className={styles.bold} style={{ fontSize: 17 }}>{selectedUser.user.name}</div><div className={styles.dim}>{selectedUser.user.email} | {selectedUser.user.phone}</div></div>
              <button className={styles.closeBtn} onClick={() => setSelectedUser(null)}>✕</button>
            </div>
            <div className={styles.kpiGrid} style={{ margin: '16px 0' }}>
              <KPI label="Solde" value={`${fmt(selectedUser.user.balance)} F`} />
              <KPI label="Transactions" value={selectedUser.transactions.length} />
              <KPI label="Positions" value={selectedUser.positions.length} />
            </div>
            <div className={styles.subTitle}>Dernières transactions</div>
            <div style={{ maxHeight: 250, overflowY: 'auto' }}>
              <table className={styles.table}>
                <thead><tr><th>Type</th><th>Montant</th><th>Description</th><th>Date</th></tr></thead>
                <tbody>
                  {selectedUser.transactions.map(t => (
                    <tr key={t.id}>
                      <td><span className={`${styles.badge} ${['deposit', 'yield', 'referral', 'game_win'].includes(t.type) ? styles.green : styles.red}`}>{t.type}</span></td>
                      <td className={styles.mono}>{fmt(Math.abs(Number(t.amount)))} F</td>
                      <td className={styles.dim}>{t.description}</td>
                      <td className={styles.dim}>{fmtDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {adjustModal && (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) setAdjustModal(null); }}>
          <div className={styles.modal} style={{ maxWidth: 400 }}>
            <div className={styles.modalHead}>
              <div className={styles.bold}>Ajuster le solde — {adjustModal.user.name}</div>
              <button className={styles.closeBtn} onClick={() => setAdjustModal(null)}>✕</button>
            </div>
            <p className={styles.dim} style={{ marginTop: 8 }}>Positif = crédit, négatif = débit</p>
            <input className={styles.input} type="number" placeholder="Montant (ex: 5000 ou -2000)" value={adjAmt} onChange={e => setAdjAmt(e.target.value)} />
            <input className={styles.input} placeholder="Raison" value={adjReason} onChange={e => setAdjReason(e.target.value)} />
            <button className={styles.btn} style={{ marginTop: 12, width: '100%' }} onClick={async () => {
              if (!adjAmt || !adjReason) return;
              try { await adminApi.adjustBalance(adjustModal.user.id, Number(adjAmt), adjReason); setAdjustModal(null); load('users'); showToast('Solde mis à jour'); }
              catch { showToast('Erreur'); }
            }}>Confirmer</button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── TAB: TRANSACTIONS ───────────────────────────────────
  const TabTransactions = () => (
    <div>
      <p className={styles.dim} style={{ marginBottom: 16 }}>Toutes les opérations financières : dépôts validés, retraits, yields journaliers versés, frais prélevés, bonus de parrainage. Chaque ligne = un mouvement d'argent sur la plateforme.</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>User</th><th>Type</th><th>Montant</th><th>Description</th><th>Date</th></tr></thead>
          <tbody>
            {txs.map(t => (
              <tr key={t.id}>
                <td className={styles.bold}>{t.user?.name ?? `#${t.userId}`}</td>
                <td><span className={`${styles.badge} ${['deposit', 'yield', 'referral', 'game_win'].includes(t.type) ? styles.green : styles.red}`}>{t.type}</span></td>
                <td className={styles.mono}>{fmt(Math.abs(Number(t.amount)))} F</td>
                <td className={styles.dim}>{t.description}</td>
                <td className={styles.dim}>{fmtDate(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ─── TAB: PLANS ──────────────────────────────────────────
  const TabPlans = () => (
    <div>
      <p className={styles.dim} style={{ marginBottom: 16 }}>Les plans sont les offres d'investissement proposées aux clients. Chaque plan a un montant fixe, un taux de rendement journalier, et une plateforme associée (1XBET, BETWINNER, etc.). Tu peux créer, modifier, activer/désactiver ou supprimer un plan.</p>
      <button className={styles.btn} style={{ marginBottom: 14 }} onClick={() => { setPlanModal('create'); setPlanForm({ slug: '', platform: '1XBET', planType: 'Simple', amount: '', dailyRatePercent: '', monthDays: '30' }); }}>
        + Créer un plan
      </button>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Slug</th><th>Plateforme</th><th>Type</th><th>Montant</th><th>Taux/j</th><th>Rev/jour</th><th>Rev/mois</th><th>Récup.</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {plans.map(p => (
              <tr key={p.id}>
                <td><span className={styles.badge}>{p.slug}</span></td>
                <td className={styles.bold}>{p.platform}</td>
                <td>{p.planType}</td>
                <td className={styles.mono}>{fmt(p.amount)} F</td>
                <td className={`${styles.mono} ${styles.positive}`}>{p.dailyRatePercent}%</td>
                <td className={styles.mono}>{fmt(p.dailyRevenue)} F</td>
                <td className={styles.mono}>{fmt(p.monthlyRevenue)} F</td>
                <td>{p.daysToRecover}j</td>
                <td><span className={`${styles.badge} ${p.active ? styles.green : styles.red}`}>{p.active ? 'actif' : 'off'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className={styles.btnSm} onClick={() => { setEditPlan(p); setPlanModal('edit'); setPlanForm({ slug: p.slug, platform: p.platform, planType: p.planType, amount: String(p.amount), dailyRatePercent: String(p.dailyRatePercent), monthDays: String(p.monthDays) }); }}>Modifier</button>
                    <button className={styles.btnSm} onClick={async () => { try { await adminApi.togglePlan(p.id); load('plans'); } catch { showToast('Erreur'); } }}>
                      {p.active ? 'Off' : 'On'}
                    </button>
                    <button className={styles.btnDanger} onClick={async () => {
                      if (!confirm(`Supprimer ${p.slug} ?`)) return;
                      try { await adminApi.deletePlan(p.id); load('plans'); showToast('Supprimé'); }
                      catch (e: any) { showToast(e.response?.data?.message || 'Erreur'); }
                    }}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {planModal && (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) { setPlanModal(null); setEditPlan(null); } }}>
          <div className={styles.modal} style={{ maxWidth: 500 }}>
            <div className={styles.modalHead}>
              <div className={styles.bold}>{planModal === 'create' ? 'Créer un plan' : `Modifier ${editPlan?.slug}`}</div>
              <button className={styles.closeBtn} onClick={() => { setPlanModal(null); setEditPlan(null); }}>✕</button>
            </div>
            <div className={styles.formGrid}>
              {planModal === 'create' && (
                <>
                  <div className={styles.formField}><label className={styles.formLabel}>Slug</label><input className={styles.input} value={planForm.slug} onChange={e => setPlanForm({ ...planForm, slug: e.target.value })} placeholder="1XBET-MEGA" /></div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Plateforme</label>
                    <select className={styles.input} value={planForm.platform} onChange={e => setPlanForm({ ...planForm, platform: e.target.value })}>
                      <option>1XBET</option><option>BETWINNER</option><option>BETPAWA</option><option>MELBET</option>
                    </select>
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Type</label>
                    <select className={styles.input} value={planForm.planType} onChange={e => setPlanForm({ ...planForm, planType: e.target.value })}>
                      <option>Simple</option><option>Plus</option><option>Max</option><option>MaxPlus</option>
                    </select>
                  </div>
                </>
              )}
              <div className={styles.formField}><label className={styles.formLabel}>Montant (FCFA)</label><input className={styles.input} type="number" value={planForm.amount} onChange={e => setPlanForm({ ...planForm, amount: e.target.value })} /></div>
              <div className={styles.formField}><label className={styles.formLabel}>Taux journalier (%)</label><input className={styles.input} type="number" step="0.01" value={planForm.dailyRatePercent} onChange={e => setPlanForm({ ...planForm, dailyRatePercent: e.target.value })} /></div>
              <div className={styles.formField}><label className={styles.formLabel}>Jours/mois</label><input className={styles.input} type="number" value={planForm.monthDays} onChange={e => setPlanForm({ ...planForm, monthDays: e.target.value })} /></div>
            </div>
            <button className={styles.btn} style={{ marginTop: 16, width: '100%' }} onClick={async () => {
              try {
                if (planModal === 'create') {
                  await adminApi.createPlan({ slug: planForm.slug, platform: planForm.platform, planType: planForm.planType, amount: Number(planForm.amount), dailyRatePercent: Number(planForm.dailyRatePercent), monthDays: Number(planForm.monthDays) });
                  showToast('Plan créé');
                } else if (editPlan) {
                  await adminApi.updatePlan(editPlan.id, { amount: Number(planForm.amount), dailyRatePercent: Number(planForm.dailyRatePercent), monthDays: Number(planForm.monthDays) });
                  showToast('Plan mis à jour');
                }
                setPlanModal(null); setEditPlan(null); load('plans');
              } catch (e: any) { showToast(e.response?.data?.message || 'Erreur'); }
            }}>{planModal === 'create' ? 'Créer' : 'Enregistrer'}</button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── TAB: POSITIONS ──────────────────────────────────────
  const TabPositions = () => (
    <div>
      <p className={styles.dim} style={{ marginBottom: 16 }}>Quand un client souscrit à un plan, une position est créée. Elle génère un yield journalier automatique (versé à minuit). Tu peux stopper une position manuellement si nécessaire — le client ne recevra plus de yields dessus.</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Utilisateur</th><th>Plateforme</th><th>Type</th><th>Capital</th><th>Taux/j</th><th>Gains</th><th>Actions</th></tr></thead>
          <tbody>
            {positionsList.map(p => (
              <tr key={p.id}>
                <td className={styles.bold}>{(p as any).user?.name ?? `#${p.userId}`}</td>
                <td>{p.platform}</td>
                <td>{p.planType}</td>
                <td className={styles.mono}>{fmt(Number(p.investedAmount))} F</td>
                <td className={`${styles.mono} ${styles.positive}`}>{p.dailyRatePercent}%</td>
                <td className={styles.mono}>{fmt(Number(p.totalEarned))} F</td>
                <td>
                  <button className={styles.btnDanger} onClick={async () => {
                    if (!confirm('Désactiver cette position ?')) return;
                    try { await adminApi.deactivatePosition(p.id); load('positions'); showToast('Position désactivée'); }
                    catch { showToast('Erreur'); }
                  }}>Stopper</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ─── TAB: PARAMÈTRES ─────────────────────────────────────
  const TabSettings = () => {
    if (!settings) return <Spinner />;

    const fields = [
      { key: 'deposit_phone_mtn', label: 'Numéro MTN Mobile Money', desc: 'Numéro MTN MoMo affiché aux clients pour envoyer leurs dépôts (ex: +237670000000)', type: 'text' },
      { key: 'deposit_phone_orange', label: 'Numéro Orange Money', desc: 'Numéro Orange Money affiché aux clients pour envoyer leurs dépôts (ex: +237690000000)', type: 'text' },
      { key: 'withdrawal_fee_percent', label: 'Frais de retrait (%)', desc: 'Pourcentage prélevé sur chaque retrait' },
      { key: 'maintenance_fee_percent', label: 'Frais de maintenance (%)', desc: 'Pourcentage prélevé sur chaque yield journalier' },
      { key: 'referral_bonus_percent', label: 'Bonus parrainage (%)', desc: 'Pourcentage du premier dépôt versé au parrain' },
      { key: 'min_withdrawal', label: 'Retrait minimum (FCFA)', desc: 'Montant minimum pour effectuer un retrait' },
      { key: 'withdrawals_enabled', label: 'Retraits actifs', desc: 'Désactiver pour bloquer tous les retraits' },
    ];

    return (
      <div>
        <h3 className={styles.sectionTitle}>Paramètres de la plateforme</h3>
        <div style={{ maxWidth: 500 }}>
          {fields.map(f => (
            <div key={f.key} style={{ marginBottom: 16 }}>
              <label className={styles.formLabel}>{f.label}</label>
              <div className={styles.dim} style={{ marginBottom: 4 }}>{f.desc}</div>
              {f.key === 'withdrawals_enabled' ? (
                <select className={styles.input} style={{ marginTop: 0 }} value={settingsForm[f.key] || ''} onChange={e => setSettingsForm({ ...settingsForm, [f.key]: e.target.value })}>
                  <option value="true">Oui</option>
                  <option value="false">Non</option>
                </select>
              ) : (
                <input className={styles.input} style={{ marginTop: 0 }} type={(f as any).type || 'number'} value={settingsForm[f.key] || ''} onChange={e => setSettingsForm({ ...settingsForm, [f.key]: e.target.value })} />
              )}
            </div>
          ))}
          <button className={styles.btn} onClick={async () => {
            try {
              const updated = await adminApi.updateSettings(settingsForm);
              setSettings(updated); setSettingsForm(updated);
              showToast('Paramètres enregistrés');
            } catch { showToast('Erreur'); }
          }}>Enregistrer</button>
        </div>

        <h3 className={styles.sectionTitle} style={{ marginTop: 40 }}>Actions manuelles</h3>
        <button className={styles.btn} style={{ background: 'var(--orange-t)' }} onClick={async () => {
          if (!confirm('Déclencher le paiement des yields maintenant ?')) return;
          try {
            const res = await adminApi.triggerYield();
            showToast(`Yields payés : ${fmt(res.totalPaid)} FCFA à ${res.positionsPaid} positions`);
          } catch { showToast('Erreur'); }
        }}>Déclencher les yields manuellement</button>
        <p className={styles.dim} style={{ marginTop: 8 }}>Normalement fait automatiquement à minuit. Utilise ça si tu veux forcer le paiement maintenant.</p>
      </div>
    );
  };

  // ─── TAB: PARRAINAGES ────────────────────────────────────
  const TabReferrals = () => {
    if (!referrals) return <Spinner />;
    return (
      <div>
        <h3 className={styles.sectionTitle}>Arbre des parrainages ({referrals.length} parrains)</h3>
        {referrals.length === 0 && <p className={styles.dim}>Aucun parrainage enregistré.</p>}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Parrain</th><th>Code</th><th>Filleuls</th><th>Liste des filleuls</th></tr></thead>
            <tbody>
              {referrals.map((r: any) => (
                <tr key={r.sponsor.id}>
                  <td className={styles.bold}>{r.sponsor.name}</td>
                  <td><span className={styles.badge}>{r.sponsor.code}</span></td>
                  <td className={styles.mono}>{r.filleuls.length}</td>
                  <td className={styles.dim}>{r.filleuls.map((f: any) => f.name).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── TAB: IA & RAPPORTS ──────────────────────────────────
  const TabAI = () => {
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

    const sendMessage = async () => {
      if (!input.trim() || streaming) return;
      const userMsg = input.trim();
      setInput('');
      setChatHistory(h => [...h, { role: 'user', content: userMsg }]);
      setStreaming(true);
      setCurrentAnswer('');

      try {
        const res = await fetch(`${API_BASE_URL}/admin/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
          body: JSON.stringify({
            message: userMsg,
            history: chatHistory.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
          }),
        });

        if (!res.body) throw new Error('Pas de stream');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) { full += data.text; setCurrentAnswer(full); scrollToBottom(); }
              if (data.done) break;
            } catch {}
          }
        }

        setChatHistory(h => [...h, { role: 'assistant', content: full }]);
      } catch (e: any) {
        setChatHistory(h => [...h, { role: 'assistant', content: `Erreur : ${e.message}` }]);
      } finally {
        setStreaming(false);
        setCurrentAnswer('');
        setTimeout(scrollToBottom, 100);
      }
    };

    const downloadPdf = async () => {
      setGeneratingPdf(true);
      try {
        const res = await fetch(`${API_BASE_URL}/admin/ai/report/pdf`, {
          headers: adminAuthHeaders(),
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bettrend-rapport-${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch { showToast('Erreur génération PDF'); }
      finally { setGeneratingPdf(false); }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>BetTrend AI — Assistant analytique</div>
            <div className={styles.dim}>Posez vos questions sur les finances, les dépôts, la caisse. Powered by Cohere.</div>
          </div>
          <button
            className={styles.btn}
            style={{ background: '#1E56E3', minWidth: 180, display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={downloadPdf}
            disabled={generatingPdf}
          >
            {generatingPdf ? 'Génération...' : 'Rapport PDF hebdo'}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg0)', borderRadius: 14, padding: 16, marginBottom: 12, minHeight: 340, maxHeight: 520, border: '1px solid var(--bd)' }}>
          {chatHistory.length === 0 && !streaming && (
            <div style={{ textAlign: 'center', color: 'var(--t3)', marginTop: 60 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--t2)' }}>BetTrend AI</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Demandez une analyse, un rapport, ou une explication des chiffres.</div>
              <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {[
                  'Quelle est la santé de la caisse ?',
                  'Combien de jours avant la caisse vide ?',
                  'Analyse les dépôts de cette semaine',
                  'Quels sont les risques actuels ?',
                ].map(q => (
                  <button key={q} className={styles.btnSm}
                    style={{ background: 'rgba(37,99,235,0.12)', color: 'var(--blue-t)', border: '1px solid rgba(37,99,235,0.2)' }}
                    onClick={() => { setInput(q); }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatHistory.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 12,
            }}>
              <div style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                background: msg.role === 'user' ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(37,99,235,0.3)' : 'rgba(255,255,255,0.08)'}`,
                fontSize: 13,
                lineHeight: 1.6,
                color: msg.role === 'user' ? '#c7d2fe' : 'var(--t1)',
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {streaming && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
              <div style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: '4px 14px 14px 14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--t1)',
                whiteSpace: 'pre-wrap',
              }}>
                {currentAnswer || <span style={{ opacity: 0.5 }}>...</span>}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className={styles.input}
            style={{ flex: 1, margin: 0 }}
            placeholder="Posez votre question..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={streaming}
          />
          <button className={styles.btn} onClick={sendMessage} disabled={streaming || !input.trim()} style={{ minWidth: 80 }}>
            {streaming ? '...' : 'Envoyer'}
          </button>
          {chatHistory.length > 0 && (
            <button className={styles.btnSm} onClick={() => setChatHistory([])} style={{ color: 'var(--red-t)' }}>
              Effacer
            </button>
          )}
        </div>
      </div>
    );
  };

  // ─── LAYOUT ──────────────────────────────────────────────
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.sidebarLogo}>
            <div className={styles.logoMark}>BT</div>
            <div className={styles.logoText}>
              <div className={styles.logoName}>BetTrend</div>
              <div className={styles.logoSub}>Back-office</div>
            </div>
          </div>
        </div>
        <nav className={styles.nav}>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`${styles.navItem} ${tab === t.id ? styles.navActive : ''}`}
              onClick={() => setTab(t.id)}
            >
              <NavIcon id={t.id} className={styles.navIcon} />
              <span>{t.label}</span>
              {t.id === 'deposits' && dash?.pendingDeposits ? (
                <span className={styles.navBadge}>{dash.pendingDeposits}</span>
              ) : t.id === 'withdrawals' && allWithdrawals.filter(w => w.status === 'pending').length > 0 ? (
                <span className={styles.navBadge}>{allWithdrawals.filter(w => w.status === 'pending').length}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <button className={styles.logoutBtn} onClick={() => { clearAdminKey(); setAuthed(false); }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" />
              <polyline points="10,11 13,8 10,5" />
              <line x1="13" y1="8" x2="6" y2="8" />
            </svg>
            Déconnexion
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.mainHead}>
          <h2 className={styles.mainTitle}>{TABS.find(t => t.id === tab)?.label}</h2>
          <button className={styles.refreshBtn} onClick={() => load(tab)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 7a6 6 0 106-6 6 6 0 00-4.2 1.7L1 5" />
              <polyline points="1,2 1,5 4,5" />
            </svg>
            Actualiser
          </button>
        </div>
        <div className={styles.content}>
          {tab === 'dashboard'    && TabDashboard()}
          {tab === 'analyses'     && TabAnalyses()}
          {tab === 'deposits'     && TabDeposits()}
          {tab === 'withdrawals'  && TabWithdrawals()}
          {tab === 'users'        && TabUsers()}
          {tab === 'transactions' && TabTransactions()}
          {tab === 'plans'        && TabPlans()}
          {tab === 'positions'    && TabPositions()}
          {tab === 'referrals'    && TabReferrals()}
          {tab === 'settings'     && TabSettings()}
          {tab === 'ai'           && TabAI()}
        </div>
      </main>

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
