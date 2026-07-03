import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Building2, 
  MapPin, 
  Phone, 
  FileText, 
  Lock, 
  Save, 
  Loader2,
  CheckCircle,
  Eye,
  EyeOff,
  User,
  Calculator,
  Shield,
  Palette,
  Bell,
  ChevronRight,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { authService } from '../../services/auth/authService';
import { useMotionConfig } from '../../hooks';

export default function SettingsPage() {
  const { user, userRole, updateAdmin, updateUserPreferences } = useAuth();
  const { success: showSuccess, error: showError } = useToast();
  const motionConfig = useMotionConfig();

  const [activeTab, setActiveTab] = useState(userRole === 'admin' ? 'general' : 'preferences');

  // Profile form state (Admin only)
  const [profile, setProfile] = useState({
    firmName: '',
    firmAddress: '',
    firmPhone: '',
    firmGSTIN: '',
    paymentInformation: {
      enabled: false,
      upiId: '',
      accountNumber: '',
      ifscCode: ''
    }
  });
  const [profileLoading, setProfileLoading] = useState(false);

  // Preferences form state
  const [preferences, setPreferences] = useState({
    showCalculator: true
  });
  const [preferencesLoading, setPreferencesLoading] = useState(false);

  // Password form state
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Load user data into form
  useEffect(() => {
    if (userRole === 'admin' && user) {
      setProfile({
        firmName: user.firmName || '',
        firmAddress: user.firmAddress || '',
        firmPhone: user.firmPhone || '',
        firmGSTIN: user.firmGSTIN || '',
        paymentInformation: {
          enabled: user.paymentInformation?.enabled || false,
          upiId: user.paymentInformation?.upiId || '',
          accountNumber: user.paymentInformation?.accountNumber || '',
          ifscCode: user.paymentInformation?.ifscCode || ''
        }
      });
    }
    if (user && user.preferences) {
      setPreferences({
        showCalculator: user.preferences.showCalculator !== false
      });
    }
  }, [user, userRole]);

  // Handlers
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (userRole !== 'admin') return;
    
    setProfileLoading(true);
    const submitData = {
      ...profile,
      paymentInformation: {
        enabled: profile.paymentInformation.enabled,
        upiId: profile.paymentInformation.upiId.trim(),
        accountNumber: profile.paymentInformation.accountNumber.trim(),
        ifscCode: profile.paymentInformation.ifscCode.trim().toUpperCase()
      }
    };
    
    try {
      const result = await authService.updateProfile(submitData);
      if (result.success) {
        updateAdmin(result.admin);
        showSuccess('Business details updated successfully!');
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update business details');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleToggleCalculator = async () => {
    const newShowCalculator = !preferences.showCalculator;
    setPreferences({ ...preferences, showCalculator: newShowCalculator });
    setPreferencesLoading(true);
    
    try {
      const result = await authService.updatePreferences({ showCalculator: newShowCalculator });
      if (result.success) {
        updateUserPreferences({ showCalculator: newShowCalculator });
        showSuccess(`Calculator widget is now ${newShowCalculator ? 'visible' : 'hidden'}`);
      }
    } catch (err) {
      // Revert if failed
      setPreferences({ ...preferences, showCalculator: !newShowCalculator });
      showError(err.response?.data?.message || 'Failed to update preferences');
    } finally {
      setPreferencesLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwords.newPassword !== passwords.confirmPassword) {
      showError('New passwords do not match');
      return;
    }

    if (passwords.newPassword.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }

    setPasswordLoading(true);

    try {
      const result = await authService.changePassword(
        passwords.currentPassword,
        passwords.newPassword
      );
      if (result.success) {
        showSuccess('Password changed successfully!');
        setPasswords({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Tabs Configuration
  const tabs = [
    ...(userRole === 'admin' ? [{ id: 'general', label: 'General', icon: Building2, desc: 'Business details' }] : []),
    { id: 'preferences', label: 'Preferences', icon: Palette, desc: 'App customization' },
    { id: 'security', label: 'Security', icon: Shield, desc: 'Password & auth' }
  ];

  // Renderers for each tab
  const renderGeneralTab = () => (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-1">Business Details</h2>
        <p className="text-slate-400 text-sm">Update your company information, address, and GSTIN.</p>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 lg:p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative ambient gradient */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <form onSubmit={handleProfileSubmit} className="space-y-6 relative z-10">
          <div className="space-y-5">
            {/* Email (Read-only) */}
            <div className="group">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block group-focus-within:text-blue-400 transition-colors">
                Registered Email
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-4 text-slate-500">
                  <User size={18} />
                </div>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full bg-slate-950/50 border border-white/5 text-slate-400 pl-12 pr-4 py-3 rounded-xl cursor-not-allowed outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Firm Name */}
              <div className="group">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block group-focus-within:text-blue-400 transition-colors">
                  Business Name
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-slate-500 group-focus-within:text-blue-400 transition-colors">
                    <Building2 size={18} />
                  </div>
                  <input
                    type="text"
                    value={profile.firmName}
                    onChange={(e) => setProfile({ ...profile, firmName: e.target.value })}
                    className="w-full bg-slate-800/40 border border-white/5 text-white focus:bg-slate-800/80 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 pl-12 pr-4 py-3 rounded-xl transition-all outline-none placeholder:text-slate-600"
                    placeholder="Enter business name"
                  />
                </div>
              </div>

              {/* Firm Phone */}
              <div className="group">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block group-focus-within:text-blue-400 transition-colors">
                  Contact Number
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-slate-500 group-focus-within:text-blue-400 transition-colors">
                    <Phone size={18} />
                  </div>
                  <input
                    type="tel"
                    value={profile.firmPhone}
                    onChange={(e) => setProfile({ ...profile, firmPhone: e.target.value })}
                    className="w-full bg-slate-800/40 border border-white/5 text-white focus:bg-slate-800/80 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 pl-12 pr-4 py-3 rounded-xl transition-all outline-none placeholder:text-slate-600"
                    placeholder="+91 0000000000"
                  />
                </div>
              </div>
            </div>

            {/* Firm GSTIN */}
            <div className="group">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block group-focus-within:text-blue-400 transition-colors">
                GSTIN Number
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-4 text-slate-500 group-focus-within:text-blue-400 transition-colors">
                  <FileText size={18} />
                </div>
                <input
                  type="text"
                  value={profile.firmGSTIN}
                  onChange={(e) => setProfile({ ...profile, firmGSTIN: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-800/40 border border-white/5 text-white focus:bg-slate-800/80 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 pl-12 pr-4 py-3 rounded-xl transition-all outline-none uppercase font-mono placeholder:text-slate-600"
                  placeholder="22AAAAA0000A1Z5"
                  maxLength={15}
                />
              </div>
            </div>

            {/* Firm Address */}
            <div className="group">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block group-focus-within:text-blue-400 transition-colors">
                Business Address
              </label>
              <div className="relative flex">
                <div className="absolute left-4 top-4 text-slate-500 group-focus-within:text-blue-400 transition-colors">
                  <MapPin size={18} />
                </div>
                <textarea
                  value={profile.firmAddress}
                  onChange={(e) => setProfile({ ...profile, firmAddress: e.target.value })}
                  className="w-full bg-slate-800/40 border border-white/5 text-white focus:bg-slate-800/80 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 pl-12 pr-4 py-3 rounded-xl transition-all outline-none min-h-[100px] resize-none placeholder:text-slate-600"
                  placeholder="Enter full business address"
                />
              </div>
            </div>
          </div>

          {/* Payment Information Section */}
          <div className="pt-6 border-t border-white/5 space-y-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Payment Information</h3>
                <p className="text-xs text-slate-400">Add payment details to your invoices for direct payments.</p>
              </div>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={profile.paymentInformation.enabled}
                    onChange={(e) => setProfile({
                      ...profile,
                      paymentInformation: { ...profile.paymentInformation, enabled: e.target.checked }
                    })}
                  />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${profile.paymentInformation.enabled ? 'bg-blue-500' : 'bg-slate-700'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${profile.paymentInformation.enabled ? 'transform translate-x-4' : ''}`}></div>
                </div>
                <span className="ml-3 text-sm font-medium text-white select-none">Show on Invoice</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* UPI ID */}
              <div className="group">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block group-focus-within:text-blue-400 transition-colors">
                  UPI ID
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-slate-500 group-focus-within:text-blue-400 transition-colors">
                    <Phone size={18} />
                  </div>
                  <input
                    type="text"
                    value={profile.paymentInformation.upiId}
                    onChange={(e) => setProfile({
                      ...profile,
                      paymentInformation: { ...profile.paymentInformation, upiId: e.target.value }
                    })}
                    className="w-full bg-slate-800/40 border border-white/5 text-white focus:bg-slate-800/80 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 pl-12 pr-4 py-3 rounded-xl transition-all outline-none placeholder:text-slate-600"
                    placeholder="bharat@upi"
                  />
                </div>
              </div>

              {/* Account Number */}
              <div className="group">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block group-focus-within:text-blue-400 transition-colors">
                  Bank Account Number
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-slate-500 group-focus-within:text-blue-400 transition-colors">
                    <CreditCard size={18} />
                  </div>
                  <input
                    type="text"
                    value={profile.paymentInformation.accountNumber}
                    onChange={(e) => setProfile({
                      ...profile,
                      paymentInformation: { ...profile.paymentInformation, accountNumber: e.target.value }
                    })}
                    className="w-full bg-slate-800/40 border border-white/5 text-white focus:bg-slate-800/80 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 pl-12 pr-4 py-3 rounded-xl transition-all outline-none placeholder:text-slate-600"
                    placeholder="XXXXXXXX1234"
                  />
                </div>
              </div>

              {/* IFSC Code */}
              <div className="group">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block group-focus-within:text-blue-400 transition-colors">
                  IFSC Code
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-slate-500 group-focus-within:text-blue-400 transition-colors">
                    <Building2 size={18} />
                  </div>
                  <input
                    type="text"
                    value={profile.paymentInformation.ifscCode}
                    onChange={(e) => setProfile({
                      ...profile,
                      paymentInformation: { ...profile.paymentInformation, ifscCode: e.target.value.toUpperCase() }
                    })}
                    className="w-full bg-slate-800/40 border border-white/5 text-white focus:bg-slate-800/80 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 pl-12 pr-4 py-3 rounded-xl transition-all outline-none uppercase font-mono placeholder:text-slate-600"
                    placeholder="SBIN0001234"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <motion.button
              type="submit"
              disabled={profileLoading}
              whileHover={motionConfig.isMobile ? {} : { scale: profileLoading ? 1 : 1.02 }}
              whileTap={motionConfig.isMobile ? {} : { scale: profileLoading ? 1 : 0.98 }}
              className="px-6 py-3 font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.2)] flex items-center justify-center gap-2 transition-all min-w-[150px]"
            >
              {profileLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderPreferencesTab = () => (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-1">User Preferences</h2>
        <p className="text-slate-400 text-sm">Customize your dashboard and application experience.</p>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 lg:p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative ambient gradient */}
        <div className="absolute top-0 left-0 -ml-20 -mt-20 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-6 relative z-10">
          
          {/* Custom Pill Toggle for Calculator */}
          <div className="flex items-start sm:items-center justify-between p-5 bg-slate-950/40 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-fuchsia-500/10 rounded-xl shadow-[0_0_15px_rgba(217,70,239,0.1)]">
                <Calculator className="w-6 h-6 text-fuchsia-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">Floating Calculator</h3>
                <p className="text-sm text-slate-400 mt-0.5 max-w-sm">Keep a handy calculator accessible at all times on the bottom right of your screen.</p>
              </div>
            </div>
            
            <button 
              onClick={handleToggleCalculator}
              disabled={preferencesLoading}
              className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 focus-visible:ring-opacity-75 disabled:opacity-50 disabled:cursor-wait ${
                preferences.showCalculator ? 'bg-fuchsia-500' : 'bg-slate-700'
              }`}
            >
              <span className="sr-only">Toggle Calculator</span>
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out ${
                  preferences.showCalculator ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Placeholder for future preferences */}
          <div className="flex items-start sm:items-center justify-between p-5 bg-slate-950/40 rounded-2xl border border-white/5 opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-800 rounded-xl">
                <Bell className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">Email Notifications</h3>
                <p className="text-sm text-slate-400 mt-0.5 max-w-sm">Receive daily summaries and alerts. (Coming Soon)</p>
              </div>
            </div>
            <div className="h-7 w-14 rounded-full bg-slate-800" />
          </div>

        </div>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-1">Security Settings</h2>
        <p className="text-slate-400 text-sm">Manage your password and secure your account.</p>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 lg:p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative ambient gradient */}
        <div className="absolute bottom-0 right-0 -mr-20 -mb-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <form onSubmit={handlePasswordSubmit} className="space-y-6 relative z-10 max-w-xl">
          {/* Current Password */}
          <div className="group">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block group-focus-within:text-amber-400 transition-colors">
              Current Password
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-4 text-slate-500 group-focus-within:text-amber-400 transition-colors">
                <Lock size={18} />
              </div>
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={passwords.currentPassword}
                onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                className="w-full bg-slate-800/40 border border-white/5 text-white focus:bg-slate-800/80 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 pl-12 pr-12 py-3 rounded-xl transition-all outline-none placeholder:text-slate-600"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-4 text-slate-500 hover:text-white transition-colors"
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="group">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block group-focus-within:text-amber-400 transition-colors">
              New Password
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-4 text-slate-500 group-focus-within:text-amber-400 transition-colors">
                <Shield size={18} />
              </div>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                className="w-full bg-slate-800/40 border border-white/5 text-white focus:bg-slate-800/80 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 pl-12 pr-12 py-3 rounded-xl transition-all outline-none placeholder:text-slate-600"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-4 text-slate-500 hover:text-white transition-colors"
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2 ml-1">Must be at least 6 characters long.</p>
          </div>

          {/* Confirm New Password */}
          <div className="group">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block group-focus-within:text-amber-400 transition-colors">
              Confirm New Password
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-4 text-slate-500 group-focus-within:text-amber-400 transition-colors">
                <CheckCircle size={18} />
              </div>
              <input
                type="password"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                className="w-full bg-slate-800/40 border border-white/5 text-white focus:bg-slate-800/80 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 pl-12 pr-4 py-3 rounded-xl transition-all outline-none placeholder:text-slate-600"
                placeholder="Confirm new password"
              />
            </div>
            {passwords.newPassword && passwords.confirmPassword && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                className={`text-xs mt-2 ml-1 flex items-center gap-1 font-medium ${passwords.newPassword === passwords.confirmPassword ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {passwords.newPassword === passwords.confirmPassword ? '✓ Passwords match perfectly' : '✗ Passwords do not match'}
              </motion.p>
            )}
          </div>

          <div className="pt-4">
            <motion.button
              type="submit"
              disabled={passwordLoading || !passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword}
              whileHover={motionConfig.isMobile ? {} : { scale: passwordLoading ? 1 : 1.02 }}
              whileTap={motionConfig.isMobile ? {} : { scale: passwordLoading ? 1 : 0.98 }}
              className="w-full py-3 font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow-[0_0_20px_rgba(217,119,6,0.2)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {passwordLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Update Password
                </>
              )}
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto min-h-[calc(100vh-8rem)] flex flex-col">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-slate-400 mt-2">Manage your account, preferences, and security settings.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 flex-1">
        
        {/* Sidebar Navigation */}
        <div className="lg:w-72 flex-shrink-0">
          <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-3 shadow-xl sticky top-24">
            <nav className="flex flex-col gap-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 w-full text-left group ${
                      isActive ? 'bg-slate-800/80 shadow-md' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId={motionConfig.isMobile ? undefined : "activeTabIndicator"}
                        className="absolute left-0 w-1 h-8 bg-blue-500 rounded-r-full"
                        initial={false}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <div className={`p-2 rounded-lg transition-colors ${
                      isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400 group-hover:text-slate-300 group-hover:bg-slate-700'
                    }`}>
                      <tab.icon size={20} />
                    </div>
                    <div className="flex-1">
                      <span className={`block font-semibold text-sm transition-colors ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                      }`}>
                        {tab.label}
                      </span>
                      <span className="text-xs text-slate-500 truncate block mt-0.5">{tab.desc}</span>
                    </div>
                    <ChevronRight size={16} className={`transition-transform duration-300 ${
                      isActive ? 'text-blue-500 opacity-100 translate-x-1' : 'text-slate-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
                    }`} />
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          {activeTab === 'general' && renderGeneralTab()}
          {activeTab === 'preferences' && renderPreferencesTab()}
          {activeTab === 'security' && renderSecurityTab()}
        </div>

      </div>
    </div>
  );
}
