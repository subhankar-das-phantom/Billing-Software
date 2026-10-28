import { useState, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  UserPlus, 
  Mail, 
  Lock, 
  Building2,
  MapPin,
  Phone,
  FileText,
  ArrowLeft,
  ArrowRight, 
  Loader2, 
  Eye, 
  EyeOff,
  CheckCircle,
  Sparkles,
  Shield,
  KeyRound,
  AlertTriangle
} from 'lucide-react';
import { authService } from '../../services/auth/authService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { subscriptionService } from '../../services/saas/subscriptionService';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firmName: '',
    firmAddress: '',
    firmPhone: '',
    firmGSTIN: '',
    website: '',
    registrationSecret: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [registrationDisabled, setRegistrationDisabled] = useState(false);
  const [showSecretField, setShowSecretField] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { error: showError, success: showSuccess } = useToast();
  
  // Extract referral code from URL
  const refCode = useMemo(() => new URLSearchParams(location.search).get('ref'), [location.search]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const { updateAdmin } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.email || !formData.password) {
      showError('Please enter email and password');
      return;
    }

    if (formData.password.length < 8 || !/^(?=.*[a-zA-Z])(?=.*\d)/.test(formData.password)) {
      showError('Password must be at least 8 characters and contain both letters and numbers');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    if (!agreedToTerms) {
      showError('Please agree to the Privacy Policy and Terms & Conditions');
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword: _confirmPassword, ...registerData } = formData;
      const result = await authService.register(registerData);
      
      if (result?.success) {
        // Auto-login: Set user state
        if (result?.admin) {
          updateAdmin(result.admin);
        }
        
        // Apply referral code if present
        if (refCode) {
          try {
            await subscriptionService.applyReferralCode(refCode);
          } catch (refErr) {
            console.error('Failed to apply referral code:', refErr);
            // We don't block registration for a failed referral
          }
        }
        
        showSuccess('Account created successfully! Welcome to Bharat Enterprise.');
        navigate('/dashboard');
      }
    } catch (err) {
      // Check for registration disabled status
      if (err.statusCode === 403 || err.response?.data?.code === 'REGISTRATION_DISABLED') {
        setRegistrationDisabled(true);
        setShowSecretField(true);
        showError(err.message || 'Public registration is currently disabled. Please enter a valid registration key.');
      } else {
        // Show specific error message (e.g. rate limit breach, disposable email block, duplicate account)
        const errorMessage = err.message || 'Registration failed. Please try again.';
        showError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderInput = ({ name, label, icon, type = 'text', placeholder, showToggle = false }) => {
    const Icon = icon;
    const isPassword = name === 'password';
    const showPasswordState = isPassword ? showPassword : showConfirmPassword;
    const togglePassword = () => {
      if (isPassword) setShowPassword(!showPassword);
      else setShowConfirmPassword(!showConfirmPassword);
    };

    return (
      <div>
        <label className="label flex items-center gap-2 mb-2" htmlFor={name}>
          <Icon size={16} className="text-slate-400" />
          {label}
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon 
              size={18} 
              className={focusedField === name ? 'text-blue-500' : 'text-slate-400'} 
              style={{ transition: 'color 0.2s' }} 
            />
          </div>
          <input
            id={name}
            name={name}
            type={showToggle ? (showPasswordState ? 'text' : 'password') : type}
            value={formData[name]}
            onChange={handleChange}
            onFocus={() => setFocusedField(name)}
            onBlur={() => setFocusedField(null)}
            className={`input pl-10 transition-all focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 ${showToggle || formData[name] ? 'pr-10' : 'pr-4'}`}
            placeholder={placeholder}
            disabled={loading}
          />
          {showToggle ? (
            <button
              type="button"
              onClick={togglePassword}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-blue-400 transition-colors"
            >
              {showPasswordState ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          ) : (
            formData[name] && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <CheckCircle size={18} className="text-emerald-400" />
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-8 sm:py-12 relative overflow-y-auto bg-slate-950">
      {/* Crisp Subtle Grid Background */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_75%_50%_at_50%_50%,black,transparent)]" />

      {/* In-Flow Navigation Header (Positioned above the card, zero displacement) */}
      <div className="w-full max-w-lg mb-3 flex items-center justify-start z-10 pointer-events-auto">
        <Link
          to="/landing"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Register Card (Instant Frame-0 Mount - Zero CLS) */}
      <div className="relative w-full max-w-lg z-10">
        <div className="glass-card p-8 md:p-10 shadow-xl border border-slate-700/60 relative overflow-hidden">
          {/* Logo Section */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-4 shadow-sm text-white font-bold text-2xl">
              <UserPlus className="w-7 h-7 text-white" />
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2 tracking-tight">
                Create Account
              </h1>
              <p className="text-slate-400 font-medium flex items-center justify-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-blue-500" />
                Join Bharat Enterprise
              </p>
              {refCode && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  Referral code '{refCode}' applied!
                </div>
              )}
            </div>
          </div>

          {/* Registration Disabled Banner */}
          {registrationDisabled && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
              <span>Public registration is currently closed. A valid registration key is required to create an account.</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot field — invisible to real users, catches automated spam bots */}
            <div className="sr-only" aria-hidden="true" style={{ display: 'none', position: 'absolute', left: '-9999px' }}>
              <label htmlFor="website">Website</label>
              <input
                type="text"
                id="website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={formData.website || ''}
                onChange={handleChange}
              />
            </div>

            {/* Email & Password Section */}
            <div className="grid grid-cols-1 gap-4">
              {renderInput({ 
                name: 'email', 
                label: 'Email Address', 
                icon: Mail, 
                type: 'email', 
                placeholder: 'your@email.com' 
              })}
              
              {renderInput({ 
                name: 'password', 
                label: 'Password', 
                icon: Lock, 
                placeholder: '••••••••',
                showToggle: true
              })}
              
              {renderInput({ 
                name: 'confirmPassword', 
                label: 'Confirm Password', 
                icon: Lock, 
                placeholder: '••••••••',
                showToggle: true
              })}
            </div>

            {/* Firm Details Section */}
            <div className="pt-4 border-t border-slate-700/50">
              <p className="text-sm text-slate-400 mb-4 flex items-center gap-2">
                <Building2 size={14} />
                Business Details (Optional)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderInput({ 
                  name: 'firmName', 
                  label: 'Firm Name', 
                  icon: Building2, 
                  placeholder: 'Your Enterprise' 
                })}
                
                {renderInput({ 
                  name: 'firmPhone', 
                  label: 'Phone', 
                  icon: Phone, 
                  placeholder: '+91 0000000000' 
                })}
                
                {renderInput({ 
                  name: 'firmGSTIN', 
                  label: 'GSTIN', 
                  icon: FileText, 
                  placeholder: '22AAAAA0000A1Z5' 
                })}
                
                {renderInput({ 
                  name: 'firmAddress', 
                  label: 'Address', 
                  icon: MapPin, 
                  placeholder: 'Business address' 
                })}
              </div>
            </div>

            {/* Registration Key / Secret (Invite Access) */}
            {showSecretField ? (
              <div className="pt-3 border-t border-slate-700/50">
                {renderInput({
                  name: 'registrationSecret',
                  label: 'Registration Key / Invitation Code',
                  icon: KeyRound,
                  type: 'password',
                  placeholder: 'Enter secret access key'
                })}
              </div>
            ) : (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowSecretField(true)}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1.5 focus:outline-hidden"
                >
                  <KeyRound size={13} className="text-slate-400" />
                  <span>Have an invitation key?</span>
                </button>
              </div>
            )}

            {/* Privacy Policy & Terms Consent — Explicit Checkbox */}
            <div className="mt-3">
              <label className="flex items-start gap-3 cursor-pointer group" htmlFor="consent-checkbox">
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    id="consent-checkbox"
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="sr-only peer"
                    disabled={loading}
                  />
                  <div className="w-5 h-5 rounded-md border-2 border-slate-600 bg-slate-800/50 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all duration-200 flex items-center justify-center group-hover:border-slate-500 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/50">
                    {agreedToTerms && (
                      <svg className="w-3 h-3 text-slate-100" fill="none" viewBox="0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-xs text-slate-400 leading-relaxed select-none">
                  I agree to the{' '}
                  <Link
                    to="/privacy-policy"
                    className="relative z-20 text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    target="_blank"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Privacy Policy
                  </Link>{' '}and{' '}
                  <Link
                    to="/terms"
                    className="relative z-20 text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    target="_blank"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Terms & Conditions
                  </Link>
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3 font-semibold shadow-xs relative overflow-hidden group mt-6"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>Create Account</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              Already have an account?{' '}
              <Link 
                to="/login" 
                className="relative z-20 inline-flex items-center text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>

          {/* Security Badge */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield size={14} className="text-emerald-400" />
            <span>Your data is encrypted and secure</span>
          </div>
        </div>
      </div>
    </div>
  );
}
