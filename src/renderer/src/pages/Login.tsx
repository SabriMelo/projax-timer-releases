import { useState, useEffect } from 'react'
import { Eye, EyeOff, Minus, Maximize2, X, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { apiRequest } from '../lib/api'

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default function Login() {
  const setAuth = useStore(s => s.setAuth)
  const setProjects = useStore(s => s.setProjects)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [googleLoading, setGoogleLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError || !data.session) {
      setError('Email ou senha incorretos')
      setLoading(false)
      return
    }

    const token = data.session.access_token
    const name = data.user.user_metadata?.name || data.user.email || 'Usuário'

    // Verifica acesso ao Timer (bloqueia plano FREE)
    try {
      await apiRequest('/api/timer/login', { method: 'POST', token })
    } catch (e: any) {
      await supabase.auth.signOut()
      if (e.message?.includes('planos Studio') || e.message?.includes('plan_blocked') || e.message?.includes('planos pagos')) {
        setError('O Timer Projax está disponível apenas nos planos Studio, Business e Enterprise. Faça upgrade em projax.com.br.')
      } else {
        setError(e.message || 'Erro ao verificar acesso. Tente novamente.')
      }
      setLoading(false)
      return
    }

    try {
      const { projects } = await apiRequest('/api/timer/projetos', { token })
      setProjects(projects)
    } catch { /* projetos carregam depois */ }

    setAuth(token, name)
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError('')
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'projax-timer://auth/callback',
        skipBrowserRedirect: true,
      },
    })
    if (oauthError || !data.url) {
      setError('Erro ao iniciar login com Google')
      setGoogleLoading(false)
      return
    }
    window.electronAPI.openExternal(data.url)
    // googleLoading fica ativo até o callback chegar
  }

  useEffect(() => {
    const cleanup = window.electronAPI.onAuthCallback(async (callbackUrl: string) => {
      try {
        const url = new URL(callbackUrl)
        const code = url.searchParams.get('code')

        // implicit flow: token vem no hash em vez do query param
        const hash = Object.fromEntries(new URLSearchParams(url.hash.replace('#', '')))
        const accessToken = hash['access_token']
        const refreshToken = hash['refresh_token']

        let session: any = null
        if (code) {
          const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
          if (sessionError || !data.session) {
            setError('Falha ao obter sessão Google')
            setGoogleLoading(false)
            return
          }
          session = data.session
        } else if (accessToken && refreshToken) {
          const { data, error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          if (sessionError || !data.session) {
            setError('Falha ao obter sessão Google')
            setGoogleLoading(false)
            return
          }
          session = data.session
        } else {
          setError('Falha na autenticação com Google')
          setGoogleLoading(false)
          return
        }

        const token = session.access_token
        const name = session.user?.user_metadata?.name || session.user?.user_metadata?.full_name || session.user?.email || 'Usuário'

        // Verifica acesso ao Timer (bloqueia plano FREE)
        try {
          await apiRequest('/api/timer/login', { method: 'POST', token })
        } catch (e: any) {
          await supabase.auth.signOut()
          if (e.message?.includes('planos Studio') || e.message?.includes('plan_blocked') || e.message?.includes('planos pagos')) {
            setError('O Timer Projax está disponível apenas nos planos Studio, Business e Enterprise. Faça upgrade em projax.com.br.')
          } else {
            setError(e.message || 'Erro ao verificar acesso.')
          }
          setGoogleLoading(false)
          return
        }

        try {
          const { projects } = await apiRequest('/api/timer/projetos', { token })
          setProjects(projects)
        } catch { /* carrega depois */ }
        setAuth(token, name)
      } catch {
        setError('Erro inesperado no login com Google')
        setGoogleLoading(false)
      }
    })
    return cleanup
  }, [])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetLoading(true)
    setResetError('')
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: 'https://projax.com.br/atualizar-senha',
    })
    if (error) {
      setResetError('Não foi possível enviar o email. Tente novamente.')
    } else {
      setResetSent(true)
    }
    setResetLoading(false)
  }

  const inputCls = 'w-full h-10 border border-sand-md rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white transition'

  const Logo = (
    <div className="text-center mb-8">
      <svg viewBox="553 483 1250 1250" width="56" height="56" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4">
        <path d="M926.508 485.556C1091.66 485.556 1249.32 540.28 1366.29 649.119C1484.01 758.661 1556.01 918.889 1556.01 1120.35H1430.01C1430.01 1069.8 1424.71 1023.16 1414.89 980.372L1160.41 1120.27H1429.8V1246.27H931.209L926.625 1248.79V1730.46L800.625 1730.46V611.388H926.508V485.556ZM994.331 1067.78L1371.18 860.618C1346.88 814.173 1316.03 774.461 1280.46 741.362C1246.79 710.034 1208.27 684.057 1166.09 663.782L994.331 1067.78ZM926.625 904.992L1046.26 623.596C1007.88 615.639 967.797 611.564 926.625 611.557V904.992Z" fill="#c05a2e"/>
      </svg>
      <h1 className="text-2xl font-bold text-gray-900">Projax Timer</h1>
      <p className="text-sm text-gray-500 mt-1">Controle de horas por projeto</p>
    </div>
  )

  const TitleBar = (
    <div
      className="flex items-center justify-end gap-0.5 px-2 pt-2 shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="flex items-center gap-0.5">
        <button onClick={() => window.electronAPI.minimizeWindow()}
          className="p-1.5 rounded-lg hover:bg-sand-md text-gray-400 hover:text-gray-600 transition">
          <Minus size={12} />
        </button>
        <button onClick={() => window.electronAPI.maximizeWindow()}
          className="p-1.5 rounded-lg hover:bg-sand-md text-gray-400 hover:text-gray-600 transition">
          <Maximize2 size={12} />
        </button>
        <button onClick={() => window.electronAPI.closeWindow()}
          className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-500 transition">
          <X size={12} />
        </button>
      </div>
    </div>
  )

  if (forgotMode) {
    return (
      <div className="min-h-screen bg-sand flex flex-col rounded-2xl overflow-hidden shadow-2xl">
        {TitleBar}
        <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {Logo}
          <div className="bg-white rounded-2xl border border-sand-md shadow-sm p-6 space-y-4">
            {resetSent ? (
              <div className="text-center space-y-3 py-2">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-800">Email enviado!</p>
                <p className="text-xs text-gray-500">Verifique sua caixa de entrada e siga o link para redefinir sua senha.</p>
                <button
                  onClick={() => { setForgotMode(false); setResetSent(false); setResetEmail('') }}
                  className="text-xs text-brand font-medium hover:underline"
                >
                  Voltar ao login
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Recuperar senha</p>
                  <p className="text-xs text-gray-500">Digite seu email e enviaremos um link para redefinir sua senha.</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Email</label>
                  <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                    placeholder="seu@email.com" required className={inputCls} />
                </div>
                {resetError && (
                  <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{resetError}</p>
                )}
                <button type="submit" disabled={resetLoading}
                  className="w-full h-10 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-dk transition disabled:opacity-50">
                  {resetLoading ? 'Enviando...' : 'Enviar link de recuperação'}
                </button>
                <button type="button" onClick={() => setForgotMode(false)}
                  className="w-full text-xs text-gray-400 hover:text-gray-600 transition">
                  Voltar ao login
                </button>
              </form>
            )}
          </div>
        </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sand flex flex-col rounded-2xl overflow-hidden shadow-2xl">
      {TitleBar}
      <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {Logo}

        {/* Google */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          className="w-full h-10 flex items-center justify-center gap-2.5 border border-sand-md rounded-xl text-sm text-gray-700 font-medium bg-white hover:bg-sand transition disabled:opacity-50 mb-3"
        >
          {googleLoading ? <Loader2 size={15} className="animate-spin text-gray-400" /> : <GoogleIcon />}
          {googleLoading ? 'Aguardando Google...' : 'Entrar com Google'}
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-px bg-sand-md" />
          <span className="text-[10px] text-gray-400">ou</span>
          <div className="flex-1 h-px bg-sand-md" />
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl border border-sand-md shadow-sm p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com" required className={inputCls} />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Senha</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                required className={`${inputCls} pr-10`} />
              <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div onClick={() => setRememberMe(v => !v)}
                className={`w-4 h-4 rounded border flex items-center justify-center transition
                  ${rememberMe ? 'bg-brand border-brand' : 'border-gray-300 bg-white'}`}>
                {rememberMe && (
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <polyline points="1.5 4.5 3.5 6.5 7.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-gray-600">Continuar logado</span>
            </label>
            <button type="button" onClick={() => { setForgotMode(true); setResetEmail(email) }}
              className="text-xs text-brand hover:underline">
              Esqueceu a senha?
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full h-10 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-dk transition disabled:opacity-50">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
      </div>
    </div>
  )
}
