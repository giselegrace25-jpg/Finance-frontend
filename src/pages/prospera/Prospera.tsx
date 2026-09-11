import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import styles from './Prospera.module.css';

type Tx = { id: number; type: string; amount: number; description: string; createdAt: string };
type Plan = { id: number; slug: string; platform: string; planType: string; amount: number; dailyRatePercent: number; dailyRevenue: number; monthlyRevenue: number; monthDays: number; daysToRecover: number };
type Position = { id: number; platform: string; planType: string; investedAmount: number; dailyRatePercent: number; totalEarned: number };
type Referral = { id: number; name: string; phone: string; joinedAt: string };
type ReferralData = { count: number; totalEarnings: number; referrals: Referral[] };
type DepositReq = { id: number; amount: number; provider: string | null; transactionId: string | null; status: string; createdAt: string };
type WithdrawalReq = { id: number; amount: number; netAmount: number; fee: number; accountNumber: string; accountName: string; status: string; createdAt: string };
type WithdrawalAccount = { id: number; accountNumber: string; accountName: string; isLocked: boolean } | null;

const PLATFORMS = ['1XBET', 'BETWINNER', 'BETPAWA', 'MELBET'];
const TERMS_TEXT = `Conditions Generales d'Utilisation (CGU)

En creant un compte ou en utilisant la plateforme, l'utilisateur reconnait avoir lu, compris et accepte les presentes conditions.

La plateforme permet aux utilisateurs de participer a des plans d'investissement collectifs. Tout investissement comporte des risques: perte partielle ou totale du capital, variation des performances, retards de distribution et absence de garantie de rendement.

L'utilisateur s'engage a fournir des informations exactes, a proteger son mot de passe, a utiliser un seul compte personnel et a ne pas utiliser la plateforme a des fins frauduleuses, illegales ou techniques malveillantes.

Les retraits sont disponibles du lundi au samedi, 24h/24, avec un minimum de 2 000 FCFA et des frais de 20%. Les revenus journaliers des investissements supportent des frais de maintenance de 3%.

Les donnees personnelles sont collectees pour la creation et la gestion du compte, la securite des transactions, le respect des obligations legales et l'amelioration du service. L'utilisateur doit signaler toute utilisation non autorisee.

La plateforme peut suspendre un compte en cas de fraude, piratage, fausse declaration ou non-respect des conditions. En continuant, l'utilisateur accepte les CGU et la politique de confidentialite.`;
const REVENUE_PLAN_TEXT = `

Plans disponibles

1XBET: Simple 6 000 FCFA - 10%/jour, Plus 14 000 FCFA - 16%/jour, Max 30 000 FCFA - 28%/jour, Max Plus 62 000 FCFA - 28%/jour.

BETWINNER: Simple 4 000 FCFA - 10%/jour, Plus 10 000 FCFA - 18%/jour, Max 22 000 FCFA - 26%/jour, Max Plus 46 000 FCFA - 30%/jour.

BETPAWA: Simple 2 000 FCFA - 10%/jour, Plus 4 200 FCFA - 18%/jour, Max 8 600 FCFA - 26%/jour, Max Plus 17 400 FCFA - 30%/jour.

MELBET: Simple 8 000 FCFA - 10%/jour, Plus 18 000 FCFA - 17%/jour, Max 36 000 FCFA - 26%/jour, Max Plus 72 000 FCFA - 38%/jour.

Plan des revenus sur transactions

Retraits: lundi a samedi, 24h/24, minimum 2 000 FCFA, frais de retrait 20%.

Investissement actif: 3% sont retires sur les benefices journaliers pour la maintenance, la securite, les mises a jour et le service client.

Jeux et trading: 20% peuvent etre preleves sur les benefices des jeux si les gains sont superieurs a 1 000 FCFA.`;

/* ── Countdown to midnight ──────────────────────────────── */
function useCountdown() {
  const [secs, setSecs] = useState(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  });
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      setSecs(Math.floor((midnight.getTime() - now.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const h = String(Math.floor(secs / 3600)).padStart(2, '0');
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/* ── Live accumulation ticker per position ──────────────── */
function LiveTicker({ gainNet }: { gainNet: number }) {
  const gainPerSec = gainNet / 86400;
  const startRef = useRef(Date.now());
  const [accumulated, setAccumulated] = useState(0);

  useEffect(() => {
    startRef.current = Date.now();
    setAccumulated(0);
    const id = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      setAccumulated(gainPerSec * elapsed);
    }, 100);
    return () => clearInterval(id);
  }, [gainNet]);

  const fmt3 = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <span className={styles.tickerVal}>+{fmt3(accumulated)} FCFA</span>;
}
const TX_ICON: Record<string, string> = { deposit: '+', withdraw: '-', invest: 'I', yield: '%', referral: 'P', game_win: 'G', game_fee: 'F', maintenance_fee: 'M', withdrawal_fee: 'F' };
const TX_POSITIVE = ['deposit', 'yield', 'referral', 'game_win'];

/* ── Familial tree ──────────────────────────────────────── */
function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function FamilialTree({ me, referrals, code }: { me: string; referrals: Referral[]; code: string }) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const refLink = `${window.location.origin}/?ref=${code}`;

  const copy = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    const text = `Rejoins BetTrend avec mon code de parrainage : ${code}\n${refLink}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'BetTrend — Parrainage', text }); } catch { /* annulé */ }
    } else {
      navigator.clipboard?.writeText(text).catch(() => {});
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    }
  };

  const ROOT_Y = 32;
  const CHILD_Y = 164;
  const NODE_W = 76;
  const canvasW = Math.max(320, referrals.length * NODE_W + 80);
  const centerX = canvasW / 2;

  const childPositions = referrals.map((_, i) => {
    const total = referrals.length;
    const startX = centerX - ((total - 1) * NODE_W) / 2;
    return startX + i * NODE_W;
  });

  return (
    <div>
      {/* Hero parrainage */}
      <div className={styles.referralHero}>
        <div className={styles.walletLabel}>Plan familial — Mon code</div>
        <div className={styles.referralCode}>{code}</div>
        <div className={styles.walletRow}>
          <div className={styles.walletStat}>
            <div className={styles.walletStatVal}>{referrals.length}</div>
            <div className={styles.walletStatLbl}>Filleuls</div>
          </div>
          <div className={styles.walletDivider} />
          <div className={styles.walletStat}>
            <div className={styles.walletStatVal}>Illimité</div>
            <div className={styles.walletStatLbl}>Capacité</div>
          </div>
        </div>
        <div className={styles.shareRow}>
          <button className={styles.copyBtn} onClick={copy}>{copied ? 'Copié !' : 'Copier le code'}</button>
          <button className={styles.shareBtn} onClick={share}>{shared ? 'Lien copié !' : 'Partager le lien'}</button>
        </div>
        <div className={styles.refLinkBox}>
          <span className={styles.refLinkLabel}>Lien d'invitation</span>
          <span className={styles.refLinkText}>{refLink}</span>
        </div>
      </div>

      <div className={styles.communityCard}>
        <div className={styles.rulesTitle}>Communautes BetTrend</div>
        <div className={styles.communityActions}>
          <a className={styles.telegramBtn} href="https://t.me/+E2kSpgdQDIBkYzZk" target="_blank" rel="noreferrer">Canal Telegram</a>
          <a className={styles.whatsappBtn} href="https://chat.whatsapp.com/GqXt11W1A3fHcwkVehfDcw?s=sw&p=a&ilr=1" target="_blank" rel="noreferrer">Groupe WhatsApp</a>
        </div>
      </div>

      {/* Arbre SVG */}
      <div className="sec-head" style={{ marginTop: 22 }}>
        <div className="sec-title">Arbre généalogique</div>
      </div>

      <div className={styles.treeWrap}>
        <div className={styles.treeScroll}>
          <svg
            width={canvasW}
            height={referrals.length > 0 ? 270 : 120}
            style={{ display: 'block', overflow: 'visible' }}
          >
            {/* Lignes parrain → filleuls */}
            {childPositions.map((cx, i) => (
              <path
                key={i}
                d={`M ${centerX} ${ROOT_Y + 38} C ${centerX} ${(ROOT_Y + CHILD_Y) / 2 + 20}, ${cx} ${(ROOT_Y + CHILD_Y) / 2 + 20}, ${cx} ${CHILD_Y}`}
                stroke="rgba(30,86,227,0.45)"
                strokeWidth="2"
                fill="none"
              />
            ))}

            {/* Nœud parrain (moi) */}
            <g>
              <circle cx={centerX} cy={ROOT_Y + 16} r="32" fill="url(#rootGrad)" />
              <text x={centerX} y={ROOT_Y + 21} textAnchor="middle" fontFamily="Sora,sans-serif" fontWeight="800" fontSize="15" fill="#fff">{initials(me)}</text>
              <rect x={centerX - 18} y={ROOT_Y - 18} width="36" height="16" rx="7" fill="#0C1222" stroke="rgba(30,86,227,0.5)" strokeWidth="1" />
              <text x={centerX} y={ROOT_Y - 6} textAnchor="middle" fontFamily="Inter,sans-serif" fontWeight="700" fontSize="8.5" fill="rgba(160,190,255,0.9)">Parrain</text>
              <text x={centerX} y={ROOT_Y + 62} textAnchor="middle" fontFamily="Inter,sans-serif" fontWeight="600" fontSize="11" fill="var(--text-mid)">{me.split(' ')[0]}</text>
            </g>

            {/* Nœuds filleuls */}
            {referrals.map((r, i) => (
              <g key={r.id}>
                <circle cx={childPositions[i]} cy={CHILD_Y + 16} r="26" fill="url(#childGrad)" />
                <text x={childPositions[i]} y={CHILD_Y + 21} textAnchor="middle" fontFamily="Sora,sans-serif" fontWeight="800" fontSize="12" fill="#fff">{initials(r.name)}</text>
                <text x={childPositions[i]} y={CHILD_Y + 56} textAnchor="middle" fontFamily="Inter,sans-serif" fontWeight="600" fontSize="10.5" fill="var(--text-mid)">{r.name.split(' ')[0]}</text>
                <text x={childPositions[i]} y={CHILD_Y + 70} textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="9.5" fill="var(--text-low)">{new Date(r.joinedAt).toLocaleDateString('fr-FR')}</text>
              </g>
            ))}

            <defs>
              <linearGradient id="rootGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#D4A843" />
                <stop offset="100%" stopColor="#A07820" />
              </linearGradient>
              <linearGradient id="childGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1E56E3" />
                <stop offset="100%" stopColor="#1040B8" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className={styles.treeLegend}>
          <div className={styles.legItem}><span className={styles.legDot} style={{ background: '#D4A843' }} />Parrain</div>
          <div className={styles.legItem}><span className={styles.legDot} style={{ background: '#1E56E3' }} />Filleul actif</div>
        </div>
      </div>

      {/* Liste des filleuls */}
      {referrals.length > 0 && (
        <>
          <div className="sec-head" style={{ marginTop: 16 }}><div className="sec-title">Mes filleuls ({referrals.length})</div></div>
          {referrals.map(r => (
            <div key={r.id} className={styles.filleulRow}>
              <div className={styles.filleulAvatar}>{initials(r.name)}</div>
              <div className={styles.filleulInfo}>
                <div className={styles.filleulName}>{r.name}</div>
                <div className={styles.filleulDate}>Inscrit le {new Date(r.joinedAt).toLocaleDateString('fr-FR')}</div>
              </div>
              <div className={styles.filleulBadge}>Actif</div>
            </div>
          ))}
        </>
      )}

      <div className={styles.rulesCard} style={{ marginTop: 16 }}>
        <div className={styles.rulesTitle}>Règles du plan familial</div>
        <div className={styles.ruleItem}><div className={styles.ruleDot} />Aucune limite de filleuls</div>
        <div className={styles.ruleItem}><div className={styles.ruleDot} />15% du premier dépôt de chaque filleul crédités</div>
        <div className={styles.ruleItem}><div className={styles.ruleDot} />Bonus versé instantanément sur votre solde</div>
        <div className={styles.ruleItem}><div className={styles.ruleDot} />Le filleul doit saisir votre code ou utiliser votre lien</div>
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────── */
export default function Prospera() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [screen, setScreen] = useState('accueil');
  const [balance, setBalance] = useState(user?.balance ?? 0);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [refData, setRefData] = useState<ReferralData | null>(null);
  const [hidden, setHidden] = useState(false);
  const [depositPhoneMtn, setDepositPhoneMtn] = useState('');
  const [depositPhoneOrange, setDepositPhoneOrange] = useState('');
  const [filter, setFilter] = useState('all');
  const INVEST_KEY = 'bt_invest_draft';
  const [selected, setSelected] = useState<Plan | null>(null);
  const [amount, setAmount] = useState(() => {
    try {
      const depot = JSON.parse(localStorage.getItem('bt_depot_draft') || 'null');
      if (depot?.amount) return depot.amount;
      const invest = JSON.parse(localStorage.getItem('bt_invest_draft') || 'null');
      return invest?.amount || '';
    } catch { return ''; }
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const countdown = useCountdown();

  // Depot flow — persisté dans localStorage pour survie redémarrage/extinction
  const DEPOT_KEY = 'bt_depot_draft';
  const loadDepotDraft = () => {
    try { return JSON.parse(localStorage.getItem(DEPOT_KEY) || 'null'); } catch { return null; }
  };
  const draft = loadDepotDraft();
  const [depositStep, setDepositStep] = useState<'init' | 'confirm'>(draft?.step === 'confirm' ? 'confirm' : 'init');
  const [depositProvider, setDepositProvider] = useState<'mtn' | 'orange' | ''>(draft?.provider || '');
  const [depositTransactionId, setDepositTransactionId] = useState('');

  const [draftResumed, setDraftResumed] = useState(() => draft?.step === 'confirm');

  const saveDepotDraft = (step: string, provider: string, amt: string) => {
    localStorage.setItem(DEPOT_KEY, JSON.stringify({ step, provider, amount: amt }));
  };
  const clearDepotDraft = () => { localStorage.removeItem(DEPOT_KEY); setDraftResumed(false); };

  // Retrait flow
  const RETRAIT_SETUP_KEY = 'bt_retrait_setup';
  const [withdrawalAccount, setWithdrawalAccount] = useState<WithdrawalAccount>(null);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalReq[]>([]);
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bt_retrait_setup') || 'null')?.accountNumber || ''; } catch { return ''; }
  });
  const [withdrawAccountName, setWithdrawAccountName] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bt_retrait_setup') || 'null')?.accountName || ''; } catch { return ''; }
  });
  const [withdrawAccountConfirm, setWithdrawAccountConfirm] = useState(false);

  // Deposits history
  const [myDeposits, setMyDeposits] = useState<DepositReq[]>([]);

  // Profil edit
  const [profileEdit, setProfileEdit] = useState({ name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '' });
  const [pwdForm, setPwdForm] = useState({ old: '', new1: '', new2: '' });

  useEffect(() => { if (!user) navigate('/'); }, [user]);
  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem(`bt_terms_accepted_${user.id}`) !== 'yes') setShowTerms(true);
  }, [user]);
  useEffect(() => {
    let cancelled = false;
    fetchData(cancelled).then(ok => { if (!ok && !cancelled) navigate('/'); });
    // Auto-redirect to depot screen if a pending draft exists (phone was turned off mid-deposit)
    if (draft?.step === 'confirm') setScreen('depot');
    return () => { cancelled = true; };
  }, []);

  // Persist withdrawal account setup form in real-time
  useEffect(() => {
    if (!withdrawAccountNumber && !withdrawAccountName) return;
    localStorage.setItem(RETRAIT_SETUP_KEY, JSON.stringify({ accountNumber: withdrawAccountNumber, accountName: withdrawAccountName }));
  }, [withdrawAccountNumber, withdrawAccountName]);

  // Persist invest draft (plan slug + amount) in real-time
  useEffect(() => {
    if (!selected) return;
    localStorage.setItem(INVEST_KEY, JSON.stringify({ slug: selected.slug, amount }));
  }, [selected, amount]);

  const fetchData = async (cancelled = false): Promise<boolean> => {
    try {
      const meRes = await api.get('/users/me');
      if (cancelled) return true;
      setBalance(meRes.data.balance);
    } catch {
      return false;
    }

    const safe = async <T,>(p: Promise<{ data: T }>, fallback: T): Promise<T> => {
      try { return (await p).data; } catch { return fallback; }
    };

    const [txData, plansData, posData, refDataRes, cfgData, depData, waData, wrData] = await Promise.all([
      safe(api.get('/transactions'), []),
      safe(api.get('/plans'), []),
      safe(api.get('/positions'), []),
      safe(api.get('/users/referrals'), { count: 0, totalEarnings: 0, referrals: [] }),
      safe(api.get('/users/config'), { depositPhoneMtn: '', depositPhoneOrange: '' }),
      safe(api.get('/deposits/my'), []),
      safe(api.get('/withdrawal-accounts/me'), null),
      safe(api.get('/withdrawal-requests/my'), []),
    ]);

    if (cancelled) return true;
    setTransactions(txData as Tx[]);
    setPlans(plansData as Plan[]);
    try {
      const iv = JSON.parse(localStorage.getItem('bt_invest_draft') || 'null');
      if (iv?.slug) {
        const match = (plansData as Plan[]).find(p => p.slug === iv.slug);
        if (match) setSelected(match);
      }
    } catch { /* ignore */ }
    setPositions(posData as Position[]);
    setRefData(refDataRes as ReferralData);
    setDepositPhoneMtn((cfgData as any).depositPhoneMtn || '');
    setDepositPhoneOrange((cfgData as any).depositPhoneOrange || '');
    setMyDeposits(depData as DepositReq[]);
    setWithdrawalAccount(waData as WithdrawalAccount);
    setWithdrawalRequests(wrData as WithdrawalReq[]);
    return true;
  };

  const goTo = (s: string) => {
    if (s !== screen && s !== 'depot' && s !== 'retrait' && screen !== 'plans') {
      setAmount('');
    }
    setScreen(s);
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3200); };
  const acceptTerms = () => {
    if (user) localStorage.setItem(`bt_terms_accepted_${user.id}`, 'yes');
    setShowTerms(false);
  };
  const fmt = (n: number) => Number(n).toLocaleString('fr-FR');
  const cleanDepositPhone = (phone: string) => phone.replace(/\D/g, '');
  const buildDepositDialUrl = (provider: 'mtn' | 'orange', phone: string, depositAmount: string) => {
    const numero = cleanDepositPhone(phone);
    const montant = Math.floor(Number(depositAmount));
    if (!numero || !montant || montant <= 0) return '';

    const code = provider === 'mtn'
      ? `*126*1*1*${numero}*${montant}#`
      : `#150*1*1*${numero}*${montant}#`;

    return `tel:${code.replace(/#/g, '%23')}`;
  };
  const formatDate = (d: string) => {
    const date = new Date(d);
    const diff = Date.now() - date.getTime();
    if (diff < 86400000) return `Aujourd'hui, ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    if (diff < 172800000) return `Hier, ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    return date.toLocaleDateString('fr-FR');
  };

  const [proofFile, setProofFile] = useState<File | null>(null);

  const invest = async () => {
    if (!selected) return;
    const investAmount = parseFloat(amount) || selected.amount;
    setLoading(true);
    try {
      const res = await api.post('/positions/invest', { planSlug: selected.slug, amount: investAmount });
      setBalance(res.data.balance);
      await fetchData(); setSelected(null); setAmount(''); localStorage.removeItem(INVEST_KEY);
      showToast(`${fmt(investAmount)} FCFA investis — ${selected.platform} ${selected.planType}`);
      goTo('wallet');
    } catch (e: any) { showToast(e.response?.data?.message || 'Erreur'); }
    finally { setLoading(false); }
  };

  const totalInvested = positions.reduce((s, p) => s + Number(p.investedAmount), 0);
  const totalEarned = positions.reduce((s, p) => s + Number(p.totalEarned), 0);
  const netPerDay = positions.reduce((s, p) => s + Math.round(Number(p.investedAmount) * p.dailyRatePercent / 100 * 0.97), 0);
  const filteredPlans = filter === 'all' ? plans : plans.filter(p => p.platform === filter);

  return (
    <div className="app-shell">
      <div className="aurora"><span /><span /><span /></div>
      <div className="grain" />
      <div className="screens">

        {/* ACCUEIL */}
        <section className={`screen ${screen === 'accueil' ? 'active' : ''}`}>
          <div className="topbar">
            <div>
              <div className="greet-label">BetTrend</div>
              <div className="greet-name">Bonjour, {user?.name?.split(' ')[0]}</div>
            </div>
            <div className="avatar">{initials(user?.name ?? 'U')}</div>
          </div>

          <div className={styles.balanceCard}>
            <div className={styles.balanceTop}>
              <div className={styles.balanceTag}><span className="dot-live" /> Solde disponible</div>
              <button className={styles.eyeBtn} onClick={() => setHidden(!hidden)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B6AFCC" strokeWidth="2">
                  {hidden
                    ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
                    : <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></>}
                </svg>
              </button>
            </div>
            <div className={styles.balanceAmount}>{hidden ? '•••• •••' : `${fmt(balance)} FCFA`}</div>
            <div className={styles.quickActions}>
              <div className={styles.qaItem} onClick={() => goTo('depot')}>
                <div className={styles.qaCircle}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F3F0FF" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg></div>
                <div className={styles.qaLabel}>Déposer</div>
              </div>
              <div className={styles.qaItem} onClick={() => goTo('retrait')}>
                <div className={styles.qaCircle}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F3F0FF" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg></div>
                <div className={styles.qaLabel}>Retirer</div>
              </div>
              <div className={styles.qaItem} onClick={() => goTo('plans')}>
                <div className={styles.qaCircle}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F3F0FF" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6" /></svg></div>
                <div className={styles.qaLabel}>Investir</div>
              </div>
              <div className={styles.qaItem} onClick={() => goTo('familial')}>
                <div className={styles.qaCircle}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F3F0FF" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></div>
                <div className={styles.qaLabel}>Famille</div>
              </div>
            </div>
          </div>

          <div className={styles.statGrid} style={{ marginTop: 14 }}>
            <div className={styles.statCard}><div className={styles.lbl}>Net/jour</div><div className={`${styles.val} ${styles.cyan}`}>+{fmt(netPerDay)}</div></div>
            <div className={styles.statCard}><div className={styles.lbl}>Total investi</div><div className={styles.val}>{fmt(totalInvested)}</div></div>
          </div>
          {positions.length > 0 && (
            <div className={styles.countdownBanner}>
              <div className={styles.countdownLabel}>Prochain versement dans</div>
              <div className={styles.countdownTime}>{countdown}</div>
            </div>
          )}

          <div className="sec-head">
            <div className="sec-title">Transactions récentes</div>
            <div className="sec-link" onClick={() => goTo('wallet')}>Tout voir</div>
          </div>
          {transactions.slice(0, 5).map((tx, i) => (
            <div key={tx.id} className={styles.txRow} style={{ animationDelay: `${i * 0.07}s` }}>
              <div className={`${styles.txIcon} ${TX_POSITIVE.includes(tx.type) ? styles.txIn : styles.txOut}`}>{TX_ICON[tx.type] ?? '?'}</div>
              <div className={styles.txInfo}>
                <div className={styles.txName}>{tx.description}</div>
                <div className={styles.txDate}>{formatDate(tx.createdAt)}</div>
              </div>
              <div className={`${styles.txAmount} ${TX_POSITIVE.includes(tx.type) ? styles.pos : styles.neg}`}>
                {TX_POSITIVE.includes(tx.type) ? '+' : '-'}{fmt(Math.abs(Number(tx.amount)))}
              </div>
            </div>
          ))}
          {transactions.length === 0 && <p style={{ color: 'var(--text-low)', textAlign: 'center', marginTop: 20 }}>Aucune transaction.</p>}
        </section>

        {/* PLANS */}
        <section className={`screen ${screen === 'plans' ? 'active' : ''}`}>
          <div className="topbar"><div><div className="greet-label">Investir</div><div className="greet-name">Choisir un plan</div></div></div>
          <div className={styles.chipRow}>
            {[{ id: 'all', label: 'Tous' }, ...PLATFORMS.map(p => ({ id: p, label: p }))].map(f => (
              <div key={f.id} className={`${styles.chip} ${filter === f.id ? styles.chipActive : ''}`} onClick={() => setFilter(f.id)}>{f.label}</div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            {filteredPlans.map(p => (
              <div key={p.id} className={styles.posCard} onClick={() => setSelected(p)} style={{ cursor: 'pointer' }}>
                <div className={styles.posHeader}>
                  <div className={styles.posIcon}>{p.platform.slice(0, 2)}</div>
                  <div className={styles.posTitle}>{p.platform}</div>
                  <div className={styles.posBadge}>{p.planType}</div>
                </div>
                <div className={styles.posGrid}>
                  <div className={styles.posCell}><div className={styles.posCellLbl}>Investissement</div><div className={styles.posCellVal}>{fmt(p.amount)} FCFA</div></div>
                  <div className={styles.posCell}><div className={styles.posCellLbl}>Taux journalier</div><div className={`${styles.posCellVal} ${styles.cyan}`}>{p.dailyRatePercent}%</div></div>
                  <div className={styles.posCell}><div className={styles.posCellLbl}>Gain net/jour</div><div className={`${styles.posCellVal} ${styles.cyan}`}>{fmt(Math.round(p.dailyRevenue * 0.97))} FCFA</div></div>
                  <div className={styles.posCell}><div className={styles.posCellLbl}>Gain/mois</div><div className={`${styles.posCellVal} ${styles.gold}`}>{fmt(Math.round(p.monthlyRevenue * 0.97))} FCFA</div></div>
                </div>
                <div className={styles.posFooter}><span>Capital récupéré en <b>{p.daysToRecover} jours</b></span></div>
              </div>
            ))}
          </div>
        </section>

        {/* WALLET */}
        <section className={`screen ${screen === 'wallet' ? 'active' : ''}`}>
          <div className="topbar"><div><div className="greet-label">Portefeuille</div><div className="greet-name">Mes investissements</div></div></div>
          <div className={styles.walletHero}>
            <div className={styles.walletLabel}>Solde disponible</div>
            <div className={styles.walletAmount}>{fmt(balance)} <span>FCFA</span></div>
            <div className={styles.walletRow}>
              <div className={styles.walletStat}><div className={styles.walletStatVal}>{fmt(totalInvested)}</div><div className={styles.walletStatLbl}>Investi</div></div>
              <div className={styles.walletDivider} />
              <div className={styles.walletStat}><div className={`${styles.walletStatVal} ${styles.cyan}`}>+{fmt(netPerDay)}</div><div className={styles.walletStatLbl}>Net/jour</div></div>
              <div className={styles.walletDivider} />
              <div className={styles.walletStat}><div className={`${styles.walletStatVal} ${styles.gold}`}>{fmt(totalEarned)}</div><div className={styles.walletStatLbl}>Gains</div></div>
            </div>
          </div>

          <div className="sec-head" style={{ marginTop: 18 }}>
            <div className="sec-title">Mes {positions.length} position{positions.length !== 1 ? 's' : ''} active{positions.length !== 1 ? 's' : ''}</div>
          </div>
          {positions.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>0</div>
              <div className={styles.emptyText}>Aucun investissement actif</div>
              <button className="btn-main" onClick={() => goTo('plans')}>Choisir un plan</button>
            </div>
          )}
          {positions.length > 0 && (
            <div className={styles.countdownBanner}>
              <div className={styles.countdownLabel}>Prochain versement dans</div>
              <div className={styles.countdownTime}>{countdown}</div>
            </div>
          )}
          {positions.map(p => {
            const gainBrut = Math.round(Number(p.investedAmount) * p.dailyRatePercent / 100);
            const maintenance = Math.round(gainBrut * 0.03);
            const gainNet = gainBrut - maintenance;
            return (
              <div key={p.id} className={styles.posCard}>
                <div className={styles.posHeader}>
                  <div className={styles.posIcon}>{p.platform.slice(0, 2)}</div>
                  <div className={styles.posTitle}>{p.platform} - {p.planType}</div>
                </div>
                <div className={styles.tickerBox}>
                  <div className={styles.tickerLabel}>Accumulation en cours</div>
                  <LiveTicker gainNet={gainNet} />
                </div>
                <div className={styles.posGrid}>
                  <div className={styles.posCell}><div className={styles.posCellLbl}>Capital</div><div className={styles.posCellVal}>{fmt(Number(p.investedAmount))}</div></div>
                  <div className={styles.posCell}><div className={styles.posCellLbl}>Taux</div><div className={styles.posCellVal}>{p.dailyRatePercent}%/j</div></div>
                  <div className={styles.posCell}><div className={styles.posCellLbl}>Net/jour</div><div className={`${styles.posCellVal} ${styles.cyan}`}>+{fmt(gainNet)}</div></div>
                  <div className={styles.posCell}><div className={styles.posCellLbl}>Total gagné</div><div className={`${styles.posCellVal} ${styles.gold}`}>+{fmt(Number(p.totalEarned))}</div></div>
                </div>
                <div className={styles.revenueBreakdown}>
                  <div className={styles.revLine}><span>Brut/jour</span><span className={styles.revVal}>{fmt(gainBrut)} FCFA</span></div>
                  <div className={styles.revLine}><span>Maintenance (3%)</span><span className={styles.revValNeg}>-{fmt(maintenance)} FCFA</span></div>
                  <div className={`${styles.revLine} ${styles.revTotal}`}><span>Net versé</span><span className={styles.revValGreen}>+{fmt(gainNet)} FCFA</span></div>
                </div>
              </div>
            );
          })}

          {/* Historique des transactions dans l'onglet wallet */}
          <div className="sec-head" style={{ marginTop: 18 }}>
            <div className="sec-title">Historique</div>
          </div>
          <div className={styles.statGrid} style={{ marginTop: 0, marginBottom: 14 }}>
            <div className={styles.statCard}><div className={styles.lbl}>Dépôts</div><div className={styles.val}>{fmt(transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0))}</div></div>
            <div className={styles.statCard}><div className={styles.lbl}>Gains reçus</div><div className={`${styles.val} ${styles.cyan}`}>{fmt(transactions.filter(t => t.type === 'yield').reduce((s, t) => s + Number(t.amount), 0))}</div></div>
          </div>
          <div className="sec-head" style={{ marginTop: 12 }}><div className="sec-title">Plans achetes</div></div>
          {transactions.filter(t => t.type === 'invest').length === 0 && <p style={{ color: 'var(--text-low)', textAlign: 'center', marginTop: 10 }}>Aucun plan achete.</p>}
          {transactions.filter(t => t.type === 'invest').map(tx => (
            <div key={`invest-${tx.id}`} className={styles.txRow}>
              <div className={`${styles.txIcon} ${styles.txOut}`}>I</div>
              <div className={styles.txInfo}>
                <div className={styles.txName}>{tx.description || 'Plan d investissement achete'}</div>
                <div className={styles.txDate}>{formatDate(tx.createdAt)}</div>
              </div>
              <div className={`${styles.txAmount} ${styles.neg}`}>-{fmt(Number(tx.amount))}</div>
            </div>
          ))}

          <div className="sec-head" style={{ marginTop: 12 }}><div className="sec-title">Historique des depots</div></div>
          {myDeposits.length === 0 && <p style={{ color: 'var(--text-low)', textAlign: 'center', marginTop: 10 }}>Aucun depot.</p>}
          {myDeposits.map(d => (
            <div key={`deposit-${d.id}`} className={styles.txRow}>
              <div className={`${styles.txIcon} ${styles.txIn}`}>D</div>
              <div className={styles.txInfo}>
                <div className={styles.txName}>{fmt(Number(d.amount))} FCFA {d.provider ? `(${d.provider.toUpperCase()})` : ''}</div>
                <div className={styles.txDate}>{new Date(d.createdAt).toLocaleDateString('fr-FR')}{d.transactionId ? ` - ID: ${d.transactionId}` : ''}</div>
              </div>
              <div className={styles.statusPill}>{d.status === 'approved' ? 'Valide' : d.status === 'rejected' ? 'Rejete' : 'En attente'}</div>
            </div>
          ))}

          <div className="sec-head" style={{ marginTop: 12 }}><div className="sec-title">Historique des retraits</div></div>
          {withdrawalRequests.length === 0 && <p style={{ color: 'var(--text-low)', textAlign: 'center', marginTop: 10 }}>Aucun retrait.</p>}
          {withdrawalRequests.map(wr => (
            <div key={`withdraw-${wr.id}`} className={styles.txRow}>
              <div className={`${styles.txIcon} ${styles.txOut}`}>R</div>
              <div className={styles.txInfo}>
                <div className={styles.txName}>{fmt(Number(wr.amount))} FCFA demandes - {fmt(Number(wr.netAmount))} net</div>
                <div className={styles.txDate}>{new Date(wr.createdAt).toLocaleDateString('fr-FR')} - frais {fmt(Number(wr.fee))} FCFA</div>
              </div>
              <div className={styles.statusPill}>{wr.status === 'completed' ? 'Valide' : wr.status === 'rejected' ? 'Rejete' : 'En attente'}</div>
            </div>
          ))}

          <div className="sec-head" style={{ marginTop: 12 }}><div className="sec-title">Toutes les transactions</div></div>
          {transactions.map((tx, i) => (
            <div key={tx.id} className={styles.txRow} style={{ animationDelay: `${i * 0.04}s` }}>
              <div className={`${styles.txIcon} ${TX_POSITIVE.includes(tx.type) ? styles.txIn : styles.txOut}`}>{TX_ICON[tx.type] ?? '?'}</div>
              <div className={styles.txInfo}>
                <div className={styles.txName}>{tx.description}</div>
                <div className={styles.txDate}>{formatDate(tx.createdAt)}</div>
              </div>
              <div className={`${styles.txAmount} ${TX_POSITIVE.includes(tx.type) ? styles.pos : styles.neg}`}>
                {TX_POSITIVE.includes(tx.type) ? '+' : '-'}{fmt(Math.abs(Number(tx.amount)))}
              </div>
            </div>
          ))}
        </section>

        {/* FAMILIAL */}
        <section className={`screen ${screen === 'familial' ? 'active' : ''}`}>
          <div className="topbar">
            <div><div className="greet-label">Plan familial</div><div className="greet-name">Arbre de parrainage</div></div>
            <div className="avatar">{initials(user?.name ?? 'U')}</div>
          </div>
          <FamilialTree
            me={user?.name ?? 'Moi'}
            referrals={refData?.referrals ?? []}
            code={user?.referralCode ?? '---'}
          />
        </section>

        {/* DEPOT */}
        <section className={`screen ${screen === 'depot' ? 'active' : ''}`}>
          <div className="topbar">
            <button className={styles.backBtn} onClick={() => { clearDepotDraft(); goTo('accueil'); setDepositStep('init'); setDepositProvider(''); setAmount(''); setDepositTransactionId(''); setProofFile(null); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div><div className="greet-label">Dépôt</div><div className="greet-name">{depositStep === 'init' ? 'Recharger mon solde' : 'Confirmer la transaction'}</div></div>
          </div>

          {depositStep === 'init' && (
            <>
              {/* Étape 1 : Choisir le réseau */}
              <div className={styles.stepCard}>
                <div className={styles.stepNum}>1</div>
                <div className={styles.stepContent}>
                  <div className={styles.stepTitle}>Choisissez votre réseau</div>
                  <div className={styles.phoneBtnRow}>
                    <button
                      className={`${styles.phoneBtn} ${styles.phoneBtnMtn}`}
                      style={{ opacity: depositProvider === 'orange' ? 0.45 : 1, border: depositProvider === 'mtn' ? '2px solid #fff' : 'none' }}
                      onClick={() => setDepositProvider('mtn')}
                    >
                      <span><div style={{fontWeight:800,fontSize:13}}>MTN MoMo</div></span>
                    </button>
                    <button
                      className={`${styles.phoneBtn} ${styles.phoneBtnOrange}`}
                      style={{ opacity: depositProvider === 'mtn' ? 0.45 : 1, border: depositProvider === 'orange' ? '2px solid #fff' : 'none' }}
                      onClick={() => setDepositProvider('orange')}
                    >
                      <span><div style={{fontWeight:800,fontSize:13}}>Orange Money</div></span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Étape 2 : Montant */}
              <div className={styles.stepCard}>
                <div className={styles.stepNum}>2</div>
                <div className={styles.stepContent}>
                  <div className={styles.stepTitle}>Montant à déposer</div>
                  <input className={styles.modalInput} type="number" placeholder="Montant en FCFA" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
              </div>

              {/* Bouton Lancer */}
              {depositProvider && (() => {
                const phone = depositProvider === 'mtn' ? depositPhoneMtn : depositPhoneOrange;
                const val = parseFloat(amount);
                const dialUrl = buildDepositDialUrl(depositProvider, phone, amount);
                const canProceed = !!depositProvider && val > 0 && !!dialUrl;
                return (
                  <div style={{ marginBottom: 12 }}>
                    {phone ? (
                      <a
                        href={dialUrl || undefined}
                        className={styles.submitBtn}
                        style={{ display: 'block', textAlign: 'center', textDecoration: 'none', background: depositProvider === 'mtn' ? 'linear-gradient(135deg,#FFCC00,#E6A800)' : 'linear-gradient(135deg,#FF6600,#CC4400)', color: depositProvider === 'mtn' ? '#1a1000' : '#fff', opacity: canProceed ? 1 : 0.5, pointerEvents: canProceed ? 'auto' : 'none' }}
                        onClick={() => {
                          if (canProceed) {
                            saveDepotDraft('confirm', depositProvider, amount);
                            setDepositStep('confirm');
                          }
                        }}
                      >
                        Continuer vers la confirmation
                      </a>
                    ) : (
                      <button className={styles.submitBtn} disabled={!canProceed} onClick={() => { if (canProceed) { saveDepotDraft('confirm', depositProvider, amount); setDepositStep('confirm'); } }}>
                        Continuer vers la confirmation
                      </button>
                    )}
                    <div className={styles.stepNote} style={{ marginTop: 8 }}>Après le paiement sur votre téléphone, revenez ici pour confirmer.</div>
                  </div>
                );
              })()}
            </>
          )}

          {depositStep === 'confirm' && (
            <>
              {/* Bannière de reprise si session restaurée depuis localStorage */}
              {draftResumed && (
                <div className={styles.infoBox} style={{ marginTop: 6, marginBottom: 0, background: 'rgba(30,86,227,0.08)', borderColor: 'rgba(30,86,227,0.25)' }}>
                  <div className={styles.infoRow} style={{ color: 'var(--accent)', fontWeight: 700 }}>
                    <span className={styles.infoDot} style={{ background: 'var(--accent)' }}/>Session récupérée — complétez la confirmation ci-dessous
                  </div>
                </div>
              )}
              <div className={styles.infoBox} style={{ marginTop: 8, marginBottom: 14 }}>
                <div className={styles.infoRow}><span className={styles.infoDot}/>Réseau : <b style={{ marginLeft: 4 }}>{depositProvider === 'mtn' ? 'MTN MoMo' : 'Orange Money'}</b></div>
                <div className={styles.infoRow}><span className={styles.infoDot}/>Montant envoyé : <b style={{ marginLeft: 4 }}>{fmt(parseFloat(amount))} FCFA</b></div>
              </div>

              {/* ID transaction */}
              <div className={styles.stepCard}>
                <div className={styles.stepNum}>1</div>
                <div className={styles.stepContent}>
                  <div className={styles.stepTitle}>ID de la transaction</div>
                  <div className={styles.stepDesc}>Copiez l'identifiant de transaction reçu par SMS (ex: CI24XXXXXX).</div>
                  <input className={styles.modalInput} type="text" placeholder="ID de transaction" value={depositTransactionId} onChange={e => setDepositTransactionId(e.target.value)} />
                </div>
              </div>

              {/* Capture */}
              <div className={styles.stepCard}>
                <div className={styles.stepNum}>2</div>
                <div className={styles.stepContent}>
                  <div className={styles.stepTitle}>Capture d'écran du SMS de confirmation</div>
                  <label className={styles.uploadLabel}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    {proofFile ? proofFile.name : 'Importer la capture'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setProofFile(e.target.files?.[0] || null)} />
                  </label>
                  {proofFile && <img src={URL.createObjectURL(proofFile)} alt="Preuve" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12, marginTop: 10 }} />}
                </div>
              </div>

              <button
                className={styles.submitBtn}
                style={{ marginTop: 8, marginBottom: 24 }}
                onClick={async () => {
                  const val = parseFloat(amount);
                  if (!val || val <= 0) { showToast('Montant invalide'); return; }
                  if (!depositTransactionId.trim()) { showToast('Saisissez l\'ID de la transaction'); return; }
                  if (!proofFile) { showToast('Joignez la capture de confirmation'); return; }
                  setLoading(true);
                  try {
                    const formData = new FormData();
                    formData.append('amount', String(val));
                    formData.append('provider', depositProvider);
                    formData.append('transactionId', depositTransactionId.trim());
                    formData.append('proof', proofFile);
                    await api.post('/deposits', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                    setAmount(''); setProofFile(null); setDepositTransactionId(''); setDepositProvider(''); setDepositStep('init');
                    showToast('Dépôt soumis ! En attente de validation.');
                    await fetchData();
                    goTo('accueil');
                  } catch (e: any) { showToast(e.response?.data?.message || 'Erreur'); }
                  finally { setLoading(false); }
                }}
                disabled={loading}
              >
                {loading ? '...' : 'Confirmer le dépôt'}
              </button>
            </>
          )}
        </section>

        {/* RETRAIT */}
        <section className={`screen ${screen === 'retrait' ? 'active' : ''}`}>
          <div className="topbar">
            <button className={styles.backBtn} onClick={() => goTo('accueil')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div><div className="greet-label">Retrait</div><div className="greet-name">Retirer mes fonds</div></div>
          </div>

          <div className={styles.walletHero} style={{ marginTop: 6 }}>
            <div className={styles.walletLabel}>Solde disponible</div>
            <div className={styles.walletAmount}>{fmt(balance)} <span>FCFA</span></div>
          </div>

          <div className={styles.infoBox} style={{ marginTop: 14 }}>
            <div className={styles.infoRow}><span className={styles.infoDot}/>Montant minimum : 2 000 FCFA</div>
            <div className={styles.infoRow}><span className={styles.infoDot}/>Frais de retrait : 20% déduits du montant</div>
            <div className={styles.infoRow}><span className={styles.infoDot}/>Retraits disponibles : lundi – samedi</div>
            <div className={styles.infoRow}><span className={styles.infoDot}/>Versement sur votre compte Mobile Money</div>
          </div>

          {!withdrawalAccount ? (
            /* Pas de compte configuré */
            <div style={{ marginTop: 16 }}>
              <div className={styles.stepCard}>
                <div className={styles.stepNum}>!</div>
                <div className={styles.stepContent}>
                  <div className={styles.stepTitle}>Configurer votre compte de retrait</div>
                  <div className={styles.stepDesc}>Ce numéro sera définitif et ne pourra plus être modifié après enregistrement. Saisissez attentivement.</div>
                  <input className={styles.modalInput} type="tel" placeholder="Numéro de compte (ex: +237670000000)" value={withdrawAccountNumber} onChange={e => setWithdrawAccountNumber(e.target.value)} style={{ marginBottom: 10 }} />
                  <input className={styles.modalInput} type="text" placeholder="Nom complet du titulaire" value={withdrawAccountName} onChange={e => setWithdrawAccountName(e.target.value)} />
                </div>
              </div>

              {withdrawAccountNumber && withdrawAccountName && !withdrawAccountConfirm && (
                <div className={styles.infoBox} style={{ background: 'rgba(245,100,100,0.07)', borderColor: 'rgba(245,100,100,0.2)', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#f87171' }}>Attention — Action irréversible</div>
                  <div className={styles.infoRow}><span className={styles.infoDot} style={{ background: '#f87171' }}/>Numéro : {withdrawAccountNumber}</div>
                  <div className={styles.infoRow}><span className={styles.infoDot} style={{ background: '#f87171' }}/>Titulaire : {withdrawAccountName}</div>
                  <div className={styles.infoRow}><span className={styles.infoDot} style={{ background: '#f87171' }}/>Ce numéro sera verrouillé et ne pourra plus être changé.</div>
                  <button className={styles.submitBtn} style={{ marginTop: 12, background: 'linear-gradient(135deg,#dc2626,#991b1b)' }} onClick={() => setWithdrawAccountConfirm(true)}>
                    Je confirme, enregistrer définitivement
                  </button>
                </div>
              )}

              {withdrawAccountConfirm && (
                <button className={styles.submitBtn} style={{ marginBottom: 24 }} onClick={async () => {
                  if (!withdrawAccountNumber.trim() || !withdrawAccountName.trim()) { showToast('Remplissez tous les champs'); return; }
                  setLoading(true);
                  try {
                    const res = await api.post('/withdrawal-accounts', { accountNumber: withdrawAccountNumber.trim(), accountName: withdrawAccountName.trim() });
                    setWithdrawalAccount(res.data);
                    setWithdrawAccountNumber(''); setWithdrawAccountName(''); setWithdrawAccountConfirm(false);
                    localStorage.removeItem(RETRAIT_SETUP_KEY);
                    showToast('Compte de retrait enregistré');
                  } catch (e: any) { showToast(e.response?.data?.message || 'Erreur'); }
                  finally { setLoading(false); }
                }} disabled={loading}>
                  {loading ? '...' : 'Enregistrer le compte'}
                </button>
              )}
            </div>
          ) : (
            /* Compte configuré */
            <div style={{ marginTop: 16 }}>
              <div className={styles.rulesCard}>
                <div className={styles.rulesTitle}>Compte de destination</div>
                <div className={styles.ruleItem}><div className={styles.ruleDot} />Numéro : <b style={{ marginLeft: 4 }}>{withdrawalAccount.accountNumber}</b></div>
                <div className={styles.ruleItem}><div className={styles.ruleDot} />Titulaire : <b style={{ marginLeft: 4 }}>{withdrawalAccount.accountName}</b></div>
                <div className={styles.ruleItem}><div className={styles.ruleDot} style={{ background: '#f87171' }} /><span style={{ color: '#f87171', fontSize: 11 }}>Verrouillé — contactez le support pour modifier</span></div>
              </div>

              <div className={styles.stepCard} style={{ marginTop: 14 }}>
                <div className={styles.stepNum}>1</div>
                <div className={styles.stepContent}>
                  <div className={styles.stepTitle}>Montant à retirer</div>
                  <input
                    className={styles.modalInput}
                    type="number"
                    placeholder="Montant en FCFA (min 2 000)"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                  {amount && parseFloat(amount) >= 2000 && (
                    <div className={styles.feePreview}>
                      <div className={styles.feeRow}><span>Montant demandé</span><span>{fmt(parseFloat(amount))} FCFA</span></div>
                      <div className={styles.feeRow}><span>Frais 20%</span><span className={styles.feeNeg}>-{fmt(Math.round(parseFloat(amount) * 0.2))} FCFA</span></div>
                      <div className={`${styles.feeRow} ${styles.feeTotal}`}><span>Vous recevrez</span><span className={styles.feePos}>{fmt(Math.round(parseFloat(amount) * 0.8))} FCFA</span></div>
                    </div>
                  )}
                </div>
              </div>

              <button
                className={styles.submitBtn}
                style={{ marginTop: 8, marginBottom: 16, background: 'linear-gradient(135deg,#1E56E3,#1040B8)' }}
                onClick={async () => {
                  const val = parseFloat(amount);
                  if (!val || val < 2000) { showToast('Montant minimum : 2 000 FCFA'); return; }
                  if (val > balance) { showToast('Solde insuffisant'); return; }
                  setLoading(true);
                  try {
                    const res = await api.post('/withdrawal-requests', { amount: val });
                    setBalance(res.data.balance);
                    setAmount('');
                    await fetchData();
                    showToast('Demande de retrait envoyée — en attente de traitement');
                    goTo('accueil');
                  } catch (e: any) { showToast(e.response?.data?.message || 'Erreur'); }
                  finally { setLoading(false); }
                }}
                disabled={loading || parseFloat(amount) < 2000 || parseFloat(amount) > balance}
              >
                {loading ? '...' : 'Envoyer la demande de retrait'}
              </button>

              {/* Historique des retraits */}
              {withdrawalRequests.length > 0 && (
                <>
                  <div className="sec-head" style={{ marginTop: 4 }}><div className="sec-title">Mes demandes de retrait</div></div>
                  {withdrawalRequests.map(wr => (
                    <div key={wr.id} className={styles.txRow}>
                      <div className={`${styles.txIcon} ${styles.txOut}`}>R</div>
                      <div className={styles.txInfo}>
                        <div className={styles.txName}>{fmt(Number(wr.amount))} FCFA → {fmt(Number(wr.netAmount))} net</div>
                        <div className={styles.txDate}>{new Date(wr.createdAt).toLocaleDateString('fr-FR')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: wr.status === 'completed' ? 'rgba(0,232,196,0.1)' : wr.status === 'rejected' ? 'rgba(248,113,113,0.1)' : 'rgba(245,197,107,0.1)', color: wr.status === 'completed' ? 'var(--cyan)' : wr.status === 'rejected' ? '#f87171' : 'var(--gold)' }}>
                          {wr.status === 'completed' ? 'Validé' : wr.status === 'rejected' ? 'Rejeté' : 'En attente'}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </section>

        {/* PROFIL */}
        <section className={`screen ${screen === 'profil' ? 'active' : ''}`}>
          <div className="topbar"><div><div className="greet-label">Profil</div><div className="greet-name">Mon compte</div></div></div>

          <div className={styles.profileCard}>
            <div className={styles.profileAvatar}>{initials(user?.name ?? 'U')}</div>
            <div className={styles.profileName}>{user?.name}</div>
            <div className={styles.profileEmail}>{user?.email}</div>
          </div>

          {/* Modifier les informations */}
          <div className="sec-head" style={{ marginTop: 20 }}><div className="sec-title">Informations personnelles</div></div>
          <div className={styles.stepCard}>
            <div className={styles.stepContent} style={{ width: '100%' }}>
              <div style={{ marginBottom: 10 }}>
                <label className={styles.modalInputLabel}>Nom complet</label>
                <input className={styles.modalInput} type="text" value={profileEdit.name} onChange={e => setProfileEdit({ ...profileEdit, name: e.target.value })} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label className={styles.modalInputLabel}>Adresse e-mail</label>
                <input className={styles.modalInput} type="email" value={profileEdit.email} onChange={e => setProfileEdit({ ...profileEdit, email: e.target.value })} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label className={styles.modalInputLabel}>Téléphone</label>
                <input className={styles.modalInput} type="tel" value={profileEdit.phone} onChange={e => setProfileEdit({ ...profileEdit, phone: e.target.value })} />
              </div>
              <button className={styles.submitBtn} style={{ marginTop: 4 }} disabled={loading} onClick={async () => {
                setLoading(true);
                try {
                  await api.patch('/users/me', { name: profileEdit.name, email: profileEdit.email, phone: profileEdit.phone });
                  showToast('Informations mises à jour');
                  await fetchData();
                } catch (e: any) { showToast(e.response?.data?.message || 'Erreur'); }
                finally { setLoading(false); }
              }}>{loading ? '...' : 'Enregistrer les modifications'}</button>
            </div>
          </div>

          {/* Changer le mot de passe */}
          <div className="sec-head" style={{ marginTop: 10 }}><div className="sec-title">Sécurité</div></div>
          <div className={styles.stepCard}>
            <div className={styles.stepContent} style={{ width: '100%' }}>
              <div style={{ marginBottom: 10 }}>
                <label className={styles.modalInputLabel}>Mot de passe actuel</label>
                <input className={styles.modalInput} type="password" placeholder="••••••" value={pwdForm.old} onChange={e => setPwdForm({ ...pwdForm, old: e.target.value })} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label className={styles.modalInputLabel}>Nouveau mot de passe</label>
                <input className={styles.modalInput} type="password" placeholder="••••••" value={pwdForm.new1} onChange={e => setPwdForm({ ...pwdForm, new1: e.target.value })} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label className={styles.modalInputLabel}>Confirmer le nouveau mot de passe</label>
                <input className={styles.modalInput} type="password" placeholder="••••••" value={pwdForm.new2} onChange={e => setPwdForm({ ...pwdForm, new2: e.target.value })} />
              </div>
              <button className={styles.submitBtn} style={{ marginTop: 4, background: 'linear-gradient(135deg,#1E56E3,#1040B8)' }} disabled={loading} onClick={async () => {
                if (!pwdForm.old || !pwdForm.new1) { showToast('Remplissez tous les champs'); return; }
                if (pwdForm.new1 !== pwdForm.new2) { showToast('Les mots de passe ne correspondent pas'); return; }
                if (pwdForm.new1.length < 8) { showToast('Le mot de passe doit faire au moins 8 caractères'); return; }
                setLoading(true);
                try {
                  await api.patch('/users/me/password', { oldPassword: pwdForm.old, newPassword: pwdForm.new1 });
                  setPwdForm({ old: '', new1: '', new2: '' });
                  showToast('Mot de passe modifié');
                } catch (e: any) { showToast(e.response?.data?.message || 'Erreur'); }
                finally { setLoading(false); }
              }}>{loading ? '...' : 'Modifier le mot de passe'}</button>
            </div>
          </div>

          {/* Historique dépôts */}
          {myDeposits.length > 0 && (
            <>
              <div className="sec-head" style={{ marginTop: 10 }}><div className="sec-title">Historique des dépôts</div></div>
              {myDeposits.slice(0, 10).map(d => (
                <div key={d.id} className={styles.txRow}>
                  <div className={`${styles.txIcon} ${styles.txIn}`}>D</div>
                  <div className={styles.txInfo}>
                    <div className={styles.txName}>{fmt(Number(d.amount))} FCFA {d.provider ? `(${d.provider.toUpperCase()})` : ''}</div>
                    <div className={styles.txDate}>{new Date(d.createdAt).toLocaleDateString('fr-FR')}{d.transactionId ? ` • ID: ${d.transactionId}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: d.status === 'approved' ? 'rgba(0,232,196,0.1)' : d.status === 'rejected' ? 'rgba(248,113,113,0.1)' : 'rgba(245,197,107,0.1)', color: d.status === 'approved' ? 'var(--cyan)' : d.status === 'rejected' ? '#f87171' : 'var(--gold)' }}>
                      {d.status === 'approved' ? 'Validé' : d.status === 'rejected' ? 'Rejeté' : 'En attente'}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          <div className={styles.rulesCard} style={{ marginTop: 14 }}>
            <div className={styles.rulesTitle}>Conditions & frais</div>
            <div className={styles.ruleItem}><div className={styles.ruleDot} />Revenus crédités chaque jour à minuit</div>
            <div className={styles.ruleItem}><div className={styles.ruleDot} />3% de maintenance prélevés sur les bénéfices journaliers</div>
            <div className={styles.ruleItem}><div className={styles.ruleDot} />Retraits : lundi - samedi, min 2 000 FCFA, frais 20%</div>
            <div className={styles.ruleItem}><div className={styles.ruleDot} />Parrainage : 15% du premier dépôt, filleuls illimités</div>
          </div>

          <div style={{ marginTop: 14, marginBottom: 24 }}>
            <div className={styles.menuRow} onClick={() => setShowTerms(true)}>
              <div className={styles.mi}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></svg></div>
              <div className={styles.menuText}><div className={styles.menuTitle}>Conditions d'utilisation</div><div className={styles.menuSub}>CGU et politique de confidentialite</div></div>
              <span className={styles.arrow}>&rsaquo;</span>
            </div>
            <div className={styles.menuRow} onClick={() => goTo('familial')}>
              <div className={styles.mi}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></div>
              <div className={styles.menuText}><div className={styles.menuTitle}>Plan familial</div><div className={styles.menuSub}>Arbre de parrainage</div></div>
              <span className={styles.arrow}>&rsaquo;</span>
            </div>
            <div className={styles.menuRow} onClick={() => { logout(); navigate('/'); }}>
              <div className={styles.mi}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg></div>
              <div className={styles.menuText}><div className={styles.menuTitle}>Déconnexion</div><div className={styles.menuSub}>Se déconnecter de l'application</div></div>
              <span className={styles.arrow}>&rsaquo;</span>
            </div>
          </div>
        </section>
      </div>


      {/* MODAL PLAN */}
      {selected && (() => {
        const minInvest = Math.max(2000, selected.amount);
        const customAmt = parseFloat(amount);
        const investAmt = (!isNaN(customAmt) && customAmt >= minInvest) ? customAmt : minInvest;
        const dailyBrut = Math.round(investAmt * selected.dailyRatePercent / 100);
        const dailyNet = Math.round(dailyBrut * 0.97);
        const monthlyNet = Math.round(dailyNet * selected.monthDays);
        const canInvest = investAmt <= balance && (!isNaN(customAmt) ? customAmt >= minInvest : true);
        return (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setAmount(''); localStorage.removeItem(INVEST_KEY); } }}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <div className={styles.modalHead}>
              <div className={styles.modalIcon}>{selected.platform.slice(0, 2)}</div>
              <div>
                <div className={styles.modalTitle}>{selected.platform} - {selected.planType}</div>
                <div className={styles.modalCat}>Taux journalier : {selected.dailyRatePercent}% — durée {selected.monthDays} jours</div>
              </div>
            </div>
            <div className={styles.modalInputWrap}>
              <label className={styles.modalInputLabel}>Montant à investir (min. {fmt(minInvest)} FCFA)</label>
              <input
                className={styles.modalInput}
                type="number"
                placeholder={String(minInvest)}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min={minInvest}
              />
            </div>
            <div className={styles.modalStats}>
              <div className={styles.mStat}><div className={styles.lbl}>Capital</div><div className={styles.val}>{fmt(investAmt)} FCFA</div></div>
              <div className={styles.mStat}><div className={styles.lbl}>Taux/jour</div><div className={styles.val}>{selected.dailyRatePercent}%</div></div>
              <div className={styles.mStat}><div className={styles.lbl}>Net/jour</div><div className={styles.val}>{fmt(dailyNet)} FCFA</div></div>
              <div className={styles.mStat}><div className={styles.lbl}>Net/mois</div><div className={styles.val}>{fmt(monthlyNet)} FCFA</div></div>
            </div>
            <div className={styles.warningBox}>3% de frais de maintenance prélevés quotidiennement sur les gains.</div>
            <button className={styles.investBtn} onClick={invest} disabled={loading || !canInvest}>
              {loading ? '...' : !canInvest ? (investAmt > balance ? 'Solde insuffisant' : `Min. ${fmt(minInvest)} FCFA`) : `Investir ${fmt(investAmt)} FCFA`}
            </button>
          </div>
        </div>
        );
      })()}

      {showTerms && (
        <div className="modal-overlay open">
          <div className={styles.termsSheet}>
            <div className="modal-handle" />
            <div className={styles.modalTitle}>Conditions d'utilisation et confidentialite</div>
            <div className={styles.termsText}>{TERMS_TEXT}{REVENUE_PLAN_TEXT}</div>
            <button className={styles.submitBtn} onClick={acceptTerms}>J'ai lu et j'accepte</button>
          </div>
        </div>
      )}

      <div className={`toast ${toast ? 'show' : ''}`}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{toast}</div>
      </div>

      <div className="navbar">
        <div className="navbar-inner">
          <div className="nav-indicator" style={{ width: 'calc((100% - 16px)/5)', transform: `translateX(${Math.max(0, ['accueil', 'plans', 'wallet', 'familial', 'profil'].indexOf(screen)) * 100}%)` }} />
          {[
            { id: 'accueil', label: 'Accueil', icon: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></> },
            { id: 'plans', label: 'Plans', icon: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></> },
            { id: 'wallet', label: 'Wallet', icon: <><path d="M3 7h18M3 7v12a1 1 0 001 1h16a1 1 0 001-1V7M3 7l2-4h14l2 4" /><path d="M9 12h6" /></> },
            { id: 'familial', label: 'Famille', icon: <><path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></> },
            { id: 'profil', label: 'Profil', icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></> },
          ].map(item => (
            <button key={item.id} className={`nav-item ${screen === item.id ? 'active' : ''}`} onClick={() => goTo(item.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{item.icon}</svg>
              <span className="n-lbl">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
