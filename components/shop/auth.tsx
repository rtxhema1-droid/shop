'use client'

import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import { PROMISE, PROMISE_SUB, STORE_NAME } from '@/lib/config'
import { Field, Modal, api, errorText, formValues } from './shared'

type Mode = 'in' | 'up'

/** نموذج الدخول/التسجيل المشترك بين الشاشة الأولى والمودال */
function AuthForm({ mode, onMode, compact }: { mode: Mode; onMode: (mode: Mode) => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const values = formValues(event)
    try {
      await api(mode === 'in' ? 'sign-in' : 'sign-up', 'POST', values)
      try { window.sessionStorage.setItem('rtx-welcome', '1') } catch {}
      window.location.reload()
    } catch (reason) {
      setError(errorText(reason))
      setBusy(false)
    }
  }

  return (
    <>
      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'on' : ''} onClick={() => { onMode('in'); setError('') }}>
          {compact ? 'دخول' : 'تسجيل الدخول'}
        </button>
        <button type="button" role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'on' : ''} onClick={() => { onMode('up'); setError('') }}>
          حساب جديد
        </button>
      </div>
      <form className="stack" onSubmit={submit} key={mode}>
        {mode === 'up' && (
          <Field label="الاسم">
            <input name="name" required maxLength={100} autoComplete="name" placeholder="الاسم بالكامل" />
          </Field>
        )}
        {mode === 'in' ? (
          <Field label="رقم الموبايل أو اسم المستخدم">
            <input name="identifier" required maxLength={254} autoComplete="username" placeholder="01012345678" dir="ltr" inputMode="text" />
          </Field>
        ) : (
          <>
            <Field label="رقم الموبايل">
              <input name="phone" required autoComplete="tel" placeholder="01012345678" dir="ltr" inputMode="tel" />
            </Field>
            <Field label="البريد الإلكتروني (اختياري)">
              <input name="email" type="email" maxLength={254} autoComplete="email" placeholder="name@example.com" dir="ltr" />
            </Field>
          </>
        )}
        <Field label="كلمة السر" hint={mode === 'up' ? '8 حروف أو أرقام على الأقل' : undefined}>
          <div className="pw">
            <input name="password" type={show ? 'text' : 'password'} required minLength={mode === 'up' ? 8 : 1} maxLength={200} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} dir="ltr" />
            <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}>
              {show ? <EyeOff /> : <Eye />}
            </button>
          </div>
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-lg full-w" type="submit" disabled={busy}>
          {busy ? 'لحظة من فضلك…' : mode === 'in' ? 'دخول' : 'إنشاء الحساب'}
        </button>
      </form>
    </>
  )
}

/** أول شاشة بيشوفها الزائر — المتجر بيتفتح بعد الدخول */
export function WelcomeAuthScreen() {
  const [mode, setMode] = useState<Mode>('in')
  return (
    <main className="gate">
      <section className="gate-art" aria-hidden="true">
        <div className="gate-art-in">
          <span className="gate-kicker">RTX SHOP</span>
          <p className="gate-quote">{PROMISE}</p>
          <p className="gate-sub">{PROMISE_SUB}</p>
        </div>
      </section>
      <section className="gate-panel">
        <div className="gate-card">
          <header className="gate-head">
            <div className="wordmark" aria-label={STORE_NAME}><span>RTX</span><i /><em>SHOP</em></div>
            <h1>{mode === 'in' ? 'أهلاً بعودتك' : 'إنشاء حساب جديد'}</h1>
            <p>{mode === 'in' ? 'سجّل دخولك لتصفّح المنتجات ومتابعة طلباتك.' : 'حساب واحد بالموبايل، وطلباتك كلها في مكان واحد.'}</p>
          </header>
          <AuthForm mode={mode} onMode={setMode} />
        </div>
      </section>
    </main>
  )
}

export function AuthModal({ mode, onMode, onClose }: { mode: Mode | null; onMode: (mode: Mode) => void; onClose: () => void }) {
  return (
    <Modal open={mode !== null} onClose={onClose} size="sm">
      <div className="auth-head">
        <span className="auth-icon">{mode === 'up' ? <UserPlus /> : <LogIn />}</span>
        <h2>{mode === 'up' ? `حسابك في ${STORE_NAME}` : `أهلاً بعودتك إلى ${STORE_NAME}`}</h2>
        <p>{mode === 'up' ? 'حساب سريع بالموبايل وتقدر تتابع كل طلباتك.' : 'سجّل دخولك لتكمل طلبك وتتابعه.'}</p>
      </div>
      {mode && <AuthForm mode={mode} onMode={onMode} compact />}
    </Modal>
  )
}
