import axios from 'axios';
import { API_BASE_URL } from './base';

const BASE = `${API_BASE_URL}/admin`;

let _token = localStorage.getItem('admin_token') || '';
export function setAdminKey(k: string) { _token = k; localStorage.setItem('admin_token', k); }
export function clearAdminKey() { _token = ''; localStorage.removeItem('admin_token'); }
export function adminAuthHeaders() { return { Authorization: `Bearer ${_token}` }; }

const h = () => ({ headers: adminAuthHeaders() });

export const adminApi = {
  login: (email: string, password: string) => axios.post(`${API_BASE_URL}/auth/login`, { email, password }).then(r => r.data),

  // Dashboard & Analytics
  dashboard: () => axios.get(`${BASE}/dashboard`, h()).then(r => r.data),
  analytics: () => axios.get(`${BASE}/analytics`, h()).then(r => r.data),
  advancedAnalytics: () => axios.get(`${BASE}/analytics/advanced`, h()).then(r => r.data),

  // Deposits
  pendingDeposits: () => axios.get(`${BASE}/deposits/pending`, h()).then(r => r.data),
  deposits: (status?: string) => axios.get(`${BASE}/deposits${status ? `?status=${status}` : ''}`, h()).then(r => r.data),
  approveDeposit: (id: number, note?: string) => axios.post(`${BASE}/deposits/${id}/approve`, { note }, h()).then(r => r.data),
  rejectDeposit: (id: number, note?: string) => axios.post(`${BASE}/deposits/${id}/reject`, { note }, h()).then(r => r.data),

  // Users CRUD
  users: () => axios.get(`${BASE}/users`, h()).then(r => r.data),
  userDetail: (id: number) => axios.get(`${BASE}/users/${id}`, h()).then(r => r.data),
  adjustBalance: (id: number, amount: number, reason: string) =>
    axios.post(`${BASE}/users/${id}/balance`, { amount, reason }, h()).then(r => r.data),
  banUser: (id: number) => axios.post(`${BASE}/users/${id}/ban`, {}, h()).then(r => r.data),
  unbanUser: (id: number) => axios.post(`${BASE}/users/${id}/unban`, {}, h()).then(r => r.data),
  updateUser: (id: number, data: { name?: string; email?: string; phone?: string }) =>
    axios.put(`${BASE}/users/${id}`, data, h()).then(r => r.data),
  deleteUser: (id: number) => axios.delete(`${BASE}/users/${id}`, h()).then(r => r.data),

  // Transactions
  transactions: (limit = 200) => axios.get(`${BASE}/transactions?limit=${limit}`, h()).then(r => r.data),

  // Plans CRUD
  plans: () => axios.get(`${BASE}/plans`, h()).then(r => r.data),
  createPlan: (data: { slug: string; platform: string; planType: string; amount: number; dailyRatePercent: number; monthDays: number }) =>
    axios.post(`${BASE}/plans`, data, h()).then(r => r.data),
  updatePlan: (id: number, data: { amount?: number; dailyRatePercent?: number; monthDays?: number; active?: boolean }) =>
    axios.put(`${BASE}/plans/${id}`, data, h()).then(r => r.data),
  togglePlan: (id: number) => axios.post(`${BASE}/plans/${id}/toggle`, {}, h()).then(r => r.data),
  deletePlan: (id: number) => axios.delete(`${BASE}/plans/${id}`, h()).then(r => r.data),

  // Positions
  positions: (active = true) => axios.get(`${BASE}/positions?active=${active}`, h()).then(r => r.data),
  deactivatePosition: (id: number) => axios.post(`${BASE}/positions/${id}/deactivate`, {}, h()).then(r => r.data),

  // Settings
  getSettings: () => axios.get(`${BASE}/settings`, h()).then(r => r.data),
  updateSettings: (data: Record<string, string>) => axios.put(`${BASE}/settings`, data, h()).then(r => r.data),

  // Yield manuel
  triggerYield: () => axios.post(`${BASE}/yield/trigger`, {}, h()).then(r => r.data),

  // Referrals
  referrals: () => axios.get(`${BASE}/referrals`, h()).then(r => r.data),

  // Export CSV
  exportUsersUrl: () => `${BASE}/export/users`,
  exportTransactionsUrl: () => `${BASE}/export/transactions`,

  // AI
  aiReportPdfUrl: () => `${BASE}/ai/report/pdf`,

  // Withdrawal requests
  withdrawals: (status?: string) => axios.get(`${BASE}/withdrawals${status ? `?status=${status}` : ''}`, h()).then(r => r.data),
  completeWithdrawal: (id: number, note?: string) => axios.post(`${BASE}/withdrawals/${id}/complete`, { note }, h()).then(r => r.data),
  rejectWithdrawal: (id: number, note?: string) => axios.post(`${BASE}/withdrawals/${id}/reject`, { note }, h()).then(r => r.data),

  // Withdrawal accounts (admin override)
  unlockWithdrawalAccount: (userId: number) => axios.post(`${BASE}/withdrawal-accounts/${userId}/unlock`, {}, h()).then(r => r.data),
  updateWithdrawalAccount: (userId: number, data: { accountNumber: string; accountName: string }) =>
    axios.put(`${BASE}/withdrawal-accounts/${userId}`, data, h()).then(r => r.data),
};
