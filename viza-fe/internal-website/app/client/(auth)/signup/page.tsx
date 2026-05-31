'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import createGlobe from 'cobe'
import { createClient } from '@/lib/supabase/client'
import { prepareAuthEmailLocale } from '@/app/actions/client-auth'
import { AuthLanguageSwitcher } from '@/components/client/auth-language-switcher'
import { normalizeAuthEmailLocale } from '@/lib/i18n/locale'
import { useLocale, useTranslations } from 'next-intl'

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

type SignupStep = 'email' | 'otp' | 'password'
type PasswordRequirementKey = 'length' | 'letter' | 'digit' | 'symbol'

function getPasswordScore(password: string) {
  const checks = {
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  }
  const score = Object.values(checks).filter(Boolean).length
  return { checks, score, isValid: checks.length && checks.letter && checks.digit && checks.symbol }
}

export default function ClientSignupPage() {
  const t = useTranslations('auth.signup')
  const tp = useTranslations('auth.polaroids')
  const locale = useLocale()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerRef = useRef({ dragging: false, startX: 0, startY: 0, phiStart: 0, thetaStart: 0 })
  const stateRef = useRef({ phi: 0, theta: 0.2 })

  const polaroidMarkers = [
    { id: 'polaroid-sf', location: [37.78, -122.44] as [number, number], image: '/globe/sf.jpg', caption: tp('sanFrancisco'), rotate: -5 },
    { id: 'polaroid-nyc', location: [40.71, -74.01] as [number, number], image: '/globe/nyc.jpg', caption: tp('newYork'), rotate: 4 },
    { id: 'polaroid-tokyo', location: [35.68, 139.65] as [number, number], image: '/globe/tokyo.jpg', caption: tp('tokyo'), rotate: -3 },
    { id: 'polaroid-sydney', location: [-33.87, 151.21] as [number, number], image: '/globe/sydney.jpg', caption: tp('sydney'), rotate: 6 },
    { id: 'polaroid-beijing', location: [39.9, 116.4] as [number, number], image: '/globe/beijing.jpg', caption: tp('beijing'), rotate: -4 },
    { id: 'polaroid-egypt', location: [29.98, 31.13] as [number, number], image: '/globe/egypt.jpg', caption: tp('egypt'), rotate: 3 },
    { id: 'polaroid-pisa', location: [43.72, 10.4] as [number, number], image: '/globe/pisa.jpg', caption: tp('pisa'), rotate: -6 },
    { id: 'polaroid-singapore', location: [1.35, 103.82] as [number, number], image: '/globe/singapore.jpg', caption: tp('singapore'), rotate: 5 },
  ]

  // --- Globe drag handlers ---
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerRef.current.dragging = true
    pointerRef.current.startX = e.clientX
    pointerRef.current.startY = e.clientY
    pointerRef.current.phiStart = stateRef.current.phi
    pointerRef.current.thetaStart = stateRef.current.theta
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerRef.current.dragging) return
    const dx = e.clientX - pointerRef.current.startX
    const dy = e.clientY - pointerRef.current.startY
    stateRef.current.phi = pointerRef.current.phiStart - dx * 0.005
    stateRef.current.theta = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pointerRef.current.thetaStart + dy * 0.005))
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointerRef.current.dragging = false
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }, [])

  // --- Globe setup ---
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const width = 1352
    const pixelRatio = Math.min(window.devicePixelRatio, 2)
    canvas.width = width * pixelRatio
    canvas.height = width * pixelRatio

    const globe = createGlobe(canvas, {
      devicePixelRatio: pixelRatio,
      width: width * pixelRatio,
      height: width * pixelRatio,
      phi: 0,
      theta: 0.2,
      dark: 0,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 9,
      baseColor: [1, 1, 1],
      markerColor: [0.4, 0.6, 0.9],
      glowColor: [1, 1, 1],
      markers: polaroidMarkers.map((m) => ({ location: m.location, size: 0.02, id: m.id })),
    })

    let rafId: number
    function animate() {
      if (!pointerRef.current.dragging) {
        stateRef.current.phi += 0.003
      }
      globe.update({ phi: stateRef.current.phi, theta: stateRef.current.theta })
      rafId = requestAnimationFrame(animate)
    }
    animate()

    setTimeout(() => { canvas.style.opacity = '1' }, 100)

    return () => {
      cancelAnimationFrame(rafId)
      globe.destroy()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Signup state ---
  const [step, setStep] = useState<SignupStep>('email')
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [acceptTos, setAcceptTos] = useState(false)
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  const consentReady = acceptTos && acceptPrivacy
  const passwordStrength = getPasswordScore(password)
  const passwordsMatch = password.length > 0 && password === confirmPassword
  const strengthKey =
    passwordStrength.score >= 4 && password.length >= 12
      ? 'strong'
      : passwordStrength.score >= 4
        ? 'good'
        : passwordStrength.score >= 2
          ? 'fair'
          : 'weak'

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((value) => value - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const sendSignupCode = async (targetEmail: string) => {
    const supabase = createClient()
    const emailLocale = normalizeAuthEmailLocale(locale)
    await prepareAuthEmailLocale(targetEmail, emailLocale)
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: targetEmail.toLowerCase().trim(),
      options: {
        shouldCreateUser: true,
        data: {
          role: 'client',
          user_type: 'client',
          locale: emailLocale,
          language: emailLocale,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/client/login`,
      },
    })

    if (authError) {
      setError(authError.message || t('failedToSendCode'))
      return false
    }

    return true
  }

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (!isValidEmail(email)) { setError(t('invalidEmail')); return }
    if (!consentReady) {
      setError(t('acceptRequired'))
      return
    }

    setIsSubmitting(true)
    try {
      const ok = await sendSignupCode(email)
      if (ok) {
        setStep('otp')
        setOtpCode('')
        setResendCooldown(60)
      }
    } catch (err) {
      console.error(err)
      setError(t('unexpectedError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const verifySignupCode = async (code: string) => {
    const normalizedCode = code.replace(/\D/g, '').slice(0, 8)
    if (normalizedCode.length !== 8) return
    setError(null)
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const verifyAttempts = [
        await supabase.auth.verifyOtp({
          email: email.toLowerCase().trim(),
          token: normalizedCode,
          type: 'signup',
        }),
      ]

      if (verifyAttempts[0].error) {
        verifyAttempts.push(
          await supabase.auth.verifyOtp({
            email: email.toLowerCase().trim(),
            token: normalizedCode,
            type: 'email',
          })
        )
      }

      const verified = verifyAttempts.some((attempt) => !attempt.error)
      if (!verified) {
        setError(verifyAttempts.at(-1)?.error?.message ?? t('authFailed'))
        return
      }

      setStep('password')
      setOtpCode('')
    } catch (err) {
      console.error(err)
      setError(t('unexpectedError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setError(null)
    setIsSubmitting(true)
    try {
      const ok = await sendSignupCode(email)
      if (ok) {
        setOtpCode('')
        setResendCooldown(60)
      }
    } catch (err) {
      console.error(err)
      setError(t('failedToResend'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (!passwordStrength.isValid) { setError(t('passwordRequirementError')); return }
    if (!passwordsMatch) { setError(t('passwordMismatch')); return }
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const normalizedEmail = email.toLowerCase().trim()
      const emailLocale = normalizeAuthEmailLocale(locale)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || user.email?.toLowerCase() !== normalizedEmail) {
        setError(t('verifyEmailFirst'))
        setIsSubmitting(false)
        setStep('otp')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: {
          role: 'client',
          user_type: 'client',
          locale: emailLocale,
          language: emailLocale,
        },
      })

      if (updateError) {
        setError(updateError.message)
        setIsSubmitting(false)
        return
      }
      try {
        const { recordSignupConsent } = await import('@/app/actions/consent')
        await recordSignupConsent({ email: normalizedEmail })
      } catch (consentError) {
        console.error('Could not record signup consent:', consentError)
      }
      await supabase.auth.signOut()
      window.location.href = '/client/login?registered=1'
    } catch (err) {
      setError(err instanceof Error ? err.message : t('unexpectedError'))
      setIsSubmitting(false)
    } finally {
      if (typeof window === 'undefined') setIsSubmitting(false)
    }
  }

  return (
    <div style={{ height: '100vh', background: 'linear-gradient(to bottom, #03346E, #3D6DAD)', display: 'flex', alignItems: 'stretch', overflow: 'hidden', position: 'relative', padding: 'clamp(32px, 4vh, 64px) 0 clamp(32px, 4vh, 64px) clamp(36px, 4.4vh, 68px)' }}>

      {/* ── Signup Panel (left) ── */}
      <motion.section
        className="relative flex flex-col justify-between bg-white px-4 py-[clamp(20px,3vh,36px)] lg:px-[clamp(20px,2.5vw,40px)] lg:py-[clamp(20px,3vh,60px)] rounded-[16px]"
        style={{ width: '45%', maxWidth: 545, zIndex: 10, flexShrink: 0 }}
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Logo */}
        <div className="shrink-0 pt-4">
          <Image src="/logo/viza-logo-blue.svg" alt="VIZA" width={80} height={24} priority />
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {step === 'email' ? (
            <motion.div
              key="form"
              className="flex w-full flex-col gap-[clamp(16px,3vh,40px)] shrink-0"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.25 }}
            >
              <Link
                href="/client/login"
                className="flex h-7 w-7 shrink-0 items-center justify-center text-[#3d3d3d] hover:opacity-60 transition-opacity"
                aria-label="Back to login"
              >
                <ArrowLeft className="h-7 w-7" />
              </Link>

              <div className="flex flex-col gap-[4px]">
                <h1 className="text-[clamp(20px,3vw,36px)] font-normal leading-[1.3] tracking-[-1px] text-[#3d3d3d]">
                  {t('title')}
                </h1>
                <p className="text-[clamp(12px,1.3vw,15px)] tracking-[-0.24px] leading-[1.5] text-[rgba(0,0,0,0.55)]">
                  {t('subtitle')}
                </p>
              </div>

              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-[clamp(10px,1.5vh,16px)]">
                <input
                  type="email"
                  name="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  disabled={isSubmitting}
                  className="h-[clamp(36px,4.8vh,46px)] w-full rounded-[8px] border border-[#efefef] bg-white pl-[clamp(10px,1.3vw,17px)] pr-[10px] font-sans text-[clamp(11px,1vw,14px)] tracking-[-0.21px] text-[#3d3d3d] placeholder:text-[#3d3d3d]/50 outline-none focus:border-[#3d3d3d] transition-colors disabled:opacity-50"
                />
                <label className="flex items-start gap-2 text-[12px] tracking-[-0.18px] text-[#3d3d3d]">
                  <input
                    type="checkbox"
                    checked={acceptTos}
                    onChange={(e) => setAcceptTos(e.target.checked)}
                    className="mt-[3px] h-4 w-4 cursor-pointer accent-black"
                    required
                  />
                  <span>
                    I accept the{' '}
                    <Link href="/terms" className="underline hover:opacity-70">
                      Terms of Service
                    </Link>
                    .
                  </span>
                </label>
                <label className="flex items-start gap-2 text-[12px] tracking-[-0.18px] text-[#3d3d3d]">
                  <input
                    type="checkbox"
                    checked={acceptPrivacy}
                    onChange={(e) => setAcceptPrivacy(e.target.checked)}
                    className="mt-[3px] h-4 w-4 cursor-pointer accent-black"
                    required
                  />
                  <span>
                    I accept the{' '}
                    <Link href="/privacy" className="underline hover:opacity-70">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
                {error && (
                  <motion.p
                    className="rounded-[12px] border border-[#f7c7ba] bg-[#ffe8e0] px-4 py-2 text-[13px] text-[#a13d2d]"
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  >
                    {error}
                  </motion.p>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting || !consentReady}
                  className="flex h-[clamp(36px,4.8vh,42px)] w-full items-center justify-center rounded-[999px] bg-black font-sans text-[clamp(12px,1vw,14px)] font-medium tracking-[-0.24px] text-white transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{t('sendingCode')}</span>
                    : t('sendCodeButton')}
                </button>
                <div className="h-[clamp(24px,4.5vh,48px)]" />
              </form>
            </motion.div>
          ) : step === 'otp' ? (
            <motion.div
              key="otp"
              className="flex w-full flex-col gap-[clamp(16px,3vh,40px)] shrink-0"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
            >
              <button
                onClick={() => { setStep('email'); setError(null); setOtpCode('') }}
                className="flex h-7 w-7 shrink-0 items-center justify-center text-[#3d3d3d] hover:opacity-60 transition-opacity"
                aria-label={t('back')}
                type="button"
              >
                <ArrowLeft className="h-7 w-7" />
              </button>

              <div className="flex flex-col gap-[4px]">
                <h1 className="text-[clamp(20px,3vw,36px)] font-normal leading-[1.3] tracking-[-1px] text-[#3d3d3d]">
                  {t('verifyEmailTitle')}
                </h1>
                <p className="text-[clamp(12px,1.3vw,15px)] tracking-[-0.24px] leading-[1.5] text-[rgba(0,0,0,0.55)]">
                  {t('sentCodeTo')} <span className="text-brand-500">{email}</span>
                </p>
              </div>

              <div className="flex flex-col gap-[clamp(10px,1.5vh,16px)]">
                <div className="flex w-full gap-2 sm:gap-3">
                  {Array.from({ length: 8 }, (_, i) => (
                    <input
                      key={i}
                      id={`signup-otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      disabled={isSubmitting}
                      value={otpCode[i] ?? ''}
                      aria-label={t('otpDigitLabel', { digit: i + 1 })}
                      className="flex-1 h-[clamp(36px,4.8vh,46px)] w-0 min-w-0 rounded-[8px] border border-[#d1d5db] bg-white text-center font-sans text-[clamp(12px,1vw,14px)] text-[#3d3d3d] focus:outline-none focus:border-[#3d3d3d] focus:ring-1 focus:ring-[#3d3d3d]"
                      onChange={(event) => {
                        const val = event.target.value.replace(/\D/g, '').slice(-1)
                        const nextCode = `${otpCode.slice(0, i)}${val}${otpCode.slice(i + 1)}`.slice(0, 8)
                        setOtpCode(nextCode)
                        if (val) {
                          const next = document.getElementById(`signup-otp-${i + 1}`) as HTMLInputElement | null
                          if (next) next.focus()
                        }
                        if (nextCode.length === 8) void verifySignupCode(nextCode)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Backspace' && !otpCode[i]) {
                          const prev = document.getElementById(`signup-otp-${i - 1}`) as HTMLInputElement | null
                          if (prev) prev.focus()
                        }
                      }}
                      onPaste={i === 0 ? (event) => {
                        event.preventDefault()
                        const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8)
                        setOtpCode(pasted)
                        if (pasted.length === 8) {
                          void verifySignupCode(pasted)
                        } else {
                          const next = document.getElementById(`signup-otp-${pasted.length}`) as HTMLInputElement | null
                          if (next) next.focus()
                        }
                      } : undefined}
                    />
                  ))}
                </div>

                {error && (
                  <motion.p
                    className="rounded-[12px] border border-[#f7c7ba] bg-[#ffe8e0] px-4 py-2 text-[13px] text-[#a13d2d]"
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  >
                    {error}
                  </motion.p>
                )}

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || isSubmitting}
                  className="flex h-[clamp(36px,4.8vh,42px)] w-full items-center justify-center rounded-[999px] bg-[#dcdcdc] font-sans text-[clamp(12px,1vw,14px)] font-medium tracking-[-0.24px] text-[#989898] transition-all disabled:cursor-not-allowed enabled:bg-black enabled:text-white enabled:hover:opacity-80"
                >
                  {isSubmitting
                    ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{t('sendingCode')}</span>
                    : resendCooldown > 0 ? t('resendIn', { seconds: resendCooldown }) : t('resendCode')}
                </button>
                <div className="h-[clamp(24px,4.5vh,48px)]" />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="password"
              className="flex w-full flex-col gap-[clamp(16px,3vh,40px)] shrink-0"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
            >
              <button
                onClick={() => { setStep('email'); setError(null) }}
                className="flex h-7 w-7 shrink-0 items-center justify-center text-[#3d3d3d] hover:opacity-60 transition-opacity"
                aria-label={t('back')}
                type="button"
              >
                <ArrowLeft className="h-7 w-7" />
              </button>

              <div className="flex flex-col gap-[4px]">
                <h1 className="text-[clamp(20px,3vw,36px)] font-normal leading-[1.3] tracking-[-1px] text-[#3d3d3d]">
                  {t('setPasswordTitle')}
                </h1>
                <p className="text-[clamp(12px,1.3vw,15px)] tracking-[-0.24px] leading-[1.5] text-[rgba(0,0,0,0.55)]">
                  {t('setPasswordSubtitle')}
                </p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-[clamp(10px,1.5vh,16px)]">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder={t('passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    className="h-[clamp(36px,4.8vh,46px)] w-full rounded-[8px] border border-[#efefef] bg-white pl-[clamp(10px,1.3vw,17px)] pr-12 font-sans text-[clamp(11px,1vw,14px)] tracking-[-0.21px] text-[#3d3d3d] placeholder:text-[#3d3d3d]/50 outline-none focus:border-[#3d3d3d] transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#737373] hover:bg-[#f5f5f5]"
                    aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="space-y-2 rounded-[12px] border border-[#efefef] bg-[#fafafa] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] font-medium text-[#3d3d3d]">{t('passwordStrength')}</span>
                    <span className="text-[12px] font-medium text-brand-500">{t(`strength.${strengthKey}`)}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <span
                        key={level}
                        className={`h-1.5 rounded-full ${passwordStrength.score >= level ? 'bg-brand-500' : 'bg-[#e5e7eb]'}`}
                      />
                    ))}
                  </div>
                  <div className="grid gap-1 text-[12px] text-[rgba(0,0,0,0.55)]">
                    {([
                      ['length', passwordStrength.checks.length],
                      ['letter', passwordStrength.checks.letter],
                      ['digit', passwordStrength.checks.digit],
                      ['symbol', passwordStrength.checks.symbol],
                    ] satisfies Array<[PasswordRequirementKey, boolean]>).map(([key, ok]) => (
                      <span key={key} className="flex items-center gap-2">
                        <CheckCircle2 className={`h-3.5 w-3.5 ${ok ? 'text-brand-500' : 'text-[#bdbdbd]'}`} />
                        {t(`requirements.${key}`)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    placeholder={t('confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    className="h-[clamp(36px,4.8vh,46px)] w-full rounded-[8px] border border-[#efefef] bg-white pl-[clamp(10px,1.3vw,17px)] pr-12 font-sans text-[clamp(11px,1vw,14px)] tracking-[-0.21px] text-[#3d3d3d] placeholder:text-[#3d3d3d]/50 outline-none focus:border-[#3d3d3d] transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#737373] hover:bg-[#f5f5f5]"
                    aria-label={showConfirmPassword ? t('hidePassword') : t('showPassword')}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {confirmPassword && !passwordsMatch && (
                  <p className="text-[12px] text-[#a13d2d]" role="alert">{t('passwordMismatch')}</p>
                )}

                {error && (
                  <motion.p
                    className="rounded-[12px] border border-[#f7c7ba] bg-[#ffe8e0] px-4 py-2 text-[13px] text-[#a13d2d]"
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  >
                    {error}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !passwordStrength.isValid || !passwordsMatch}
                  className="flex h-[clamp(36px,4.8vh,42px)] w-full items-center justify-center rounded-[999px] bg-black font-sans text-[clamp(12px,1vw,14px)] font-medium tracking-[-0.24px] text-white transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{t('creatingAccount')}</span>
                    : t('createAccount')}
                </button>
                <div className="h-[clamp(24px,4.5vh,48px)]" />
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex items-center gap-[16px] font-sans text-[clamp(10px,0.85vw,12px)] font-medium tracking-[-0.21px] leading-[1.5] text-[rgba(0,0,0,0.55)] shrink-0">
          <Link href="/privacy" className="whitespace-nowrap hover:opacity-70 transition-opacity">{t('privacyPolicy')}</Link>
          <Link href="/terms" className="whitespace-nowrap hover:opacity-70 transition-opacity">{t('termsOfService')}</Link>
          <AuthLanguageSwitcher />
        </div>
      </motion.section>

      {/* ── Globe (right) ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        position: 'relative',
      }}>
      <div style={{
        width: 1222,
        height: 1222,
        flexShrink: 0,
        position: 'relative',
        userSelect: 'none',
        marginTop: 390,
        marginLeft: 100,
      }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            aspectRatio: '1',
            opacity: 0,
            transition: 'opacity 0.8s ease',
            borderRadius: '50%',
            cursor: 'grab',
            touchAction: 'none',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />

        {/* Polaroid overlays */}
        {polaroidMarkers.map((m) => (
          <div
            key={m.id}
            className="showcase-polaroid"
            style={{
              positionAnchor: `--cobe-${m.id}`,
              opacity: `var(--cobe-visible-${m.id}, 0)`,
              filter: `blur(calc((1 - var(--cobe-visible-${m.id}, 0)) * 8px))`,
              ['--polaroid-rotate' as string]: `${m.rotate}deg`,
            } as React.CSSProperties}
          >
            <img src={m.image} alt={m.caption} />
            <span className="showcase-polaroid-caption">{m.caption}</span>
          </div>
        ))}
      </div>
      </div>

      <style>{`
        .showcase-polaroid {
          position: absolute;
          bottom: anchor(top);
          left: anchor(center);
          translate: -50% 0;
          margin-bottom: 8px;
          background: #fff;
          padding: 6px 6px 24px;
          box-shadow:
            0 2px 8px rgba(0, 0, 0, 0.15),
            0 1px 2px rgba(0, 0, 0, 0.1);
          transform: rotate(var(--polaroid-rotate, 0deg));
          transition: opacity 0.3s, filter 0.3s;
          pointer-events: none;
        }

        .showcase-polaroid img {
          display: block;
          width: 60px;
          height: 60px;
          object-fit: cover;
        }

        .showcase-polaroid-caption {
          position: absolute;
          bottom: 5px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 0.5rem;
          color: #333;
          letter-spacing: 0.02em;
        }

        @media (max-width: 640px) {
          .showcase-polaroid {
            padding: 4px 4px 18px;
          }

          .showcase-polaroid img {
            width: 45px;
            height: 45px;
          }

          .showcase-polaroid-caption {
            font-size: 0.4rem;
            bottom: 4px;
          }
        }
      `}</style>
    </div>
  )
}
