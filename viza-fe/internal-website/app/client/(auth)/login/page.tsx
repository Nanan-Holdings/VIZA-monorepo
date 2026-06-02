'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState, useEffect, useRef, useCallback, Suspense, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { prepareAuthEmailLocale, validateUserEmail } from '@/app/actions/client-auth'
import createGlobe from 'cobe'
import { AuthLanguageSwitcher } from '@/components/client/auth-language-switcher'
import { normalizeAuthEmailLocale } from '@/lib/i18n/locale'
import { useLocale, useTranslations } from 'next-intl'

type Step = 'email' | 'otp'
type LoginMethod = 'password' | 'otp'

function ClientLoginContent() {
  const t = useTranslations('auth.login')
  const tp = useTranslations('auth.polaroids')
  const locale = useLocale()
  const searchParams = useSearchParams()
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

  // --- Login state ---
  const [step, setStep] = useState<Step>('email')
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam === 'not_a_user') setError(t('notRegistered'))
    else if (errorParam === 'auth_failed') setError(t('authFailed'))
    if (searchParams.get('registered') === '1') setNotice(t('registeredSuccess'))
    if (searchParams.get('reset') === '1') setNotice(t('resetSuccess'))
  }, [searchParams, t])

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const sendOtp = async (targetEmail: string): Promise<boolean> => {
    const supabase = createClient()
    const emailLocale = normalizeAuthEmailLocale(locale)
    await prepareAuthEmailLocale(targetEmail, emailLocale)
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: targetEmail.toLowerCase().trim(),
      options: {
        shouldCreateUser: false,
        data: {
          locale: emailLocale,
          language: emailLocale,
          preferred_language: emailLocale,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (authError) {
      setError(authError.message.includes('User not found')
        ? t('noAccountFound')
        : authError.message || t('failedToSendCode'))
      return false
    }
    return true
  }

  const verifyOtp = async (otpCode: string) => {
    setIsSubmitting(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({ email: email.toLowerCase().trim(), token: otpCode, type: 'email' })
    if (error) { setError(error.message); setIsSubmitting(false); return }
    window.location.href = '/client/home'
  }

  const handleOtpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setIsSubmitting(true)
    try {
      const result = await validateUserEmail(email)
      if (!result.success) { setError(result.error ?? t('noAccountWithEmail')); setIsSubmitting(false); return }
      const ok = await sendOtp(email)
      setIsSubmitting(false)
      if (ok) { setStep('otp'); setResendCooldown(60) }
    } catch (err) {
      setIsSubmitting(false)
      setError(t('unexpectedError'))
      console.error(err)
    }
  }

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setIsSubmitting(true)
    try {
      const result = await validateUserEmail(email)
      if (!result.success) { setError(result.error ?? t('noAccountWithEmail')); setIsSubmitting(false); return }
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      })
      if (authError) {
        setError(authError.message || t('authFailed'))
        setIsSubmitting(false)
        return
      }
      window.location.href = '/client/home'
    } catch (err) {
      setIsSubmitting(false)
      setError(t('unexpectedError'))
      console.error(err)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setError(null)
    setIsSubmitting(true)
    try {
      const ok = await sendOtp(email)
      setIsSubmitting(false)
      if (ok) setResendCooldown(60)
    } catch (err) {
      setIsSubmitting(false)
      setError(t('failedToResend'))
      console.error(err)
    }
  }

  return (
    <div style={{ height: '100vh', background: 'linear-gradient(to bottom, #03346E, #3D6DAD)', display: 'flex', alignItems: 'stretch', overflow: 'hidden', position: 'relative', padding: 'clamp(32px, 4vh, 64px) 0 clamp(32px, 4vh, 64px) clamp(36px, 4.4vh, 68px)' }}>

      {/* ── Login Panel (left) ── */}
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
              key="email"
              className="flex w-full flex-col gap-[clamp(16px,3vh,40px)] shrink-0"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex flex-col gap-[4px]">
                <h1 className="text-[clamp(20px,3vw,36px)] font-normal leading-[1.3] tracking-[-1px] text-[#3d3d3d]">
                  {t('title')}
                </h1>
                <p className="text-[clamp(12px,1.3vw,15px)] tracking-[-0.24px] leading-[1.5] text-[rgba(0,0,0,0.55)]">
                  {t('noAccount')}{' '}
                  <Link href="/client/signup" className="text-brand-500 underline decoration-solid">{t('signUp')}</Link>
                </p>
              </div>

              <form
                onSubmit={loginMethod === 'password' ? handlePasswordSubmit : handleOtpSubmit}
                className="flex flex-col gap-[clamp(10px,1.5vh,16px)]"
              >
                <div className="grid grid-cols-2 gap-2 rounded-[999px] bg-[#f5f5f5] p-1">
                  {(['password', 'otp'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => { setLoginMethod(method); setError(null); setNotice(null) }}
                      className={`h-9 rounded-[999px] text-[13px] font-medium transition-colors ${
                        loginMethod === method ? 'bg-white text-[#3d3d3d] shadow-sm' : 'text-[rgba(0,0,0,0.55)] hover:text-[#3d3d3d]'
                      }`}
                    >
                      {method === 'password' ? t('passwordLogin') : t('codeLogin')}
                    </button>
                  ))}
                </div>
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
                {loginMethod === 'password' && (
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        placeholder={t('passwordPlaceholder')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
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
                    <Link href="/forgot-password" className="block text-right text-[12px] font-medium text-brand-500 underline">
                      {t('forgotPassword')}
                    </Link>
                  </div>
                )}
                {notice && (
                  <motion.p
                    className="rounded-[12px] border border-[#cfe8d5] bg-[#f0faf4] px-4 py-2 text-[13px] text-[#276749]"
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  >
                    {notice}
                  </motion.p>
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
                  disabled={isSubmitting || (loginMethod === 'password' && !password)}
                  className="flex h-[clamp(36px,4.8vh,42px)] w-full items-center justify-center rounded-[999px] bg-black font-sans text-[clamp(12px,1vw,14px)] font-medium tracking-[-0.24px] text-white transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{loginMethod === 'password' ? t('signingIn') : t('sendingCode')}</span>
                    : loginMethod === 'password' ? t('loginButton') : t('sendCodeButton')}
                </button>
                <div className="h-[clamp(24px,4.5vh,48px)]" />
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              className="flex w-full flex-col gap-[clamp(16px,3vh,40px)] shrink-0"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
            >
              <button
                onClick={() => { setStep('email'); setError(null) }}
                className="flex h-7 w-7 shrink-0 items-center justify-center text-[#3d3d3d] hover:opacity-60 transition-opacity"
                aria-label="Back"
              >
                <ArrowLeft className="h-7 w-7" />
              </button>

              <div className="flex flex-col gap-[clamp(16px,3vh,40px)]">
                <div className="flex flex-col gap-[4px]">
                  <h1 className="text-[clamp(20px,3vw,36px)] font-normal leading-[1.3] tracking-[-1px] text-[#3d3d3d]">
                    {t('checkEmail')}
                  </h1>
                  <div className="text-[clamp(12px,1.3vw,15px)] tracking-[-0.24px] leading-[1.5] text-[rgba(0,0,0,0.55)]">
                    <p>{t('sentCodeTo')} <span className="text-brand-500">{email}</span></p>
                    <p>{t('clickLink')}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-[clamp(10px,1.5vh,16px)]">
                  <div className="flex w-full gap-2 sm:gap-3">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <input
                        key={i}
                        id={`otp-${i}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        disabled={isSubmitting}
                        className="flex-1 h-[clamp(36px,4.8vh,46px)] w-0 min-w-0 rounded-[8px] border border-[#d1d5db] bg-white text-center font-sans text-[clamp(12px,1vw,14px)] text-[#3d3d3d] focus:outline-none focus:border-[#3d3d3d] focus:ring-1 focus:ring-[#3d3d3d]"
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '')
                          e.target.value = val.slice(-1)
                          if (val) {
                            const next = document.getElementById(`otp-${i + 1}`) as HTMLInputElement
                            if (next) next.focus()
                          }
                          const allInputs = Array.from({ length: 8 }, (_, j) => {
                            const el = document.getElementById(`otp-${j}`) as HTMLInputElement
                            return el ? el.value : ''
                          })
                          const combined = allInputs.join('')
                          if (combined.length === 8) verifyOtp(combined)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !(e.target as HTMLInputElement).value) {
                            const prev = document.getElementById(`otp-${i - 1}`) as HTMLInputElement
                            if (prev) { prev.focus(); prev.value = '' }
                          }
                        }}
                        onPaste={i === 0 ? (e) => {
                          e.preventDefault()
                          const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8)
                          pasted.split('').forEach((ch, j) => {
                            const el = document.getElementById(`otp-${j}`) as HTMLInputElement
                            if (el) el.value = ch
                          })
                          if (pasted.length === 8) verifyOtp(pasted)
                          else {
                            const next = document.getElementById(`otp-${pasted.length}`) as HTMLInputElement
                            if (next) next.focus()
                          }
                        } : undefined}
                      />
                    ))}
                  </div>
                  {error && (
                    <motion.p
                      className="rounded-[12px] border border-[#f7c7ba] bg-[#ffe8e0] px-4 py-3 text-[14px] text-[#a13d2d]"
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
                      ? <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />{t('sendingCode')}</span>
                      : resendCooldown > 0 ? t('resendIn', { seconds: resendCooldown }) : t('resendCode')}
                  </button>
                </div>
              </div>
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

export default function ClientLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#03346E] to-[#3D6DAD]"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>}>
      <ClientLoginContent />
    </Suspense>
  )
}
