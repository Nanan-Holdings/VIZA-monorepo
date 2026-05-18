'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import createGlobe from 'cobe'
import { AuthLanguageSwitcher } from '@/components/client/auth-language-switcher'
import { useTranslations } from 'next-intl'

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export default function ClientSignupPage() {
  const t = useTranslations('auth.signup')
  const tp = useTranslations('auth.polaroids')
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
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (!isValidEmail(email)) { setError(t('invalidEmail')); return }
    setIsSubmitting(true)
    setTimeout(() => { setIsSubmitting(false); setIsSubmitted(true) }, 800)
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
          {!isSubmitted ? (
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

              <form onSubmit={handleSubmit} className="flex flex-col gap-[clamp(10px,1.5vh,16px)]">
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
                  disabled={isSubmitting}
                  className="flex h-[clamp(36px,4.8vh,42px)] w-full items-center justify-center rounded-[999px] bg-black font-sans text-[clamp(12px,1vw,14px)] font-medium tracking-[-0.24px] text-white transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{t('submitting')}</span>
                    : t('requestInvite')}
                </button>
                <div className="h-[clamp(24px,4.5vh,48px)]" />
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              className="flex w-full flex-col gap-[clamp(16px,3vh,40px)] shrink-0"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
            >
              <div className="rounded-[16px] border border-[#d1e7dd] bg-[#f0faf4] px-[clamp(16px,1.5vw,24px)] py-[clamp(14px,2vh,20px)]">
                <p className="font-sans text-[clamp(13px,1.1vw,16px)] font-medium leading-[1.5] text-[#3d3d3d]">
                  {t('thankYou')}
                </p>
                <p className="mt-2 font-sans text-[clamp(11px,0.9vw,14px)] text-[rgba(0,0,0,0.55)]">
                  {t('urgentAccess')}
                </p>
              </div>

              <Link
                href="/client/login"
                className="flex h-[clamp(36px,4.8vh,42px)] w-full items-center justify-center rounded-[999px] bg-black font-sans text-[clamp(12px,1vw,14px)] font-medium tracking-[-0.24px] text-white transition-opacity hover:opacity-80"
              >
                {t('backToLogin')}
              </Link>
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
