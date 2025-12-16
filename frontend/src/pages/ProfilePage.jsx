import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Building2, 
  MapPin, 
  Phone, 
  FileText, 
  Lock, 
  Save, 
  Loader2,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authService } from '../services/authService';

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 }
  }
};

export default function ProfilePage() {
  const { admin, updateAdmin } = useAuth();
  const { success: showSuccess, error: showError } = useToast();

  // Profile form state
  const [profile, setProfile] = useState({
    firmName: '',
    firmAddress: '',
    firmPhone: '',
    firmGSTIN: ''
  });
  const [profileLoading, setProfileLoading] = useState(false);

  // Password form state
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Load admin data into form
  useEffect(() => {
    if (admin) {
      setProfile({
        firmName: admin.firmName || '',
        firmAddress: admin.firmAddress || '',
        firmPhone: admin.firmPhone || '',
        firmGSTIN: admin.firmGSTIN || ''
      });
    }
  }, [admin]);

  // Handle profile update
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileLoading(true);

    try {
      const result = await authService.updateProfile(profile);
      if (result.success) {
        updateAdmin(result.admin);
        showSuccess('Profile updated successfully!');
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle password change
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/30">
          <User className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Profile Settings</h1>
          <p className="text-slate-400 text-sm">Manage your account and business details</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Details Card */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="glass-card p-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Business Details</h2>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {/* Email (Read-only) */}
            <div>
              <label className="label flex items-center gap-2 mb-2">
                <User size={14} className="text-slate-400" />
                Email Address
              </label>
              <input
                type="email"
                value={admin?.email || ''}
                disabled
                className="input bg-slate-900/50 cursor-not-allowed opacity-70"
              />
              <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
            </div>

            {/* Firm Name */}
            <div>
              <label className="label flex items-center gap-2 mb-2">
                <Building2 size={14} className="text-slate-400" />
                Firm Name
              </label>
              <input
                type="text"
                value={profile.firmName}
                onChange={(e) => setProfile({ ...profile, firmName: e.target.value })}
                className="input"
                placeholder="Your Business Name"
              />
            </div>

            {/* Firm Phone */}
            <div>
              <label className="label flex items-center gap-2 mb-2">
                <Phone size={14} className="text-slate-400" />
                Phone Number
              </label>
              <input
                type="tel"
                value={profile.firmPhone}
                onChange={(e) => setProfile({ ...profile, firmPhone: e.target.value })}
                className="input"
                placeholder="+91 9876543210"
              />
            </div>

            {/* Firm GSTIN */}
            <div>
              <label className="label flex items-center gap-2 mb-2">
                <FileText size={14} className="text-slate-400" />
                GSTIN
              </label>
              <input
                type="text"
                value={profile.firmGSTIN}
                onChange={(e) => setProfile({ ...profile, firmGSTIN: e.target.value.toUpperCase() })}
                className="input"
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
              />
            </div>

            {/* Firm Address */}
            <div>
              <label className="label flex items-center gap-2 mb-2">
                <MapPin size={14} className="text-slate-400" />
                Business Address
              </label>
              <textarea
                value={profile.firmAddress}
                onChange={(e) => setProfile({ ...profile, firmAddress: e.target.value })}
                className="input min-h-[80px] resize-none"
                placeholder="Enter your business address"
                rows={3}
              />
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={profileLoading}
              whileHover={{ scale: profileLoading ? 1 : 1.02 }}
              whileTap={{ scale: profileLoading ? 1 : 0.98 }}
              className="btn w-full py-3 font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
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
          </form>
        </motion.div>

        {/* Change Password Card */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.1 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Change Password</h2>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* Current Password */}
            <div>
              <label className="label flex items-center gap-2 mb-2">
                <Lock size={14} className="text-slate-400" />
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwords.currentPassword}
                  onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                  className="input pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-blue-400 transition-colors"
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="label flex items-center gap-2 mb-2">
                <Lock size={14} className="text-slate-400" />
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                  className="input pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-blue-400 transition-colors"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Minimum 6 characters</p>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="label flex items-center gap-2 mb-2">
                <CheckCircle size={14} className="text-slate-400" />
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                className="input"
                placeholder="••••••••"
              />
              {passwords.newPassword && passwords.confirmPassword && (
                <p className={`text-xs mt-1 ${passwords.newPassword === passwords.confirmPassword ? 'text-emerald-400' : 'text-red-400'}`}>
                  {passwords.newPassword === passwords.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={passwordLoading || !passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword}
              whileHover={{ scale: passwordLoading ? 1 : 1.02 }}
              whileTap={{ scale: passwordLoading ? 1 : 0.98 }}
              className="btn w-full py-3 font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {passwordLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Changing...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Change Password
                </>
              )}
            </motion.button>
          </form>

          {/* Security Note */}
          <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <p className="text-xs text-slate-400">
              <strong className="text-slate-300">Security Tip:</strong> Use a strong password with a mix of letters, numbers, and special characters. Never share your password with anyone.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
