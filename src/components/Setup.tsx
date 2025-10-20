import { useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card'
import { Label } from './ui/label'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { Alert, AlertDescription } from './ui/alert'

interface SetupProps {
  onSetupComplete: () => void
}

export function Setup({ onSetupComplete }: SetupProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation
    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır')
      setLoading(false)
      return
    }

    try {
      await apiCall('/signup', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password,
          role: 'admin',
          permissions: {}
        }),
        skipAuth: true
      })

      setSuccess(true)
      setTimeout(() => {
        onSetupComplete()
      }, 2000)
    } catch (err) {
      console.error('Setup error:', err)
      const errorMessage = (err as Error).message || 'Kullanıcı oluşturulurken bir hata oluştu'
      
      // If user already exists, show helpful message
      if (errorMessage.includes('already been registered')) {
        setError('Bu e-posta adresi zaten kayıtlı. Lütfen giriş sayfasını kullanın.')
      } else {
        setError(errorMessage)
      }
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
            İlk Kurulum - Yönetici Hesabı Oluşturun
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Yönetici hesabı başarıyla oluşturuldu! Giriş sayfasına yönlendiriliyorsunuz...
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Ad Soyad</Label>
              <Input
                id="name"
                type="text"
                placeholder="Can Yılmaz"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={success}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@ucanlartemizlik.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={success}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                placeholder="En az 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={success}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Şifrenizi tekrar girin"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={success}
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium mb-1">Bilgi:</p>
              <p>Bu hesap, sisteme tam erişime sahip ilk yönetici hesabı olacaktır. Bu hesap ile diğer kullanıcıları oluşturabileceksiniz.</p>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <Button type="submit" className="w-full" disabled={loading || success}>
              {loading ? 'Oluşturuluyor...' : success ? 'Başarılı!' : 'Yönetici Hesabı Oluştur'}
            </Button>
            {error && error.includes('zaten kayıtlı') && (
              <Button 
                type="button" 
                variant="outline" 
                className="w-full"
                onClick={onSetupComplete}
              >
                Giriş Sayfasına Git
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
