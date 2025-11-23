import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Alert, AlertDescription } from './ui/alert'
import { Progress } from './ui/progress'
import { Upload, CheckCircle2, XCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner@2.0.3'
import { apiCall } from '../utils/supabase/client'
import { createClient } from '../utils/supabase/client'

interface ImportResult {
  success: number
  failed: number
  errors: string[]
  warnings: string[]
}

export function DataImport({ user }: { user: any }) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [previewData, setPreviewData] = useState<{ headers: string[], rows: any[] } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile)
        setResult(null)
        
        // Önizleme için ilk 5 satırı göster - Türkçe karakter desteği için windows-1254 encoding
        const reader = new FileReader()
        reader.onload = (event) => {
          const arrayBuffer = event.target?.result as ArrayBuffer
          
          // Encoding tespiti - UTF-8, Windows-1254 (Türkçe), veya ISO-8859-9 dene
          let text = ''
          try {
            // Önce UTF-8 dene
            const utf8Decoder = new TextDecoder('utf-8')
            text = utf8Decoder.decode(arrayBuffer)
            
            // Eğer satırlar virgül veya noktalı virgül içermiyorsa, başka encoding dene
            const firstLine = text.split('\n')[0]
            if (!firstLine.includes(',') && !firstLine.includes(';')) {
              // Windows-1254 (Türkçe) dene
              const win1254Decoder = new TextDecoder('windows-1254')
              text = win1254Decoder.decode(arrayBuffer)
            }
          } catch (error) {
            // Fallback
            const decoder = new TextDecoder('utf-8')
            text = decoder.decode(arrayBuffer)
          }
          
          const lines = text.split('\n').filter(line => line.trim())
          
          // Delimiter tespiti
          const firstLine = lines[0] || ''
          const commaCount = (firstLine.match(/,/g) || []).length
          const semicolonCount = (firstLine.match(/;/g) || []).length
          const delimiter = semicolonCount > commaCount ? ';' : ','
          
          const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, '').replace(/^\uFEFF/, ''))
          const previewRows = lines.slice(1, 6).map(line => {
            const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''))
            const row: any = {}
            headers.forEach((header, index) => {
              row[header] = values[index] || ''
            })
            return row
          })
          
          setPreviewData({ headers, rows: previewRows })
        }
        // ArrayBuffer olarak oku (encoding kontrolü için)
        reader.readAsArrayBuffer(selectedFile)
      } else {
        toast.error('Lütfen CSV dosyası seçin')
      }
    }
  }

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length < 2) return []

    // BOM (Byte Order Mark) temizle
    const cleanText = text.replace(/^\uFEFF/, '')
    const cleanLines = cleanText.split('\n').filter(line => line.trim())

    // CSV delimiter tespiti - İLK SATIRDA virgül ve noktalı virgül sayısını karşılaştır
    const firstLine = cleanLines[0] || ''
    const commaCount = (firstLine.match(/,/g) || []).length
    const semicolonCount = (firstLine.match(/;/g) || []).length
    const delimiter = semicolonCount > commaCount ? ';' : ','
    
    console.log(` Delimiter tespiti: virgül=${commaCount}, noktalıVirgül=${semicolonCount} → "${delimiter}" seçildi`)
    
    // Header'ları normalize et
    const rawHeaders = cleanLines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''))
    const headers = rawHeaders.map(h => normalizeColumnName(h))
    
    console.log('📋 Raw headers:', rawHeaders)
    console.log('📋 Normalized headers:', headers)
    
    const data: any[] = []

    for (let i = 1; i < cleanLines.length; i++) {
      const line = cleanLines[i]
      const values: string[] = []
      let currentValue = ''
      let insideQuotes = false

      // Tırnak işaretlerini dikkate alarak parse et
      for (let j = 0; j < line.length; j++) {
        const char = line[j]
        
        if (char === '"') {
          insideQuotes = !insideQuotes
        } else if (char === delimiter && !insideQuotes) {
          values.push(currentValue.trim())
          currentValue = ''
        } else {
          currentValue += char
        }
      }
      values.push(currentValue.trim())

      const row: any = {}
      rawHeaders.forEach((rawHeader, index) => {
        const normalizedHeader = normalizeColumnName(rawHeader)
        row[normalizedHeader] = values[index] || ''
      })
      
      // İlk birkaç satırı logla (debug için)
      if (i <= 3) {
        console.log(`Satır ${i}:`, row)
      }
      
      data.push(row)
    }

    return data
  }

  // Sütun isimlerini normalize et - Türkçe karakter ve yazım farklılıklarını tolere et
  const normalizeColumnName = (name: string): string => {
    const normalized = name
      .trim()
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/İ/g, 'i')
      .replace(/Ğ/g, 'g')
      .replace(/Ü/g, 'u')
      .replace(/Ş/g, 's')
      .replace(/Ö/g, 'o')
      .replace(/Ç/g, 'c')
      .replace(/\s+/g, '_')
    
    // Bilinen sütun isimlerini standartlaştır
    if (normalized.includes('tarih') || normalized.includes('date')) return 'Tarih'
    if (normalized.includes('musteri') && (normalized.includes('ad') || normalized.includes('adi'))) return 'MusteriAdi'
    if (normalized.includes('telefon') || normalized.includes('tel')) return 'TelefonNo'
    if (normalized.includes('isin') || normalized.includes('job') || normalized.includes('work') || normalized.includes('adi')) return 'IsinAdi'
    if (normalized.includes('fiyat') || normalized.includes('price') || normalized.includes('tutar')) return 'Fiyati'
    if (normalized.includes('adres') || normalized.includes('address')) return 'Adres'
    
    return name.trim()
  }

  const normalizeDate = (dateStr: string): string => {
    // Excel tarihleri farklı formatlarda olabilir: "Pazartesi 06.06.2011", "01.11.2024", "1/11/2024", "2024-11-01"
    if (!dateStr) return new Date().toISOString().split('T')[0]

    // Temizleme: gün adlarını ve gereksiz boşlukları kaldır
    let cleanDate = dateStr.trim()
    
    // Türkçe gün adlarını kaldır
    const gunAdlari = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
    gunAdlari.forEach(gun => {
      cleanDate = cleanDate.replace(gun, '').trim()
    })

    // İngilizce gün adlarını kaldır
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    dayNames.forEach(day => {
      cleanDate = cleanDate.replace(day, '').trim()
    })

    // Nokta ile ayrılmış format: "06.06.2011" veya "6.6.2011"
    if (cleanDate.includes('.')) {
      const parts = cleanDate.split('.')
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0')
        const month = parts[1].padStart(2, '0')
        const year = parts[2].length === 2 ? '20' + parts[2] : parts[2]
        return `${year}-${month}-${day}`
      }
    }

    // Slash ile ayrılmış format: "6/6/2011" veya "6/6/11"
    if (cleanDate.includes('/')) {
      const parts = cleanDate.split('/')
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0')
        const month = parts[1].padStart(2, '0')
        const year = parts[2].length === 2 ? '20' + parts[2] : parts[2]
        return `${year}-${month}-${day}`
      }
    }

    // Tire ile ayrılmış format: "2011-06-06"
    if (cleanDate.includes('-')) {
      const parts = cleanDate.split('-')
      if (parts.length === 3 && parts[0].length === 4) {
        // Zaten ISO format
        return cleanDate
      }
    }

    return new Date().toISOString().split('T')[0]
  }

  const findOrCreateCustomer = async (name: string, phone: string, address: string, allCustomers: any[], createdCustomers: Map<string, string>) => {
    // Önce telefon numarasından müşteri ara
    if (phone) {
      const cleanPhone = phone.replace(/\s/g, '')
      const existing = allCustomers.find((c: any) => 
        c.contactInfo?.phone?.replace(/\s/g, '') === cleanPhone
      )
      if (existing) return existing.id
    }

    // İsimden ara
    if (name) {
      const existing = allCustomers.find((c: any) => 
        c.name.toLowerCase() === name.toLowerCase()
      )
      if (existing) return existing.id
    }

    // Yeni müşteri oluştur
    const newCustomer = {
      name: name || 'İsimsiz Müşteri',
      type: 'normal',
      contactInfo: {
        phone: phone || '',
        email: '',
        address: address || ''
      },
      notes: 'CSV import ile oluşturuldu'
    }

    const result = await apiCall('/customers', {
      method: 'POST',
      body: JSON.stringify(newCustomer)
    })

    const customerId = result.customer?.id || result.id
    createdCustomers.set(name, customerId)
    return customerId
  }

  const importData = async () => {
    if (!file) return

    setImporting(true)
    setProgress(0)
    const errors: string[] = []
    const warnings: string[] = []
    let successCount = 0
    let failedCount = 0

    try {
      // ========== SESSION KONTROLÜ - ÇOK ÖNEMLİ! ==========
      // Import başlamadan önce kullanıcının session'ı olduğundan emin ol
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session || !session.access_token) {
        toast.error('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.')
        setImporting(false)
        return
      }
      
      console.log('✅ Session verified for CSV import')
      
      // Dosyayı ArrayBuffer olarak oku ve encoding tespiti yap
      const arrayBuffer = await file.arrayBuffer()
      
      let text = ''
      try {
        // Önce UTF-8 dene
        const utf8Decoder = new TextDecoder('utf-8')
        text = utf8Decoder.decode(arrayBuffer)
        
        // Eğer satırlar virgül veya noktalı virgül içermiyorsa, başka encoding dene
        const firstLine = text.split('\n')[0]
        if (!firstLine.includes(',') && !firstLine.includes(';')) {
          // Windows-1254 (Türkçe) dene
          const win1254Decoder = new TextDecoder('windows-1254')
          text = win1254Decoder.decode(arrayBuffer)
        }
      } catch (error) {
        // Fallback
        const decoder = new TextDecoder('utf-8')
        text = decoder.decode(arrayBuffer)
      }
      
      const rows = parseCSV(text)

      if (rows.length === 0) {
        toast.error('CSV dosyası boş veya geçersiz')
        setImporting(false)
        return
      }

      // Tüm müşterileri başta bir kez çek (performans için)
      const data = await apiCall('/customers')
      const allCustomers = data.customers || []
      const createdCustomers = new Map<string, string>() // Cache için

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        setProgress(Math.round(((i + 1) / rows.length) * 100))

        try {
          // ========== HEADER İSİMLERİNİ KULLANARAK VERİ AL ==========
          // Tüm olası sütun isimlerini kontrol et (normalized)
          
          // Tarih
          const dateStr = (
            row['Tarih'] || 
            row['tarih'] || 
            row['Date'] || 
            ''
          ).trim()
          const date = dateStr && dateStr !== 'nan' && dateStr !== '01.01.2020' && dateStr !== '01.01.2000'
            ? normalizeDate(dateStr) 
            : new Date().toISOString().split('T')[0]
          
          // Müşteri Adı
          let customerName = (
            row['MusteriAdi'] || 
            row['Müşteri Adı'] || 
            row['MusteriAdi'] ||
            row['Musteri'] ||
            row['musteri_adi'] ||
            ''
          ).trim()
          if (!customerName || customerName.toLowerCase() === 'nan' || customerName.toLowerCase() === 'null') {
            customerName = 'İsimsiz Müşteri'
          }
          
          // Telefon No
          let phone = (
            row['TelefonNo'] || 
            row['Telefon No'] || 
            row['Telefon'] ||
            row['telefon_no'] ||
            ''
          ).trim()
          if (!phone || phone === '0' || phone.toLowerCase() === 'nan') {
            phone = '0000000000' // Default telefon
          }
          
          // İşin Adı
          const description = (
            row['IsinAdi'] || 
            row['İşin Adı'] ||
            row['Isin Adi'] ||
            row['isin_adi'] ||
            row['Job'] ||
            ''
          ).trim() || 'Temizlik İşi'
          
          // Fiyatı - sayıya dönüştürülebilen değer
          let totalAmount = 0
          let fiyatStr = (
            row['Fiyati'] || 
            row['Fiyatı'] || 
            row['Fiyat'] ||
            row['fiyat'] ||
            row['Price'] ||
            '0'
          ).toString().trim()
          
          // Adres
          let address = (
            row['Adres'] || 
            row['adres'] ||
            row['Address'] ||
            ''
          ).trim().replace(/\n/g, ' ').replace(/\r/g, ' ')

          // ========== AKILLI TESPİT: FİYAT VE ADRES YER DEĞİŞTİRMİŞ Mİ? ==========
          // Eğer Fiyati sütununda adres belirteçleri varsa (Sk, no:, d:, Cd, Mh vb), ikisini değiştir
          const adresBelirtecleri = ['Sk', 'sk', 'no:', 'No:', 'd:', 'D:', 'k:', 'K:', 'Cd', 'cd', 'Mh', 'mh', 'apt', 'Apt', 'sitesi', 'Sitesi']
          const fiyatdaAdresVar = adresBelirtecleri.some(belirtec => fiyatStr.includes(belirtec))
          
          if (fiyatdaAdresVar) {
            // Yer değiştir!
            const temp = fiyatStr
            fiyatStr = address
            address = temp
          }
          
          // Fiyat temizleme ve parse
          const cleanPrice = fiyatStr
            .replace('₺', '')
            .replace('TL', '')
            .replace(',', '.')
            .trim()
          
          totalAmount = parseFloat(cleanPrice) || 0
          
          // ========== DEBUG İÇİN İLK 5 SATIRI LOGLA ==========
          if (i < 5) {
            console.log(`Satır ${i + 2}:`, {
              tarih: dateStr,
              musteri: customerName,
              telefon: phone,
              is: description,
              fiyat: totalAmount,
              adres: address
            })
          }

          // ========== HİÇBİR SATIR ATLANMAZ - TÜM SATIRLAR İMPORT EDİLİR ==========

          // Müşteri bul veya oluştur
          const customerId = await findOrCreateCustomer(customerName, phone, address, allCustomers, createdCustomers)

          // İş emri oluştur
          const workOrder = {
            customerId,
            personnelIds: [],
            date,
            description,
            totalAmount,
            paidAmount: totalAmount, // Tüm ödemeler tahsil edildi
            status: 'completed',
            createdBy: user?.user_metadata?.id || user.id,
            createdByName: user?.user_metadata?.name || 'Admin'
          }

          await apiCall('/work-orders', {
            method: 'POST',
            body: JSON.stringify(workOrder)
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

      setResult({
        success: successCount,
        failed: failedCount,
        errors,
        warnings
      })

      if (successCount > 0) {
        toast.success(`${successCount} kayıt başarıyla yüklendi!`)
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} kayıt yüklenemedi`)
      }
    } catch (error) {
      toast.error('İmport sırasında hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'))
    } finally {
      setImporting(false)
      setProgress(0)
    }
  }

  const resetImport = () => {
    setFile(null)
    setResult(null)
    setProgress(0)
    setPreviewData(null)
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Veri İçe Aktarma</h1>
          <p className="text-muted-foreground">Excel verilerinizi CSV formatında yükleyin</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CSV Dosyası Yükleme</CardTitle>
          <CardDescription>
            Excel dosyanızı CSV formatında kaydedin ve buradan yükleyin. 
            Sistem otomatik olarak müşterileri tanıyacak veya yeni müşteri oluşturacaktır.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CSV Şablon Bilgisi */}
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription>
              <strong>CSV Formatı:</strong> Excel'den "Save As" → "CSV (Comma delimited)" seçin.
              <br />
              <strong>Beklenen Sütunlar:</strong> Tarih, Müşteri Adı, Telefon No, İşin Adı, Fiyatı, Adres
              <br />
              <strong>Not:</strong> Tüm ödemeler tahsil edilmiş olarak kaydedilecektir.
            </AlertDescription>
          </Alert>

          {/* Dosya Seçimi */}
          {!result && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="csv-file">CSV Dosyası Seçin</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={importing}
                  className="mt-2"
                />
              </div>

              {file && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Seçili dosya: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
                  </AlertDescription>
                </Alert>
              )}

              {/* CSV Önizleme */}
              {previewData && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <p className="text-sm font-medium mb-2">📋 Dosya Önizlemesi (İlk 5 Satır)</p>
                  <div className="text-xs space-y-2">
                    <div>
                      <strong>Tespit Edilen Sütunlar ({previewData.headers.length}):</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {previewData.headers.map((header, i) => (
                          <span key={i} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            {header || '(boş)'} 
                            {normalizeColumnName(header) !== header && (
                              <span className="text-gray-500 ml-1">→ {normalizeColumnName(header)}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <strong>🔍 Debug - Ham Veriler:</strong>
                      <div className="mt-1 bg-white p-2 rounded border text-xs font-mono">
                        {previewData.rows.slice(0, 2).map((row, idx) => (
                          <div key={idx} className="mb-2 pb-2 border-b">
                            <div className="text-green-700">Satır {idx + 2}:</div>
                            <div>PersonelAdi: "{row['PersonelAdi'] || '(boş)'}"</div>
                            <div>Telefon: "{row['Telefon'] || '(boş)'}"</div>
                            <div>TCKimlikNo: "{row['TCKimlikNo'] || '(boş)'}"</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <strong>Örnek Veri:</strong>
                      <div className="mt-1 overflow-x-auto">
                        <table className="w-full text-xs border">
                          <thead>
                            <tr className="bg-gray-100">
                              {previewData.headers.map((header, i) => (
                                <th key={i} className="border px-2 py-1 text-left">{header}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.rows.map((row, rowIndex) => (
                              <tr key={rowIndex} className="hover:bg-gray-50">
                                {previewData.headers.map((header, colIndex) => (
                                  <td key={colIndex} className="border px-2 py-1">
                                    {row[header] || '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {importing && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-muted-foreground text-center">
                    İşleniyor... %{progress}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={importData}
                  disabled={!file || importing}
                  className="flex-1"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {importing ? 'İçe Aktarılıyor...' : 'Verileri İçe Aktar'}
                </Button>
                {file && !importing && (
                  <Button variant="outline" onClick={resetImport}>
                    İptal
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Sonuç Raporu */}
          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm text-muted-foreground">Başarılı</p>
                        <p className="text-2xl font-bold text-green-600">{result.success}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <div>
                        <p className="text-sm text-muted-foreground">Başarısız</p>
                        <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {result.warnings.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Uyarılar ({result.warnings.length}):</strong>
                    <ul className="mt-2 space-y-1 text-sm">
                      {result.warnings.slice(0, 10).map((warning, i) => (
                        <li key={i}>• {warning}</li>
                      ))}
                      {result.warnings.length > 10 && (
                        <li>... ve {result.warnings.length - 10} uyarı daha</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Hatalar ({result.errors.length}):</strong>
                    <ul className="mt-2 space-y-1 text-sm">
                      {result.errors.slice(0, 10).map((error, i) => (
                        <li key={i}>• {error}</li>
                      ))}
                      {result.errors.length > 10 && (
                        <li>... ve {result.errors.length - 10} hata daha</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={resetImport} className="w-full">
                Yeni Dosya Yükle
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kullanım Talimatları */}
      <Card>
        <CardHeader>
          <CardTitle>Nasıl Kullanılır?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
              1
            </div>
            <div>
              <p className="font-medium">Excel Dosyanızı Açın</p>
              <p className="text-sm text-muted-foreground">
                Mevcut Excel dosyanızda iş emirleri sayfasını açın
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
              2
            </div>
            <div>
              <p className="font-medium">CSV Olarak Kaydedin</p>
              <p className="text-sm text-muted-foreground">
                File → Save As → CSV (Comma delimited) (*.csv) seçin
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
              3
            </div>
            <div>
              <p className="font-medium">Dosyayı Yükleyin</p>
              <p className="text-sm text-muted-foreground">
                Yukarıdaki alandan CSV dosyanızı seçin ve "Verileri İçe Aktar" butonuna tıklayın
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
              4
            </div>
            <div>
              <p className="font-medium">Sonuçları Kontrol Edin</p>
              <p className="text-sm text-muted-foreground">
                Sistem otomatik olarak müşterileri eşleştirecek, gerekirse yeni müşteri oluşturacak ve iş emirlerini kaydedecektir
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}