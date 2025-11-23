import { useState } from 'react'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Card, CardContent } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react'
import { toast } from 'sonner@2.0.3'
import { apiCall } from '../utils/supabase/client'
import { createClient } from '../utils/supabase/client'

interface CustomerImportProps {
  onImportComplete: () => void
  user: any
}

export function CustomerImport({ onImportComplete, user }: CustomerImportProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [report, setReport] = useState<{
    success: number
    failed: number
    errors: string[]
  } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Lütfen bir CSV dosyası seçin')
        return
      }
      setFile(selectedFile)
      setReport(null)
    }
  }

  const detectEncoding = (bytes: Uint8Array): string => {
    // BOM kontrolü
    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return 'UTF-8'
    }
    
    // Türkçe karakter tespiti için heuristic
    let turkishCharCount = 0
    for (let i = 0; i < Math.min(1000, bytes.length); i++) {
      const byte = bytes[i]
      // Windows-1254 Türkçe karakterleri: ğ, ü, ş, ı, ö, ç, Ğ, Ü, Ş, İ, Ö, Ç
      if ([0xF0, 0xFC, 0xFE, 0xFD, 0xF6, 0xE7, 0xD0, 0xDC, 0xDE, 0xDD, 0xD6, 0xC7].includes(byte)) {
        turkishCharCount++
      }
    }
    
    // Eğer Türkçe karakter varsa Windows-1254, yoksa UTF-8
    return turkishCharCount > 0 ? 'windows-1254' : 'UTF-8'
  }

  const parseCSV = (text: string): Array<Record<string, string>> => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    if (lines.length === 0) {
      return []
    }

    // İlk satır header
    const headerLine = lines[0]
    const headers = headerLine.split(/[,;]/).map(h => h.trim().replace(/^["]|["]$/g, ''))
    
    console.log('📋 CSV Headers detected:', headers)
    
    const rows: Array<Record<string, string>> = []
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const values = line.split(/[,;]/).map(v => v.trim().replace(/^["]|["]$/g, ''))
      
      const row: Record<string, string> = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      
      rows.push(row)
    }
    
    // İlk birkaç satırı debug için logla
    if (rows.length > 0) {
      console.log('📊 First row data:', rows[0])
    }
    
    return rows
  }

  const importData = async () => {
    if (!file) return

    setImporting(true)
    setProgress(0)
    const errors: string[] = []
    let successCount = 0
    let failedCount = 0

    try {
      // Session kontrolü
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session || !session.access_token) {
        toast.error('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.')
        setImporting(false)
        return
      }
      
      console.log('✅ Session verified for Customer CSV import')
      
      // Dosyayı ArrayBuffer olarak oku ve encoding tespiti yap
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      const detectedEncoding = detectEncoding(bytes)
      
      console.log(`🔍 Detected encoding: ${detectedEncoding}`)
      
      // Encoding'e göre decode et
      let csvText: string
      if (detectedEncoding === 'windows-1254') {
        const decoder = new TextDecoder('windows-1254')
        csvText = decoder.decode(bytes)
      } else {
        const decoder = new TextDecoder('utf-8')
        csvText = decoder.decode(bytes)
      }

      // CSV parse
      const rows = parseCSV(csvText)
      
      if (rows.length === 0) {
        toast.error('CSV dosyası boş veya geçersiz')
        setImporting(false)
        return
      }

      console.log(`📊 Total rows to import: ${rows.length}`)

      // Her satırı işle
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        setProgress(Math.round(((i + 1) / rows.length) * 100))

        try {
          // Müşteri Adı - tüm olası sütun isimleri (KÜÇÜK-BÜYÜK HARF DAHİL)
          let customerName = (
            row['Müşteri Adı'] ||
            row['Musteri Adı'] ||
            row['Musteri Adi'] ||
            row['MusteriAdi'] ||
            row['müşteri adı'] ||
            row['musteri adı'] ||
            row['musteri adi'] ||
            row['Müşteri'] ||
            row['musteri'] ||
            row['Ad'] ||
            row['ad'] ||
            row['İsim'] ||
            row['isim'] ||
            row['Name'] ||
            row['name'] ||
            ''
          ).trim()

          if (!customerName || customerName.toLowerCase() === 'nan' || customerName.toLowerCase() === 'null') {
            errors.push(`Satır ${i + 2}: Müşteri adı eksik`)
            failedCount++
            continue
          }

          // Telefon No
          let phone = (
            row['Telefon'] ||
            row['telefon'] ||
            row['Telefon Numarası'] ||
            row['telefon numarası'] ||
            row['telefon numarasi'] ||
            row['Telefon Numarasi'] ||
            row['TelefonNo'] ||
            row['Tel'] ||
            row['tel'] ||
            row['Phone'] ||
            row['phone'] ||
            ''
          ).trim()

          if (!phone || phone === '0' || phone.toLowerCase() === 'nan') {
            phone = '0000000000' // Default telefon
          }

          // Adres
          let address = (
            row['Adres'] ||
            row['adres'] ||
            row['Address'] ||
            row['address'] ||
            row['Lokasyon'] ||
            row['lokasyon'] ||
            ''
          ).trim()

          if (!address || address.toLowerCase() === 'nan' || address.toLowerCase() === 'null') {
            address = 'Adres belirtilmemiş'
          }

          // Debug için ilk 5 satırı logla
          if (i < 5) {
            console.log(`Satır ${i + 2}:`, {
              ad: customerName,
              telefon: phone,
              adres: address
            })
          }

          // Müşteri oluştur
          const customerData = {
            name: customerName,
            type: 'normal', // Default olarak normal müşteri
            contactInfo: {
              phone: phone,
              email: ''
            },
            address: address,
            notes: `CSV Import - ${new Date().toLocaleDateString('tr-TR')}`,
            balance: 0
          }

          await apiCall('/customers', {
            method: 'POST',
            body: JSON.stringify(customerData)
          })

          successCount++
        } catch (error) {
          errors.push(`Satır ${i + 2}: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`)
          failedCount++
        }

        // Her 10 kayıtta bir kısa bekleme (rate limiting için)
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      // Sonuç raporu
      setReport({
        success: successCount,
        failed: failedCount,
        errors: errors.slice(0, 20) // İlk 20 hatayı göster
      })

      if (successCount > 0) {
        toast.success(`${successCount} müşteri başarıyla eklendi!`)
        onImportComplete()
      }

      if (failedCount > 0) {
        toast.error(`${failedCount} kayıt eklenemedi`)
      }

    } catch (error) {
      console.error('Import error:', error)
      toast.error('Import sırasında hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'))
    } finally {
      setImporting(false)
    }
  }

  const resetDialog = () => {
    setFile(null)
    setReport(null)
    setProgress(0)
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="border-blue-300 text-blue-600 hover:bg-blue-50"
      >
        <Upload className="h-4 w-4 mr-2" />
        CSV İçe Aktar
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open)
        if (!open) resetDialog()
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Müşteri CSV İçe Aktarma</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Instructions */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="font-medium text-blue-900">CSV Formatı</p>
                    <p className="text-sm text-blue-700">
                      CSV dosyanızın ilk satırı şu sütunları içermelidir:
                    </p>
                    <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                      <li><strong>musteri adı</strong> veya <strong>Müşteri Adı</strong> (zorunlu)</li>
                      <li><strong>telefon</strong> veya <strong>Telefon Numarası</strong></li>
                      <li><strong>adres</strong> veya <strong>Adres</strong></li>
                    </ul>
                    <div className="pt-2 border-t border-blue-300 mt-3">
                      <a 
                        href="/musteri_ornek.csv" 
                        download="musteri_ornek.csv"
                        className="text-sm text-blue-700 hover:text-blue-900 underline font-medium"
                      >
                        📥 Örnek CSV Dosyasını İndir
                      </a>
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      💡 Sütun sırası önemli değil - header isimleri kullanılır
                    </p>
                    <p className="text-xs text-blue-600">
                      💡 Büyük-küçük harf fark etmez (musteri adı = Müşteri Adı)
                    </p>
                    <p className="text-xs text-blue-600">
                      💡 Tüm müşteriler otomatik olarak "Normal" tipi ile eklenir
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="customer-csv-file">CSV Dosyası Seçin</Label>
              <div className="flex gap-2">
                <input
                  id="customer-csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  disabled={importing}
                />
              </div>
              {file && (
                <p className="text-sm text-gray-600">
                  📄 Seçili: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>

            {/* Progress */}
            {importing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>İçe aktarılıyor...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Report */}
            {report && (
              <Card className={report.success > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {report.success > 0 ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      <h3 className="font-medium">Import Sonucu</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-600">Başarılı</div>
                        <div className="text-2xl font-bold text-green-600">{report.success}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Başarısız</div>
                        <div className="text-2xl font-bold text-red-600">{report.failed}</div>
                      </div>
                    </div>

                    {report.errors.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium text-red-900">Hatalar:</p>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {report.errors.map((error, index) => (
                            <div key={index} className="text-sm text-red-700 bg-red-100 p-2 rounded">
                              {error}
                            </div>
                          ))}
                        </div>
                        {report.failed > report.errors.length && (
                          <p className="text-xs text-red-600">
                            ... ve {report.failed - report.errors.length} hata daha
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={importing}
              >
                {report ? 'Kapat' : 'İptal'}
              </Button>
              {!report && (
                <Button
                  onClick={importData}
                  disabled={!file || importing}
                >
                  {importing ? 'İçe Aktarılıyor...' : 'İçe Aktar'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
