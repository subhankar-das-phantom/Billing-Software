import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Gift, 
  Copy, 
  Share2, 
  CheckCircle2, 
  Users, 
  Clock, 
  Award,
  Sparkles,
  ArrowRight,
  Info
} from 'lucide-react';
import { subscriptionService } from '../../services/saas/subscriptionService';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useToast } from '../../contexts/ToastContext';

export default function ReferralPage() {
  const [referralCode, setReferralCode] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applyCodeStr, setApplyCodeStr] = useState('');
  const [applying, setApplying] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [hideApplyCode, setHideApplyCode] = useState(false);
  
  const { isTrial } = useSubscription();
  const { success: showSuccess, error: showError } = useToast();

  const fetchReferralData = useCallback(async () => {
    try {
      setLoading(true);
      const [codeRes, statsRes] = await Promise.all([
        subscriptionService.getReferralCode(),
        subscriptionService.getReferralStats()
      ]);

      if (codeRes.success) {
        setReferralCode(codeRes.referralCode);
      }
      if (statsRes.success) {
        setStats(statsRes);
      }
    } catch (err) {
      console.error('Failed to fetch referral data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReferralData();
  }, [fetchReferralData]);

  const handleApplyCode = async (e) => {
    e.preventDefault();
    if (!applyCodeStr) return;
    
    setApplying(true);
    try {
      const res = await subscriptionService.applyReferralCode(applyCodeStr);
      if (res.success) {
        showSuccess('Referral code applied! You will get 15 extra days on your first purchase.');
        setHideApplyCode(true);
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to apply code');
      if (err.response?.data?.message?.includes('already used')) {
        setHideApplyCode(true); // Don't show if they already applied one
      }
    } finally {
      setApplying(false);
      setApplyCodeStr('');
    }
  };

  const shareLink = `${window.location.origin}/#/register?ref=${referralCode}`;

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      showSuccess('Referral link copied!');
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      showSuccess('Referral code copied!');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-4 lg:p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 lg:p-8 overflow-y-auto bg-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <Gift className="w-8 h-8 text-emerald-400" />
              Refer & Earn Free Days
            </h1>
            <p className="text-slate-400 mt-1 flex items-center gap-2">
              Share your link and earn 30 free days for every shop that subscribes.
            </p>
          </div>
        </div>

        {/* Top Section: Code & Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Share Card */}
          <div className="lg:col-span-1 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between shadow-xl">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
            
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Your Referral Code</h2>
              </div>
              
              <div className="bg-slate-900/80 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between group hover:border-emerald-500/60 transition-all">
                <span className="text-2xl font-black tracking-wider text-emerald-400">{referralCode}</span>
                <button 
                  onClick={() => copyToClipboard(referralCode, 'code')}
                  className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-all"
                  title="Copy Code"
                >
                  {copiedCode ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">Share your link</p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={shareLink} 
                  className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none"
                />
                <button
                  onClick={() => copyToClipboard(shareLink, 'link')}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-medium shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                >
                  {copiedLink ? <CheckCircle2 className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                  {copiedLink ? 'Copied' : 'Share'}
                </button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-slate-400 font-medium text-sm">Total Signups</h3>
              </div>
              <p className="text-3xl font-bold text-white mt-2">{stats?.totalReferred || 0}</p>
            </div>
            
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-slate-400 font-medium text-sm">Pending Rewards</h3>
              </div>
              <p className="text-3xl font-bold text-white mt-2">{stats?.pending || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Awaiting first purchase</p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 flex flex-col justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
              <div className="flex items-center gap-3 mb-2 relative z-10">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Award className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-slate-400 font-medium text-sm">Days Earned</h3>
              </div>
              <p className="text-3xl font-bold text-emerald-400 mt-2 relative z-10">
                +{(stats?.totalRewarded || 0) * 30}
              </p>
              <p className="text-xs text-emerald-500/70 mt-1 relative z-10">{stats?.totalRewarded || 0} successful referrals</p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Rules & History & Apply Code */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Rules & Apply Code */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* How It Works */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Info className="w-5 h-5 text-slate-400" />
                <h2 className="text-lg font-bold text-white">How It Works</h2>
              </div>
              
              <ul className="space-y-6 relative before:absolute before:inset-y-2 before:left-[11px] before:w-px before:bg-slate-700">
                <li className="flex gap-4 relative z-10">
                  <div className="w-6 h-6 rounded-full bg-slate-800 border-2 border-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-emerald-400">1</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Share your link</h4>
                    <p className="text-xs text-slate-400 mt-1">Send your unique code to another business owner.</p>
                  </div>
                </li>
                <li className="flex gap-4 relative z-10">
                  <div className="w-6 h-6 rounded-full bg-slate-800 border-2 border-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-emerald-400">2</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Friend signs up</h4>
                    <p className="text-xs text-slate-400 mt-1">They get 15 extra free days on their first purchase.</p>
                  </div>
                </li>
                <li className="flex gap-4 relative z-10">
                  <div className="w-6 h-6 rounded-full bg-slate-800 border-2 border-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-emerald-400">3</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Rewards automatically granted</h4>
                    <p className="text-xs text-emerald-400 mt-1 font-medium">You instantly get +30 free days added to your subscription!</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Apply Code */}
            {isTrial && !hideApplyCode && (
              <div className="bg-gradient-to-br from-indigo-900/30 to-blue-900/30 border border-indigo-500/20 rounded-2xl p-6">
                <h3 className="text-white font-bold mb-2">Have a referral code?</h3>
                <p className="text-xs text-indigo-200/70 mb-4">
                  Enter a friend's code to get 15 extra free days when you buy your first subscription!
                </p>
                <form onSubmit={handleApplyCode} className="flex gap-2">
                  <input
                    type="text"
                    value={applyCodeStr}
                    onChange={(e) => setApplyCodeStr(e.target.value.toUpperCase())}
                    placeholder="e.g. BE-A1B2C3"
                    className="flex-1 bg-slate-900/50 border border-indigo-500/30 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
                  />
                  <button
                    type="submit"
                    disabled={!applyCodeStr || applying}
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                  >
                    {applying ? 'Applying...' : 'Apply'}
                  </button>
                </form>
              </div>
            )}

          </div>

          {/* Reward Progress History */}
          <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Reward Progress</h2>
              <span className="px-2.5 py-1 rounded-md bg-slate-700/50 text-xs text-slate-300 font-medium">
                {stats?.referrals?.length || 0} Total Invites
              </span>
            </div>

            <div className="flex-1 p-0 overflow-x-auto">
              {stats?.referrals?.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center h-full text-slate-400">
                  <Users className="w-12 h-12 mb-3 text-slate-600" />
                  <p>You haven't referred anyone yet.</p>
                  <p className="text-sm mt-1">Share your code above to start earning free days!</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-800/80 text-slate-400 text-xs uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-4">Sign Up Date</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Reward Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 text-slate-300">
                    {stats?.referrals?.map((ref, idx) => {
                      const isPending = ref.status === 'pending';
                      const isRewarded = ref.status === 'rewarded';
                      
                      return (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                            {new Date(ref.createdAt).toLocaleDateString(undefined, { 
                              year: 'numeric', month: 'short', day: 'numeric' 
                            })}
                          </td>
                          <td className="px-6 py-4">
                            {isRewarded ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 font-medium text-xs border border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Rewarded
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 font-medium text-xs border border-amber-500/20">
                                <Clock className="w-3.5 h-3.5" /> Pending
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-400 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Signed Up
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-600" />
                              {isRewarded ? (
                                <span className="text-emerald-400 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Purchased Plan
                                </span>
                              ) : (
                                <span className="text-slate-500 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" /> Awaiting Purchase
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
