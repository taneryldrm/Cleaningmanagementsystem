import { useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card'
import { Label } from './ui/label'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from './ui/alert'

interface LoginProps {
  onLoginSuccess: () => void
  onNeedsSetup?: () => void
}

export function Login({ onLoginSuccess, onNeedsSetup }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Login error:', error)
        
        // If invalid credentials, might be that no users exist
        if (error.message.includes('Invalid login credentials')) {
          setError('Geçersiz giriş bilgileri. Henüz kullanıcı oluşturulmadıysa, ilk kurulum sayfasını kullanın.')
        } else {
          setError(error.message)
        }
        return
      }

      if (data.session) {
        onLoginSuccess()
      }
    } catch (err) {
      console.error('Login exception:', err)
      setError('Giriş yapılırken bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center">Uçanlar Temizlik</CardTitle>
          <CardDescription className="text-center">
            İş Planlama ve Yönetim Sistemi
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                placeholder="ornek@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </Button>
            {onNeedsSetup && (
              <Button 
                type="button" 
                variant="link" 
                className="w-full text-sm"
                onClick={onNeedsSetup}
              >
                İlk kullanıcı oluştur (İlk Kurulum)
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
