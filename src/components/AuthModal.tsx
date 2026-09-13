import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  LogIn,
  UserPlus,
  ArrowLeft,
  ShieldCheck,
  Send,
  RefreshCw,
  MailCheck,
  Eye,
  EyeOff,
  ShoppingBag,
  Check,
  Circle,
} from 'lucide-react';
import {
  loginWithEmail,
  registerWithEmail,
  triggerPasswordReset,
  saveUserFirestoreProfile,
  updateUserFirestoreProfile,
  getUserFirestoreProfile,
  resolveEmailFromUsername,
  saveUsernameMapping,
  checkUsernameIsTaken,
  checkEmailIsRegistered,
  FirestoreUserData,
  FirebaseUser,
} from '../lib/firebase';
import { UserProfile, Product } from '../types';
import { api } from '../utils/api';
import { ensureRandomReferralCode, generateRandomReferralCode } from '../utils/referral';
import { safeStorage } from '../utils/storage';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { validateUsername } from '../models/userModel';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'KM' | 'EN';
  onAuthSuccess: (firebaseUser: FirebaseUser, profileData?: Partial<UserProfile>) => void;
  purchaseIntentProduct?: Product | null;
}

type AuthTab = 'signin' | 'signup' | 'forgot';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  lang = 'KM',
  onAuthSuccess,
  purchaseIntentProduct,
}) => {
  const [activeTab, setActiveTab] = useState<AuthTab>('signin');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [sentResetEmail, setSentResetEmail] = useState<string>('');
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Welcome email auto-dispatch state
  const [welcomeEmailSentData, setWelcomeEmailSentData] = useState<{
    email: string;
    username: string;
    refCode: string;
  } | null>(null);
  const [isResendingWelcome, setIsResendingWelcome] = useState(false);
  const [welcomeResendNotice, setWelcomeResendNotice] = useState<string | null>(null);

  // Real-time password criteria validation (8 chars, letter, number)
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasLetter && hasNumber;
  const hasTypedConfirm = confirmPassword.length > 0;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isSignUpSubmitActive = isPasswordValid && passwordsMatch && !isLoading;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const resetForm = () => {
    setLoginIdentifier('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setUsername('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setErrorMessage(null);
    setResetSuccessMessage(null);
    setSentResetEmail('');
    setResendCooldown(0);
    setWelcomeEmailSentData(null);
    setWelcomeResendNotice(null);
    setIsResendingWelcome(false);
  };

  const parseFirebaseError = (err: any): string => {
    const code = err?.code || '';
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      return lang === 'KM'
        ? 'រកមិនឃើញគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ។'
        : 'Invalid credentials or user not found.';
    }
    if (code === 'auth/wrong-password') {
      return lang === 'KM' ? 'ពាក្យសម្ងាត់មិនត្រឹមត្រូវ។' : 'Incorrect password.';
    }
    if (code === 'auth/email-already-in-use') {
      return lang === 'KM'
        ? 'អ៊ីមែលនេះមានគណនីរួចហើយ។ សូមចូលប្រើ (Sign In)។'
        : 'This email is already in use. Please sign in instead.';
    }
    if (code === 'auth/weak-password') {
      return lang === 'KM'
        ? 'ពាក្យសម្ងាត់ខ្លីពេក (យ៉ាងហោចណាស់ ៨ តួអក្សរ)។'
        : 'Password is too weak (at least 8 characters required).';
    }
    if (code === 'auth/operation-not-allowed') {
      return lang === 'KM'
        ? 'ប្រព័ន្ធបានប្តូរទៅកាន់ការផ្ទៀងផ្ទាត់សុវត្ថិភាពខ្ពស់ដោយស្វ័យប្រវត្តិ។ សូមព្យាយាមម្តងទៀត។'
        : 'High-availability secure authentication activated. Please submit again.';
    }
    if (code === 'auth/invalid-email') {
      return lang === 'KM' ? 'ទម្រង់អ៊ីមែលមិនត្រឹមត្រូវ។' : 'Invalid email address format.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return lang === 'KM'
        ? 'អ្នកបានបិទផ្ទាំង Google Sign-in។'
        : 'Google sign-in popup was closed before completing.';
    }
    if (code === 'auth/popup-blocked') {
      return lang === 'KM'
        ? 'កម្មវិធីរុករក (Browser) បានទប់ស្កាត់ផ្ទាំង Popup។ សូមអនុញ្ញាត Popups ឬប្រើប្រាស់អ៊ីមែល។'
        : 'Popup was blocked by your browser. Please allow popups or use email sign in.';
    }
    if (code === 'auth/unauthorized-domain') {
      return lang === 'KM'
        ? 'ការផ្ទៀងផ្ទាត់ Google អាចទាមទារការចូលប្រើលើ browser ផ្ទាល់។ អ្នកអាចប្រើប្រាស់អ៊ីមែល និងពាក្យសម្ងាត់បានយ៉ាងរហ័ស។'
        : 'Google auth is restricted in preview. You can also instantly sign in or register with email & password.';
    }
    if (code === 'auth/unauthorized-continue-uri') {
      return lang === 'KM'
        ? 'កំហុសការកំណត់រចនាសម្ព័ន្ធ: uchiro.store មិនទាន់ត្រូវបានបញ្ចូលក្នុងបញ្ជី Authorized domains នៅ Firebase Console ទេ។'
        : 'Setup error: uchiro.store has not been added to Authorized domains in the Firebase Console yet. Ask your developer to add it under Authentication > Settings > Authorized domains.';
    }
    return err?.message || 'Authentication error occurred. Please try again.';
  };

  // Helper to ensure firestore profile exists
  const syncOrInitFirestoreProfile = async (fbUser: FirebaseUser, desiredUsername?: string): Promise<FirestoreUserData> => {
    const cleanUsername = (desiredUsername || fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'player'))
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');
    const cleanEmail = (fbUser.email || '').toLowerCase();
    const isOwnerAdmin = cleanEmail === 'youtgg13@gmail.com';

    try {
      let existing = await getUserFirestoreProfile(fbUser.uid);
      const refCode = ensureRandomReferralCode(existing?.referralCode);

      if (!existing) {
        const initialProfile: FirestoreUserData = {
          id: fbUser.uid,
          email: cleanEmail,
          username: cleanUsername,
          avatarUrl:
            fbUser.photoURL ||
            'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150',
          balanceUSD: 0.0,
          totalSpentUSD: 0,
          isResellerUnlocked: false,
          referralCode: refCode,
          role: isOwnerAdmin ? 'admin' : 'customer',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveUserFirestoreProfile(initialProfile);
        existing = initialProfile;
      } else {
        let updatesNeeded: Partial<FirestoreUserData> = {};
        if (!existing.referralCode || existing.referralCode.startsWith('UCHIRO-')) {
          updatesNeeded.referralCode = refCode;
          existing.referralCode = refCode;
        }
        if (isOwnerAdmin && existing.role !== 'admin') {
          updatesNeeded.role = 'admin';
          existing.role = 'admin';
        }
        if (Object.keys(updatesNeeded).length > 0) {
          await updateUserFirestoreProfile(fbUser.uid, updatesNeeded);
        }
      }

      // Maintain username mapping for quick login
      if (existing.username && (existing.email || fbUser.email)) {
        await saveUsernameMapping(existing.username, existing.email || fbUser.email || '');
      }

      return existing;
    } catch (profileErr) {
      console.warn('Firestore profile sync fallback (operating in local resilient mode):', profileErr);
      const fallbackProfile: FirestoreUserData = {
        id: fbUser.uid,
        email: cleanEmail,
        username: cleanUsername,
        avatarUrl: fbUser.photoURL || 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150',
        balanceUSD: 0.0,
        totalSpentUSD: 0,
        isResellerUnlocked: false,
        referralCode: ensureRandomReferralCode(),
        role: isOwnerAdmin ? 'admin' : 'customer',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return fallbackProfile;
    }
  };

  // 1. Handle Username or Email Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const rawIdentifier = loginIdentifier.trim();
    if (!rawIdentifier || !password) {
      setErrorMessage(
        lang === 'KM' ? 'សូមបញ្ចូលឈ្មោះអ្នកប្រើ ឬ អ៊ីមែល និងពាក្យសម្ងាត់!' : 'Please enter username/email and password!'
      );
      return;
    }

    setIsLoading(true);
    try {
      let emailToLogin = rawIdentifier.toLowerCase();

      // If user provided a username (no @), resolve to email
      if (!rawIdentifier.includes('@')) {
        const cleanUser = rawIdentifier.toLowerCase().replace(/[^a-z0-9_]/g, '');
        const resolvedEmail = await resolveEmailFromUsername(cleanUser);
        if (!resolvedEmail) {
          setErrorMessage(
            lang === 'KM'
              ? `រកមិនឃើញឈ្មោះអ្នកប្រើ "${cleanUser}" ទេ។ សូមពិនិត្យឈ្មោះអ្នកប្រើ ឬចុះឈ្មោះគណនីថ្មី (Sign Up)។`
              : `No account found for username "${cleanUser}". Please verify your username or sign up.`
          );
          setIsLoading(false);
          return;
        }
        emailToLogin = resolvedEmail;
      }

      const fbUser = await loginWithEmail(emailToLogin, password);
      const profile = await syncOrInitFirestoreProfile(fbUser);
      const effectiveUsername = profile.username || fbUser.displayName || emailToLogin.split('@')[0];
      const effectiveRefCode = ensureRandomReferralCode(profile.referralCode);

      // Verify Admin Authorization seamlessly
      const targetEmail = (profile.email || emailToLogin || fbUser.email || '').toLowerCase();
      const adminCheck = await api.verifyAdminUser(targetEmail, fbUser.uid);
      const userRole: 'customer' | 'admin' = adminCheck.isAdmin || profile.role === 'admin' ? 'admin' : 'customer';

      if (adminCheck.token) {
        safeStorage.setItem('uchiro_user_token', adminCheck.token);
        if (userRole === 'admin') {
          safeStorage.setItem('uchiro_admin_token', adminCheck.token);
        } else {
          safeStorage.removeItem('uchiro_admin_token');
        }
      }

      onAuthSuccess(fbUser, {
        username: effectiveUsername,
        displayName: effectiveUsername,
        email: profile.email || emailToLogin,
        balanceUSD: profile.balanceUSD ?? 0,
        totalSpentUSD: profile.totalSpentUSD ?? 0,
        isResellerUnlocked: profile.isResellerUnlocked ?? false,
        referralCode: effectiveRefCode,
        avatarUrl: profile.avatarUrl || fbUser.photoURL || undefined,
        role: userRole,
      });
      resetForm();
      onClose();
    } catch (err: any) {
      setErrorMessage(parseFirebaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Handle Email/Password Sign Up with Strict 1-User-1-Username and 1-User-1-Email Policy
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = validateUsername(username);
    if (!validation.isValid) {
      setErrorMessage(
        lang === 'KM'
          ? `ឈ្មោះអ្នកប្រើមិនត្រឹមត្រូវទេ៖ ${validation.error}`
          : validation.error
      );
      return;
    }

    const cleanUsername = username.trim().toLowerCase();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMessage(
        lang === 'KM' ? 'សូមបំពេញព័ត៌មានទាំងអស់!' : 'Please fill in all required fields!'
      );
      return;
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage(
        lang === 'KM' ? 'ទម្រង់អ៊ីមែលមិនត្រឹមត្រូវទេ! (ឧទាហរណ៍: user@gmail.com)' : 'Please enter a valid email address!'
      );
      return;
    }
    if (password.length < 8) {
      setErrorMessage(
        lang === 'KM'
          ? 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ ៨ តួអក្សរ!'
          : 'Password must be at least 8 characters long!'
      );
      return;
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMessage(
        lang === 'KM'
          ? 'ពាក្យសម្ងាត់ត្រូវមានអក្សរ (A-Z) និងលេខ (0-9)!'
          : 'Password must include at least one letter and one number!'
      );
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(
        lang === 'KM' ? 'ពាក្យសម្ងាត់ទាំងពីរមិនត្រូវគ្នាទេ!' : 'Passwords do not match!'
      );
      return;
    }

    setIsLoading(true);
    try {
      // 1. Strict 1 Username = 1 User Policy Check (Firestore + Server API)
      const usernameTaken = await checkUsernameIsTaken(cleanUsername);
      if (usernameTaken) {
        setErrorMessage(
          lang === 'KM'
            ? `ឈ្មោះអ្នកប្រើ @${cleanUsername} នេះមានគេប្រើប្រាស់រួចហើយ! ឈ្មោះអ្នកប្រើនីមួយៗអាចប្រើបានតែម្តងគត់ (One username can be used only once)។ សូមជ្រើសរើសឈ្មោះផ្សេង។`
            : `The username @${cleanUsername} is already taken! One username can be used only once. Please choose another username.`
        );
        setIsLoading(false);
        return;
      }

      // 2. Strict 1 Email = 1 Account Policy Check (Firestore + Server API)
      const emailTaken = await checkEmailIsRegistered(cleanEmail);
      if (emailTaken) {
        setErrorMessage(
          lang === 'KM'
            ? `អ៊ីមែល "${cleanEmail}" ត្រូវបានចុះឈ្មោះជាមួយគណនីរួចហើយ! អ៊ីមែលមួយអាចប្រើបានតែម្តងគត់ (One email can be used only once)។ សូមចូលប្រើ (Sign In) ដោយប្រើពាក្យសម្ងាត់របស់អ្នក។`
            : `This email "${cleanEmail}" is already registered! One email can be used only once. Please sign in with your password.`
        );
        setIsLoading(false);
        return;
      }

      const fbUser = await registerWithEmail(cleanEmail, password, cleanUsername);
      const profile = await syncOrInitFirestoreProfile(fbUser, cleanUsername);
      await saveUsernameMapping(cleanUsername, cleanEmail);

      const refCode = ensureRandomReferralCode(profile.referralCode);

      // Verify Admin Authorization seamlessly
      const targetEmail = (profile.email || cleanEmail || fbUser.email || '').toLowerCase();
      const adminCheck = await api.verifyAdminUser(targetEmail, fbUser.uid);
      if (adminCheck.isAdmin && adminCheck.token) {
        safeStorage.setItem('uchiro_admin_token', adminCheck.token);
      } else {
        safeStorage.removeItem('uchiro_admin_token');
      }

      // Automatically dispatch official welcome email
      api.sendWelcomeEmail({
        email: cleanEmail,
        username: cleanUsername,
        referralCode: refCode,
      }).catch((emailErr) => {
        console.warn('Auto send welcome email failed:', emailErr);
      });

      onAuthSuccess(fbUser, {
        username: profile.username || cleanUsername,
        displayName: profile.username || cleanUsername,
        email: profile.email || cleanEmail,
        balanceUSD: profile.balanceUSD ?? 0,
        totalSpentUSD: profile.totalSpentUSD ?? 0,
        isResellerUnlocked: profile.isResellerUnlocked ?? false,
        referralCode: refCode,
        avatarUrl: profile.avatarUrl,
        role: adminCheck.isAdmin ? 'admin' : (profile.role || 'customer'),
      });

      // Show welcome email confirmation screen inside modal
      setWelcomeEmailSentData({
        email: cleanEmail,
        username: cleanUsername,
        refCode,
      });
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use' || err?.message?.includes('email-already-in-use')) {
        setErrorMessage(
          lang === 'KM'
            ? `អ៊ីមែល "${cleanEmail}" ត្រូវបានចុះឈ្មោះជាមួយគណនីរួចហើយ! អ៊ីមែលមួយអាចប្រើបានតែម្តងគត់ (One email can be used only once)។ សូមចូលប្រើ (Sign In)។`
            : `This email is already registered! One email can be used only once. Please sign in.`
        );
      } else {
        setErrorMessage(parseFirebaseError(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Handle Password Reset Email (Works ONLY for accounts that already exist)
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResetSuccessMessage(null);

    const rawInput = email.trim();
    if (!rawInput) {
      setErrorMessage(
        lang === 'KM'
          ? 'សូមបញ្ចូលឈ្មោះអ្នកប្រើ ឬ អ៊ីមែលដែលអ្នកបានចុះឈ្មោះ!'
          : 'Please enter your registered username or email!'
      );
      return;
    }

    setIsLoading(true);
    try {
      let emailToSend = rawInput.toLowerCase();

      // If user typed a username (no @)
      if (!rawInput.includes('@')) {
        const cleanUser = rawInput.toLowerCase().replace(/[^a-z0-9_]/g, '');
        const resolved = await resolveEmailFromUsername(cleanUser);
        if (resolved) {
          emailToSend = resolved;
        } else {
          // Check backend directory
          const backendCheck = await api.checkAccountExists(cleanUser);
          if (backendCheck.exists && backendCheck.email) {
            emailToSend = backendCheck.email;
          } else {
            setErrorMessage(
              lang === 'KM'
                ? `រកមិនឃើញគណនីសម្រាប់ឈ្មោះអ្នកប្រើ "${cleanUser}" ទេ។ ការកំណត់ពាក្យសម្ងាត់ឡើងវិញអាចធ្វើបានសម្រាប់តែគណនីដែលមានស្រាប់ក្នុងប្រព័ន្ធប៉ុណ្ណោះ។`
                : `Account not found for username "${cleanUser}". Password reset only works for accounts that already exist.`
            );
            setIsLoading(false);
            return;
          }
        }
      } else {
        // User entered an email address: verify that it actually belongs to an existing account!
        const check = await api.checkAccountExists(emailToSend);
        let existsInFirestore = false;
        try {
          const userDoc = await getUserFirestoreProfile(emailToSend);
          if (userDoc) existsInFirestore = true;
        } catch {}

        if (!check.exists && !existsInFirestore) {
          setErrorMessage(
            lang === 'KM'
              ? `រកមិនឃើញគណនីដែលបានចុះឈ្មោះជាមួយ "${emailToSend}" ទេ។ ការកំណត់ពាក្យសម្ងាត់អាចធ្វើបានសម្រាប់តែគណនីដែលមានស្រាប់ប៉ុណ្ណោះ។ សូមពិនិត្យមើលអក្ខរាវិរុទ្ធ ឬចុះឈ្មោះគណនីថ្មី។`
              : `Account not found: "${emailToSend}" is not registered in our system. Password reset only works for accounts that already exist. Please verify your email address or sign up.`
          );
          setIsLoading(false);
          return;
        }
      }

      // Account verified! Dispatch the real password reset email
      await triggerPasswordReset(emailToSend);
      setSentResetEmail(emailToSend);
      setResendCooldown(60); // 60s cooldown
      setResetSuccessMessage(
        lang === 'KM'
          ? `តំណភ្ជាប់កំណត់ពាក្យសម្ងាត់ឡើងវិញត្រូវបានផ្ញើទៅកាន់ ${emailToSend}! សូមពិនិត្យមើលប្រអប់សំបុត្រ (Inbox & Spam) របស់អ្នក។`
          : `A password reset link has been dispatched to ${emailToSend}! Please check your email inbox and spam folder.`
      );
    } catch (err: any) {
      setErrorMessage(parseFirebaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="firebase-auth-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in"
    >
      <div className="relative w-full max-w-[360px] sm:max-w-md bg-[#161822] border border-[#ffb230]/30 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-[0_15px_50px_rgba(0,0,0,0.8)] text-[#e2e2ec] my-auto max-h-[92dvh] flex flex-col overflow-hidden">
        {/* Close Button */}
        <button
          id="close-auth-modal-btn"
          onClick={() => {
            resetForm();
            onClose();
          }}
          className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 p-1.5 sm:p-2 rounded-full bg-[#1C1F29] text-[#8B90A0] hover:text-white border border-white/5 transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Scrollable Modal Content */}
        <div className="overflow-y-auto pr-0.5 max-h-[calc(92dvh-1.5rem)]">
          {welcomeEmailSentData ? (
            /* Welcome Email Auto-Dispatched Confirmation Screen */
            <div id="welcome-email-sent-card" className="text-center py-2 px-1 animate-fade-in">
              <div className="inline-flex p-3 sm:p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 mb-2.5 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                <MailCheck className="w-9 h-9 sm:w-11 sm:h-11 text-emerald-400" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-price text-[10.5px] sm:text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#ffb230]" />
                <span>{lang === 'KM' ? '✓ បានផ្ញើសារស្វាគមន៍ដោយស្វ័យប្រវត្តិ' : '✓ Welcome Email Auto-Dispatched'}</span>
              </div>

              <h2 className="font-headline text-lg sm:text-2xl text-[#ffd7a1] uppercase tracking-wide leading-tight mb-1">
                {lang === 'KM'
                  ? `សូមស្វាគមន៍, @${welcomeEmailSentData.username}!`
                  : `Welcome, @${welcomeEmailSentData.username}!`}
              </h2>

              <p className="font-price text-xs text-[#8B90A0] max-w-sm mx-auto mb-3.5 leading-relaxed">
                {lang === 'KM'
                  ? 'គណនីរបស់អ្នកត្រូវបានបង្កើត និងការពារដោយជោគជ័យ។ សារស្វាគមន៍ផ្លូវការរួមមានកូដណែនាំ និងអត្ថប្រយោជន៍ VIP ត្រូវបានផ្ញើទៅកាន់៖'
                  : 'Your account is secured & registered. An official welcome email with your VIP benefits and referral code was auto-sent to:'}
              </p>

              {/* Recipient Card */}
              <div className="bg-[#11131b] border border-[#ffb230]/40 rounded-xl p-3 sm:p-3.5 mb-3 text-left shadow-inner">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                  <Mail className="w-4 h-4 text-[#ffb230] shrink-0" />
                  <span className="font-price text-xs sm:text-sm font-bold text-white break-all">
                    {welcomeEmailSentData.email}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] sm:text-xs font-price">
                  <span className="text-[#8B90A0]">
                    {lang === 'KM' ? 'កូដណែនាំរបស់អ្នក (Referral):' : 'Your Official Referral Code:'}
                  </span>
                  <span className="font-mono font-black text-[#ffb230] tracking-wider text-xs sm:text-sm bg-[#ffb230]/10 px-2 py-0.5 rounded border border-[#ffb230]/30">
                    {welcomeEmailSentData.refCode}
                  </span>
                </div>
              </div>

              {/* Perks Highlights Box */}
              <div className="bg-[#161822] border border-white/5 rounded-xl p-3 mb-4 text-left font-price text-[11px] sm:text-xs text-[#c4c7d4] space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    {lang === 'KM'
                      ? 'សូមពិនិត្យមើលប្រអប់សំបុត្រ (Inbox & Spam) សម្រាប់ព័ត៌មានលម្អិត និងការណែនាំសុវត្ថិភាព។'
                      : 'Check your email inbox (or spam/promotions) for your member welcome packet.'}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    {lang === 'KM'
                      ? 'ចែករំលែកកូដណែនាំទៅមិត្តភក្តិ ដើម្បីទទួលបានកម្រៃជើងសារ 5% ជារៀងរហូត!'
                      : 'Share your referral code: earn 5% perpetual commission on every deposit friends make.'}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    {lang === 'KM'
                      ? 'គាំទ្រការទូទាត់រហ័ស 0% ថ្លៃសេវា តាម NBC Bakong KHQR (ABA, Wing, ACLEDA)។'
                      : 'Enjoy zero fee KHQR deposits and rapid automated in-game item transfers.'}
                  </span>
                </div>
              </div>

              {welcomeResendNotice && (
                <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-price text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{welcomeResendNotice}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  id="welcome-continue-btn"
                  onClick={() => {
                    resetForm();
                    onClose();
                  }}
                  className="w-full py-2.5 sm:py-3 bg-[#ffb230] hover:bg-[#ffc059] text-[#241400] font-price text-xs sm:text-sm font-black rounded-xl uppercase tracking-wider transition-all cursor-pointer shadow-[0_4px_15px_rgba(255,178,48,0.35)] active:scale-[0.99]"
                >
                  {lang === 'KM' ? 'ចាប់ផ្តើមទិញទំនិញ →' : 'Start Shopping Now →'}
                </button>

                <button
                  type="button"
                  id="welcome-resend-btn"
                  disabled={isResendingWelcome}
                  onClick={async () => {
                    setIsResendingWelcome(true);
                    setWelcomeResendNotice(null);
                    try {
                      const res = await api.sendWelcomeEmail({
                        email: welcomeEmailSentData.email,
                        username: welcomeEmailSentData.username,
                        referralCode: welcomeEmailSentData.refCode,
                      });
                      if (res.success) {
                        setWelcomeResendNotice(
                          lang === 'KM'
                            ? `បានផ្ញើសារស្វាគមន៍ម្តងទៀតទៅកាន់ ${welcomeEmailSentData.email}!`
                            : `Resent official welcome email to ${welcomeEmailSentData.email}!`
                        );
                      } else {
                        setWelcomeResendNotice(res.error || 'Failed to dispatch email.');
                      }
                    } catch (e: any) {
                      setWelcomeResendNotice(e.message || 'Error resending email.');
                    } finally {
                      setIsResendingWelcome(false);
                    }
                  }}
                  className="w-full py-2 bg-transparent hover:bg-white/5 border border-white/10 text-[#8B90A0] hover:text-white font-price text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResendingWelcome ? 'animate-spin text-[#ffb230]' : ''}`} />
                  <span>
                    {isResendingWelcome
                      ? (lang === 'KM' ? 'កំពុងផ្ញើ...' : 'Dispatching Email...')
                      : (lang === 'KM' ? 'ផ្ញើសារស្វាគមន៍ម្តងទៀត (Resend Email)' : 'Resend Welcome Email')}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Purchase Intent Banner (if user came from clicking Buy) */}
              {purchaseIntentProduct && (
                <div className="mb-3 p-2.5 rounded-xl bg-gradient-to-r from-[#ffb230]/20 to-[#ff9e00]/10 border border-[#ffb230]/40 flex items-center gap-2.5 animate-fade-in shadow-inner">
                  <div className="relative shrink-0">
                    <img
                      src={purchaseIntentProduct.image}
                      alt={purchaseIntentProduct.title}
                      className="w-11 h-11 rounded-lg object-cover border border-white/10"
                    />
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ffb230] text-[#291800] flex items-center justify-center font-bold text-[9px] shadow">
                      <ShoppingBag className="w-2.5 h-2.5" />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10.5px] font-bold text-[#ffd7a1] uppercase tracking-wide">
                        {lang === 'KM' ? '🔒 ចូលគណនីដើម្បីទិញទំនិញ' : '🔒 Sign in required to buy'}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white truncate leading-tight">
                      {purchaseIntentProduct.title}
                    </p>
                    <p className="text-[11px] font-price text-[#3ECF8E] font-bold mt-0.5">
                      ${purchaseIntentProduct.price.toFixed(2)} USD • {lang === 'KM' ? 'ទទួលបានភ្លាមៗ' : 'Instant Delivery'}
                    </p>
                  </div>
                </div>
              )}

              {/* Brand Header */}
              <div className="text-center mb-2 sm:mb-3.5">
                <div className="inline-flex p-1.5 sm:p-2.5 rounded-xl bg-[#ffb230]/15 border border-[#ffb230]/30 text-[#ffb230] mb-1 sm:mb-2 shadow-[0_0_15px_rgba(255,178,48,0.2)]">
                  {activeTab === 'forgot' ? (
                    <KeyRound className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : activeTab === 'signup' ? (
                    <UserPlus className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : (
                    <LogIn className="w-5 h-5 sm:w-6 sm:h-6" />
                  )}
                </div>
                <h2 className="font-headline text-lg sm:text-2xl text-[#ffd7a1] uppercase tracking-wide leading-tight">
                  {activeTab === 'forgot'
                    ? lang === 'KM'
                      ? 'កំណត់ពាក្យសម្ងាត់ឡើងវិញ'
                      : 'Reset Password'
                    : activeTab === 'signup'
                    ? lang === 'KM'
                      ? 'បង្កើតគណនីថ្មី'
                      : 'Create Account'
                    : lang === 'KM'
                    ? 'ចូលប្រើប្រាស់គណនី'
                    : 'Player Login'}
                </h2>
                <p className="font-price text-[10.5px] sm:text-xs text-[#8B90A0] mt-0.5 leading-snug line-clamp-1 sm:line-clamp-none">
                  {activeTab === 'forgot'
                    ? lang === 'KM'
                      ? 'បញ្ចូលអ៊ីមែលដើម្បីទទួលបានតំណភ្ជាប់ប្តូរពាក្យសម្ងាត់'
                      : 'Enter your email to receive password reset link'
                    : activeTab === 'signup'
                    ? lang === 'KM'
                      ? 'ចុះឈ្មោះដោយប្រើ ឈ្មោះអ្នកប្រើ (Username) និង អ៊ីមែល របស់អ្នក'
                      : 'Sign up with unique username, email & password'
                    : lang === 'KM'
                    ? 'ចូលប្រើដោយប្រើ ឈ្មោះអ្នកប្រើ ឬ អ៊ីមែល និងពាក្យសម្ងាត់របស់អ្នក'
                    : 'Sign in with your username or email address and password'}
                </p>
              </div>

              {/* Tab Switcher (Sign In vs Sign Up) */}
              {activeTab !== 'forgot' && (
                <div className="flex rounded-lg sm:rounded-xl bg-[#11131a] p-0.5 sm:p-1 border border-white/5 mb-2.5 sm:mb-3.5 font-price text-[11px] sm:text-xs">
                  <button
                    id="tab-signin-btn"
                    type="button"
                    onClick={() => {
                      setActiveTab('signin');
                      setErrorMessage(null);
                    }}
                    className={`flex-1 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-bold transition-all cursor-pointer ${
                      activeTab === 'signin'
                        ? 'bg-[#ffb230] text-[#291800] shadow-sm'
                        : 'text-[#8B90A0] hover:text-[#ffd7a1]'
                    }`}
                  >
                    {lang === 'KM' ? 'ចូលប្រើ (Sign In)' : 'Sign In'}
                  </button>
                  <button
                    id="tab-signup-btn"
                    type="button"
                    onClick={() => {
                      setActiveTab('signup');
                      setErrorMessage(null);
                    }}
                    className={`flex-1 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-bold transition-all cursor-pointer ${
                      activeTab === 'signup'
                        ? 'bg-[#ffb230] text-[#291800] shadow-sm'
                        : 'text-[#8B90A0] hover:text-[#ffd7a1]'
                    }`}
                  >
                    {lang === 'KM' ? 'ចុះឈ្មោះ (Sign Up)' : 'Sign Up'}
                  </button>
                </div>
              )}

              {/* Error Alert */}
              {errorMessage && (
                <div className="mb-2.5 p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-[#E8433F]/15 border border-[#E8433F]/40 flex items-start gap-1.5 text-[11px] sm:text-xs font-price text-[#ffb2b0] animate-fade-in">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#E8433F] mt-0.5" />
                  <span className="flex-1 leading-snug">{errorMessage}</span>
                </div>
              )}

              {/* Success Alert */}
              {resetSuccessMessage && (
                <div className="mb-2.5 p-2.5 rounded-lg sm:rounded-xl bg-[#3ECF8E]/15 border border-[#3ECF8E]/40 flex items-start gap-1.5 text-[11px] sm:text-xs font-price text-[#a6f0cc] animate-fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#3ECF8E] mt-0.5" />
                  <span className="flex-1 leading-snug">{resetSuccessMessage}</span>
                </div>
              )}

              {/* FORM 1: SIGN IN */}
              {activeTab === 'signin' && (
                <form onSubmit={handleSignIn} className="space-y-2 sm:space-y-3">
                  <div>
                    <label className="block text-[11px] sm:text-xs font-price text-[#8B90A0] mb-0.5 sm:mb-1 font-semibold">
                      {lang === 'KM' ? 'ឈ្មោះអ្នកប្រើ ឬ អ៊ីមែល' : 'Username or Email Address'}
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 text-[#8B90A0]" />
                      <input
                        id="signin-identifier-input"
                        type="text"
                        required
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        placeholder={lang === 'KM' ? 'ឧ. progamer ឬ player@uchiro.store' : 'e.g. progamer or player@uchiro.store'}
                        className="w-full bg-[#11131a] border border-white/10 rounded-lg sm:rounded-xl pl-8 sm:pl-10 pr-8 sm:pr-9 py-1.5 sm:py-2.5 font-price text-xs sm:text-sm text-[#e2e2ec] focus:outline-none focus:border-[#ffb230]"
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                      {loginIdentifier && (
                        <button
                          type="button"
                          onClick={() => setLoginIdentifier('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white/10 hover:bg-white/20 text-[#cac6bb] hover:text-white flex items-center justify-center text-[10px] transition-colors"
                          title="Clear input"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                      <label className="block text-[11px] sm:text-xs font-price text-[#8B90A0] font-semibold">
                        {lang === 'KM' ? 'ពាក្យសម្ងាត់' : 'Password'}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('forgot');
                          setErrorMessage(null);
                          setResetSuccessMessage(null);
                        }}
                        className="text-[10px] sm:text-xs font-price text-[#ffb230] hover:underline cursor-pointer"
                      >
                        {lang === 'KM' ? 'ភ្លេចពាក្យសម្ងាត់?' : 'Forgot Password?'}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 text-[#8B90A0]" />
                      <input
                        id="signin-password-input"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#11131a] border border-white/10 rounded-lg sm:rounded-xl pl-8 sm:pl-10 pr-10 py-1.5 sm:py-2.5 font-price text-xs sm:text-sm text-[#e2e2ec] focus:outline-none focus:border-[#ffb230]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 sm:right-3.5 top-1/2 -translate-y-1/2 text-[#8B90A0] hover:text-white p-1 cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    id="submit-signin-btn"
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 sm:py-3 mt-1 sm:mt-2 bg-[#ffb230] hover:bg-[#ffbe4d] text-[#291800] rounded-lg sm:rounded-xl font-headline font-bold uppercase tracking-wider text-xs sm:text-sm shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50"
                  >
                    {isLoading
                      ? lang === 'KM'
                        ? 'កំពុងផ្ទៀងផ្ទាត់...'
                        : 'Authenticating...'
                      : lang === 'KM'
                      ? 'ចូលប្រើប្រាស់ (Sign In)'
                      : 'Sign In'}
                  </button>
                </form>
              )}

              {/* FORM 2: SIGN UP */}
              {activeTab === 'signup' && (
                <form onSubmit={handleSignUp} className="space-y-2 sm:space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="block text-[10.5px] sm:text-xs font-price text-[#8B90A0] font-semibold">
                        {lang === 'KM' ? 'ឈ្មោះអ្នកលេង (អក្សរតូច a-z)' : 'Username (Lowercase)'}
                      </label>
                      <span className="text-[9px] text-[#ffb230] font-mono font-bold bg-[#ffb230]/10 px-1.5 py-0.5 rounded border border-[#ffb230]/20">
                        {username ? `@${username}` : 'a-z, 0-9, _'}
                      </span>
                    </div>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 text-[#8B90A0]" />
                      <input
                        id="signup-username-input"
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="e.g. progamerkh"
                        className="w-full bg-[#11131a] border border-white/10 rounded-lg sm:rounded-xl pl-8 sm:pl-10 pr-8 sm:pr-9 py-1.5 sm:py-2 font-price text-xs sm:text-sm text-[#e2e2ec] focus:outline-none focus:border-[#ffb230] lowercase font-mono"
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                      {username && (
                        <button
                          type="button"
                          onClick={() => setUsername('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white/10 hover:bg-white/20 text-[#cac6bb] hover:text-white flex items-center justify-center text-[10px] transition-colors"
                          title="Clear username"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-[#8B90A0] mt-1 font-user">
                      {lang === 'KM'
                        ? '✨ ៣-២០ តួអក្សរ (អក្សរតូច a-z, លេខ 0-9, _) គ្មានចន្លោះ។ មិនអាចផ្លាស់ប្តូរបានទេពេលបង្កើតរួច។'
                        : '✨ 3-20 chars (lowercase a-z, numbers 0-9, _), no spaces. Cannot be changed once created.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10.5px] sm:text-xs font-price text-[#8B90A0] mb-0.5 font-semibold">
                      {lang === 'KM' ? 'អាសយដ្ឋានអ៊ីមែល' : 'Email Address'}
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 text-[#8B90A0]" />
                      <input
                        id="signup-email-input"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="player@uchiro.store"
                        className="w-full bg-[#11131a] border border-white/10 rounded-lg sm:rounded-xl pl-8 sm:pl-10 pr-8 sm:pr-9 py-1.5 sm:py-2 font-price text-xs sm:text-sm text-[#e2e2ec] focus:outline-none focus:border-[#ffb230]"
                      />
                      {email && (
                        <button
                          type="button"
                          onClick={() => setEmail('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white/10 hover:bg-white/20 text-[#cac6bb] hover:text-white flex items-center justify-center text-[10px] transition-colors"
                          title="Clear email"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[10.5px] sm:text-xs font-price text-[#8B90A0] font-semibold truncate">
                          {lang === 'KM' ? 'ពាក្យសម្ងាត់' : 'Password'}
                        </label>
                        {password && (
                          <span
                            className={`text-[9px] font-price font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                              isPasswordValid
                                ? 'bg-[#3ECF8E]/15 text-[#3ECF8E] border border-[#3ECF8E]/30'
                                : 'bg-[#ffb230]/15 text-[#ffb230] border border-[#ffb230]/30'
                            }`}
                          >
                            {isPasswordValid ? (
                              <>
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                                <span>Valid</span>
                              </>
                            ) : (
                              <span>{password.length}/8+ chars</span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-[#8B90A0]" />
                        <input
                          id="signup-password-input"
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`w-full bg-[#11131a] border rounded-lg sm:rounded-xl pl-7 sm:pl-9 pr-8 py-1.5 sm:py-2 font-price text-xs sm:text-sm text-[#e2e2ec] focus:outline-none transition-colors ${
                            isPasswordValid
                              ? 'border-[#3ECF8E]/50 focus:border-[#3ECF8E]'
                              : password.length > 0
                              ? 'border-[#ffb230]/50 focus:border-[#ffb230]'
                              : 'border-white/10 focus:border-[#ffb230]'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8B90A0] hover:text-white p-1 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[10.5px] sm:text-xs font-price text-[#8B90A0] font-semibold truncate">
                          {lang === 'KM' ? 'ផ្ទៀងផ្ទាត់' : 'Confirm'}
                        </label>
                        {confirmPassword && password && (
                          <span
                            className={`text-[9px] font-price font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                              passwordsMatch
                                ? 'bg-[#3ECF8E]/15 text-[#3ECF8E] border border-[#3ECF8E]/30'
                                : 'bg-[#E8433F]/15 text-[#ff7370] border border-[#E8433F]/30'
                            }`}
                          >
                            {passwordsMatch ? (
                              <>
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                                <span>Match</span>
                              </>
                            ) : (
                              <span>Mismatch</span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-[#8B90A0]" />
                        <input
                          id="signup-confirm-password-input"
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`w-full bg-[#11131a] border rounded-lg sm:rounded-xl pl-7 sm:pl-9 pr-8 py-1.5 sm:py-2 font-price text-xs sm:text-sm text-[#e2e2ec] focus:outline-none transition-colors ${
                            passwordsMatch
                              ? 'border-[#3ECF8E]/50 focus:border-[#3ECF8E]'
                              : confirmPassword.length > 0
                              ? 'border-[#E8433F]/50 focus:border-[#E8433F]'
                              : 'border-white/10 focus:border-[#ffb230]'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8B90A0] hover:text-white p-1 cursor-pointer"
                        >
                          {showConfirmPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Visual Password Strength Indicator & Entropy Calculation Meter (Red to Green) */}
                  {password ? (
                    <PasswordStrengthMeter password={password} lang={lang} showDetails={true} />
                  ) : (
                    <div className="rounded-xl bg-[#0d0f15] border border-white/5 p-2.5 sm:p-3 font-price space-y-2">
                      <div className="flex items-center justify-between text-[10.5px] sm:text-[11px]">
                        <span className="font-semibold text-[#8B90A0]">
                          {lang === 'KM' ? 'លក្ខខណ្ឌពាក្យសម្ងាត់សុវត្ថិភាព:' : 'Password Requirements:'}
                        </span>
                        <span className="text-[#8B90A0] text-[10px]">
                          {lang === 'KM' ? 'បញ្ចូលពាក្យសម្ងាត់ដើម្បីគណនា' : 'Type password to test entropy'}
                        </span>
                      </div>

                      {/* 3 Real-time Checkmark Pills */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10.5px] sm:text-[11px] bg-white/[0.02] border-white/5 text-[#8B90A0]">
                          <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 bg-white/10 text-[#8B90A0]">
                            <Circle className="w-1.5 h-1.5 fill-current" />
                          </div>
                          <span className="truncate">{lang === 'KM' ? 'យ៉ាងហោច ៨ តួ' : '8+ characters'}</span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10.5px] sm:text-[11px] bg-white/[0.02] border-white/5 text-[#8B90A0]">
                          <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 bg-white/10 text-[#8B90A0]">
                            <Circle className="w-1.5 h-1.5 fill-current" />
                          </div>
                          <span className="truncate">{lang === 'KM' ? 'មានអក្សរ (A-Z)' : 'At least 1 letter'}</span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10.5px] sm:text-[11px] bg-white/[0.02] border-white/5 text-[#8B90A0]">
                          <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 bg-white/10 text-[#8B90A0]">
                            <Circle className="w-1.5 h-1.5 fill-current" />
                          </div>
                          <span className="truncate">{lang === 'KM' ? 'មានលេខ (0-9)' : 'At least 1 number'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    id="submit-signup-btn"
                    type="submit"
                    disabled={!isSignUpSubmitActive}
                    className={`w-full py-2.5 sm:py-3 mt-1.5 rounded-lg sm:rounded-xl font-headline font-bold uppercase tracking-wider text-xs sm:text-sm shadow-md transition-all ${
                      !isSignUpSubmitActive
                        ? 'bg-[#181a24] text-[#5e6577] border border-white/5 cursor-not-allowed opacity-60 shadow-none'
                        : 'bg-[#ffb230] hover:bg-[#ffbe4d] text-[#291800] active:scale-98 cursor-pointer shadow-[0_0_15px_rgba(255,178,48,0.3)]'
                    }`}
                  >
                    {isLoading
                      ? lang === 'KM'
                        ? 'កំពុងបង្កើតគណនី...'
                        : 'Creating Account...'
                      : !password
                      ? lang === 'KM'
                        ? 'សូមបញ្ចូលពាក្យសម្ងាត់ (៨+ តួ, អក្សរ និងលេខ)'
                        : 'Enter Password (8+ chars, letter & number)'
                      : !isPasswordValid
                      ? lang === 'KM'
                        ? 'ពាក្យសម្ងាត់មិនទាន់គ្រប់ (៨+ តួ, អក្សរ និងលេខ)'
                        : 'Requires 8+ Chars, Letter & Number'
                      : !confirmPassword
                      ? lang === 'KM'
                        ? 'សូមផ្ទៀងផ្ទាត់ពាក្យសម្ងាត់'
                        : 'Please Confirm Password'
                      : !passwordsMatch
                      ? lang === 'KM'
                        ? 'ពាក្យសម្ងាត់មិនត្រូវគ្នាទេ'
                        : 'Passwords Do Not Match'
                      : lang === 'KM'
                      ? 'បង្កើតគណនី (Create Account)'
                      : 'Create Account'}
                  </button>
                </form>
              )}

          {/* FORM 3: FORGOT PASSWORD */}
          {activeTab === 'forgot' && (
            <div>
              {resetSuccessMessage ? (
                /* Professional Email Dispatched Screen */
                <div className="space-y-4 py-2 text-center animate-fade-in">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-[#3ECF8E]/15 border border-[#3ECF8E]/40 flex items-center justify-center text-[#3ECF8E] shadow-[0_0_20px_rgba(62,207,142,0.25)]">
                    <ShieldCheck className="w-8 h-8" />
                  </div>

                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#3ECF8E]/20 text-[#3ECF8E] text-[10px] font-headline font-bold uppercase tracking-wider mb-1 border border-[#3ECF8E]/30">
                      ✓ {lang === 'KM' ? 'តំណភ្ជាប់សុវត្ថិភាពត្រូវបានផ្ញើ' : 'Official Reset Link Dispatched'}
                    </span>
                    <h3 className="font-headline text-lg sm:text-xl text-[#ffd7a1] uppercase tracking-wide">
                      {lang === 'KM' ? 'ពិនិត្យមើលអ៊ីមែលរបស់អ្នក' : 'Check Your Email'}
                    </h3>
                    <p className="font-mono text-xs text-[#e2e2ec] mt-1 bg-[#11131a] py-1.5 px-3 rounded-lg border border-white/10 break-all max-w-xs mx-auto">
                      {sentResetEmail || email}
                    </p>
                  </div>

                  <div className="bg-[#11131a] rounded-xl p-3 border border-white/5 text-left space-y-2 text-[11px] font-price text-[#8B90A0]">
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#ffb230]/20 text-[#ffb230] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                      <span>{lang === 'KM' ? 'បើកប្រអប់សំបុត្រ (Inbox) ឬ ប្រអប់សារឥតបានការ (Spam/Junk)' : 'Open your Inbox (also check Spam/Junk folder)'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#ffb230]/20 text-[#ffb230] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                      <span>{lang === 'KM' ? 'ចុចលើតំណភ្ជាប់កំណត់ពាក្យសម្ងាត់ផ្លូវការពី Uchiro Store' : 'Click the official reset password link from Uchiro Store'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#ffb230]/20 text-[#ffb230] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                      <span>{lang === 'KM' ? 'បញ្ចូលពាក្យសម្ងាត់ថ្មី រួចត្រឡប់មកចូលប្រើប្រាស់វិញ' : 'Set your new password, then return here to login'}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('signin');
                        setErrorMessage(null);
                        setResetSuccessMessage(null);
                      }}
                      className="w-full py-2.5 bg-[#ffb230] hover:bg-[#ffbe4d] text-[#291800] rounded-xl font-headline font-bold uppercase tracking-wider text-xs sm:text-sm shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>{lang === 'KM' ? 'ត្រឡប់ទៅទំព័រចូលប្រើ (Sign In)' : 'Return to Sign In'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        if (resendCooldown === 0) {
                          handlePasswordReset(e);
                        }
                      }}
                      disabled={resendCooldown > 0 || isLoading}
                      className="w-full py-2 bg-[#1C1F29] hover:bg-[#252936] text-[#8B90A0] hover:text-[#ffd7a1] border border-white/10 rounded-xl font-price text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                      <span>
                        {resendCooldown > 0
                          ? `${lang === 'KM' ? 'ផ្ញើម្តងទៀតក្នុង' : 'Resend link in'} ${resendCooldown}s`
                          : lang === 'KM' ? 'មិនបានទទួល? ផ្ញើតំណភ្ជាប់ម្តងទៀត' : 'Didn\'t receive? Resend Link'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Forgot Password Request Form */
                <form onSubmit={handlePasswordReset} className="space-y-2.5 sm:space-y-3.5">
                  <div>
                    <label className="block text-[11px] sm:text-xs font-price text-[#8B90A0] mb-0.5 sm:mb-1 font-semibold">
                      {lang === 'KM' ? 'អាសយដ្ឋានអ៊ីមែល ឬ ឈ្មោះអ្នកប្រើដែលបានចុះឈ្មោះ' : 'Your Registered Email or Username'}
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 text-[#8B90A0]" />
                      <input
                        id="forgot-email-input"
                        type="text"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="username or email@example.com"
                        className="w-full bg-[#11131a] border border-white/10 rounded-lg sm:rounded-xl pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2.5 font-price text-xs sm:text-sm text-[#e2e2ec] focus:outline-none focus:border-[#ffb230]"
                      />
                    </div>
                    <p className="font-price text-[10px] text-[#8B90A0] mt-1">
                      {lang === 'KM'
                        ? '🛡️ ការកំណត់ពាក្យសម្ងាត់ឡើងវិញអាចធ្វើបានសម្រាប់តែគណនីដែលមានក្នុងប្រព័ន្ធប៉ុណ្ណោះ។'
                        : '🛡️ Password reset is exclusively sent to accounts that exist in our database.'}
                    </p>
                  </div>

                  <button
                    id="send-reset-email-btn"
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 bg-[#ffb230] hover:bg-[#ffbe4d] text-[#291800] rounded-lg sm:rounded-xl font-headline font-bold uppercase tracking-wider text-xs sm:text-sm shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {isLoading
                        ? lang === 'KM'
                          ? 'កំពុងផ្ទៀងផ្ទាត់គណនី...'
                          : 'Verifying Account & Sending...'
                        : lang === 'KM'
                        ? 'ផ្ទៀងផ្ទាត់គណនី & ផ្ញើតំណភ្ជាប់ផ្លូវការ'
                        : 'Verify Account & Send Official Link'}
                    </span>
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('signin');
                        setErrorMessage(null);
                        setResetSuccessMessage(null);
                      }}
                      className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-price text-[#8B90A0] hover:text-[#ffd7a1] transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>{lang === 'KM' ? 'ត្រឡប់ទៅទំព័រចូលប្រើ' : 'Back to Login'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </>
      )}
    </div>
      </div>
    </div>
  );
};
