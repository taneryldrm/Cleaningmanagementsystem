import { useState } from 'react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Label } from './ui/label'
import { Upload, FileText, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner@2.0.3'
import { apiCall } from '../utils/supabase/client'

interface WorkOrderImportProps {
  onImportComplete: () => void
  customers: any[]
  personnel: any[]
}

interface ImportResult {
  success: number
  failed: number
  skipped: number
  errors: string[]
  warnings: string[]
}

type ImportStep = 'file-selection' | 'parsing' | 'matching' | 'uploading' | 'complete'

export function WorkOrderImport({ onImportComplete, customers, personnel }: WorkOrderImportProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [currentStep, setCurrentStep] = useState<ImportStep>('file-selection')
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [createdCustomers, setCreatedCustomers] = useState<string[]>([])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile)
      setResult(null)
      setCreatedCustomers([])
    } else {
      toast.error('Lütfen geçerli bir CSV dosyası seçin')
      setFile(null)
    }
  }

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim())
    const rows: any[] = []

    // Skip header (first line)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Split by comma but respect quotes
      const values: string[] = []
      let current = ''
      let inQuotes = false

      for (let j = 0; j < line.length; j++) {
        const char = line[j]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      values.push(current.trim())

      // Support at least 7 columns (phone is optional)
      if (values.length >= 7) {
        rows.push({
          date: values[0],
          customerName: values[1],
          description: values[2],
          personnelCount: values[3],
          address: values[4],
          price: values[5],
          personnelNames: values[6],
          customerPhone: values[7] || '' // Phone can be empty
        })
      }
    }

    return rows
  }

  const findCustomer = (name: string, phone: string) => {
    // First priority: match by phone number if provided
    if (phone && phone.trim()) {
      // Normalize phone: remove all non-digit characters
      const normalizePhone = (p: string) => p.replace(/\D/g, '')
      const csvPhone = normalizePhone(phone)
      
      // Smart phone matching: support both 7-digit and 10-digit numbers
      const phoneMatch = customers.find(c => {
        if (!c.contactInfo?.phone) return false
        
        const customerPhone = normalizePhone(c.contactInfo.phone)
        
        // If both are empty, skip
        if (!csvPhone || !customerPhone) return false
        
        // If CSV has 7 digits, match last 7 digits of customer phone
        if (csvPhone.length === 7) {
          return customerPhone.endsWith(csvPhone) || customerPhone === csvPhone
        }
        
        // If CSV has 10 digits, try exact match or last 10 digits
        if (csvPhone.length === 10) {
          return customerPhone === csvPhone || customerPhone.endsWith(csvPhone)
        }
        
        // For other lengths, try exact match or check if one ends with the other
        return customerPhone === csvPhone || 
               customerPhone.endsWith(csvPhone) || 
               csvPhone.endsWith(customerPhone)
      })
      
      if (phoneMatch) return phoneMatch
    }
    
    // Second priority: match by name if phone not found or not provided
    if (name && name.trim()) {
      const nameMatch = customers.find(c => 
        c.name && c.name.toLowerCase().trim() === name.toLowerCase().trim()
      )
      if (nameMatch) return nameMatch
    }
    
    return null
  }

  const findPersonnelByNames = (namesStr: string): string[] => {
    if (!namesStr || !namesStr.trim()) return []
    
    // Ignore invalid personnel names (x, numbers, etc.)
    const cleanName = namesStr.trim().toLowerCase()
    if (cleanName === 'x' || cleanName === '?' || /^\d+$/.test(cleanName) || cleanName.includes('haftalık') || cleanName.includes('toplam')) {
      return []
    }
    
    // Split by comma, semicolon, or "and"
    const names = namesStr.split(/[,;]|ve\s+/i).map(n => n.trim()).filter(Boolean)
    const foundIds: string[] = []

    names.forEach(name => {
      const person = personnel.find(p => 
        p.name && name && p.name.toLowerCase().trim() === name.toLowerCase().trim()
      )
      if (person) {
        foundIds.push(person.id)
      }
    })

    return foundIds
  }

  const parseDate = (dateStr: string): string => {
    // Try various date formats
    dateStr = dateStr.trim()

    // DD/MM/YYYY or DD.MM.YYYY
    const ddmmyyyy = dateStr.match(/^(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{4})$/)
    if (ddmmyyyy) {
      const day = ddmmyyyy[1].padStart(2, '0')
      const month = ddmmyyyy[2].padStart(2, '0')
      const year = ddmmyyyy[3]
      return `${year}-${month}-${day}`
    }

    // YYYY-MM-DD (ISO format)
    const iso = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (iso) {
      const year = iso[1]
      const month = iso[2].padStart(2, '0')
      const day = iso[3].padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // If can't parse, return as is
    return dateStr
  }

  const handleImport = async () => {
    if (!file) {
      toast.error('Lütfen bir dosya seçin')
      return
    }

    setImporting(true)
    setProgress(0)
    setCurrentStep('parsing')
    setProgressMessage('Dosya okunuyor...')
    
    const errors: string[] = []
    const warnings: string[] = []
    const newCustomers: string[] = []
    let successCount = 0
    let failedCount = 0
    let skippedCount = 0

    try {
      // Step 1: Read and parse CSV
      setProgress(10)
      const text = await file.text()
      
      setProgress(20)
      setProgressMessage('CSV ayrıştırılıyor...')
      const rows = parseCSV(text)

      if (rows.length === 0) {
        toast.error('CSV dosyası boş veya geçersiz format')
        setImporting(false)
        setProgress(0)
        setCurrentStep('file-selection')
        return
      }

      // Step 2: Create missing customers and match
      setProgress(30)
      setCurrentStep('matching')
      setProgressMessage('Müşteriler kontrol ediliyor...')
      
      // Keep track of customers we've already created in this session
      const customersMap = new Map(customers.map(c => [c.id, c]))
      const createdCustomersInSession = new Set<string>() // Track customers created in this import session
      
      // First pass: identify and create missing customers
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2
        
        setProgressMessage(`Müşteri kontrol ediliyor: ${i + 1}/${rows.length}`)
        
        // Clean phone number (remove "x" or invalid values)
        let cleanPhone = row.customerPhone?.trim() || ''
        if (cleanPhone === 'x' || cleanPhone === 'X' || cleanPhone === '?' || cleanPhone.length < 10) {
          cleanPhone = '' // Invalid phone
        }
        
        // Skip customer creation if name is invalid
        if (!row.customerName || row.customerName.trim().length < 2) {
          continue
        }
        
        let customer = findCustomer(row.customerName, cleanPhone)
        
        // Create a unique key for this customer (name + phone)
        const customerKey = `${row.customerName.toLowerCase().trim()}_${cleanPhone}`
        
        // If customer doesn't exist and we haven't already created them in this session, create them
        if (!customer && row.customerName && !createdCustomersInSession.has(customerKey)) {
          try {
            console.log(`Creating new customer: ${row.customerName} (${cleanPhone || 'no phone'})`)
            
            const newCustomer = {
              name: row.customerName.trim(),
              address: row.address && row.address !== 'bilinmiyor' ? row.address : '',
              contactInfo: {
                phone: cleanPhone,
                email: ''
              },
              status: 'normal',
              notes: 'CSV içe aktarma ile otomatik oluşturuldu'
            }
            
            const response = await apiCall('/customers', {
              method: 'POST',
              body: JSON.stringify(newCustomer)
            })
            
            // Add to our local map and customers array
            customersMap.set(response.customer.id, response.customer)
            customers.push(response.customer)
            newCustomers.push(row.customerName)
            createdCustomersInSession.add(customerKey)
            
            warnings.push(`Satır ${rowNum}: Yeni müşteri oluşturuldu - "${row.customerName}"`)
          } catch (error: any) {
            console.error(`Failed to create customer ${row.customerName}:`, error)
            errors.push(`Satır ${rowNum}: Müşteri oluşturulamadı - "${row.customerName}": ${error.message}`)
          }
        } else if (createdCustomersInSession.has(customerKey)) {
          // Customer was already created in this import session
          console.log(`Skipping duplicate customer creation: ${row.customerName}`)
        }
      }
      
      setProgress(40)
      setProgressMessage(`${rows.length} kayıt eşleştiriliyor...`)
      
      const workOrdersToCreate: any[] = []
      
      console.log(`📊 CSV'den toplam ${rows.length} kayıt okundu`)

      rows.forEach((row, index) => {
        const rowNum = index + 2
        
        // Update progress per row
        const rowProgress = 40 + Math.floor((index / rows.length) * 20) // 40-60%
        setProgress(rowProgress)

        try {
          const customer = findCustomer(row.customerName, row.customerPhone)
          if (!customer) {
            errors.push(`Satır ${rowNum}: Müşteri bulunamadı veya oluşturulamadı - "${row.customerName}" (${row.customerPhone})`)
            failedCount++
            return
          }

          const date = parseDate(row.date)
          if (!date || date.length < 10) {
            errors.push(`Satır ${rowNum}: Geçersiz tarih formatı - "${row.date}"`)
            failedCount++
            return
          }

          const totalAmount = parseFloat(row.price?.replace(',', '.') || '0')
          if (isNaN(totalAmount) || totalAmount < 0) {
            warnings.push(`Satır ${rowNum}: Geçersiz fiyat, 0 olarak ayarlandı - "${row.price}"`)
          }

          const personnelIds = findPersonnelByNames(row.personnelNames)
          if (row.personnelNames && row.personnelNames.trim() && personnelIds.length === 0) {
            warnings.push(`Satır ${rowNum}: Personel bulunamadı - "${row.personnelNames}"`)
          }

          workOrdersToCreate.push({
            customerId: customer.id,
            customerAddress: row.address || customer.address || '',
            personnelIds: personnelIds,
            date: date,
            description: row.description || '',
            totalAmount: totalAmount,
            paidAmount: totalAmount,
            autoApprove: true,
            source: 'csv_import'
          })

          successCount++
        } catch (error: any) {
          errors.push(`Satır ${rowNum}: ${error.message}`)
          failedCount++
        }
      })

      // Step 3: Upload to server
      if (workOrdersToCreate.length > 0) {
        setProgress(60)
        setCurrentStep('uploading')
        setProgressMessage(`${workOrdersToCreate.length} iş emri yükleniyor...`)
        
        try {
          console.log('📤 Sending bulk import request:', {
            count: workOrdersToCreate.length,
            sample: workOrdersToCreate[0]
          })
          console.log(`📊 İÇE AKTARMA ÖZETİ:`)
          console.log(`   • CSV'den okunan: ${rows.length}`)
          console.log(`   • Backend'e gönderilen: ${workOrdersToCreate.length}`)
          console.log(`   • Frontend'de atlandı: ${skippedCount}`)
          console.log(`   • Frontend'de hata: ${failedCount}`)
          
          toast.info('İş emirleri yükleniyor...', {
            duration: 5000
          })
          
          setProgress(70)
          const response = await apiCall('/work-orders/bulk', {
            method: 'POST',
            body: JSON.stringify({ workOrders: workOrdersToCreate })
          }, 5)
          
          setProgress(90)
          console.log('✅ Bulk import response:', response)
          
          skippedCount = response.skipped || 0
          
          setProgress(100)
          setCurrentStep('complete')
          setProgressMessage('Tamamlandı!')
          
          // Update created customers list
          setCreatedCustomers(newCustomers)
          
          if (newCustomers.length > 0) {
            toast.success(`✅ ${newCustomers.length} yeni müşteri oluşturuldu!`)
          }
          
          if (skippedCount > 0) {
            warnings.push(`${skippedCount} iş emri daha önce eklendiği için atlandı (aynı müşteri + tarih + tutar)`)
            toast.warning(`${response.count} iş emri eklendi, ${skippedCount} tekrar atlandı`)
          } else {
            toast.success(`${response.count} iş emri başarıyla içe aktarıldı!`)
          }
          
          onImportComplete()
        } catch (error: any) {
          console.error('❌ Bulk import error details:', {
            message: error.message,
            stack: error.stack,
            error: error
          })
          errors.push(`Toplu aktarım hatası: ${error.message}`)
          toast.error(`İçe aktarma hatası: ${error.message}`)
          
          setProgress(0)
          setCurrentStep('file-selection')
        }
      }

      setResult({
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
        errors,
        warnings
      })

    } catch (error: any) {
      console.error('Import error:', error)
      toast.error('İçe aktarma sırasında hata oluştu')
      setProgress(0)
      setCurrentStep('file-selection')
    } finally {
      setImporting(false)
    }
  }

  const resetImport = () => {
    setFile(null)
    setResult(null)
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) resetImport()
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          CSV İçe Aktar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>İş Emirleri CSV İçe Aktarma</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              CSV Format Bilgisi
            </h3>
            <p className="text-sm text-gray-700">
              CSV dosyanız aşağdaki sütunları içermelidir (başlık satırı olmalı):
            </p>
            <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
              <li><strong>Tarih</strong> (DD/MM/YYYY veya YYYY-MM-DD)</li>
              <li><strong>Müşteri Adı</strong></li>
              <li><strong>Açıklama</strong></li>
              <li><strong>Eleman Sayısı</strong></li>
              <li><strong>Adres</strong></li>
              <li><strong>Fiyat</strong></li>
              <li><strong>Personel İsimleri</strong> (virgül ile ayrılmış)</li>
              <li><strong>Müşteri Tel No</strong></li>
            </ul>
            <p className="text-xs text-gray-600 mt-2">
              💡 Müşteriler önce <strong>telefon numarasına göre</strong>, telefon yoksa <strong>isme göre</strong> eşleştirilir.
            </p>
            <p className="text-xs text-green-600 font-medium">
              ✨ Sistemde olmayan müşteriler <strong>otomatik olarak oluşturulur!</strong>
            </p>
            <p className="text-xs text-gray-600">
              💡 Geçmiş kayıtlar olduğu için tüm iş emirleri otomatik onaylanır ve tam ödendi olarak işaretlenir.
            </p>
          </div>

          {/* File Upload */}
          {!result && (
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV Dosyası Seçin</Label>
              <input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={importing}
              />
              {file && !importing && (
                <p className="text-sm text-green-600 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {file.name} seçildi
                </p>
              )}
            </div>
          )}

          {/* Progress Bar */}
          {importing && !result && (
            <div className="space-y-4">
              {/* Main Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{progressMessage}</span>
                  <span className="text-blue-600">{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Step Indicators */}
              <div className="grid grid-cols-4 gap-2">
                <div className={`flex flex-col items-center p-3 rounded-md border transition-all ${
                  currentStep === 'parsing' ? 'bg-blue-100 border-blue-300 text-blue-700' : 
                  progress > 25 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}>
                  {progress > 25 ? 
                    <CheckCircle className="h-6 w-6 mb-1" /> : 
                    currentStep === 'parsing' ? <Loader2 className="h-6 w-6 mb-1 animate-spin" /> :
                    <FileText className="h-6 w-6 mb-1" />
                  }
                  <span className="text-xs font-medium">Okuma</span>
                </div>
                
                <div className={`flex flex-col items-center p-3 rounded-md border transition-all ${
                  currentStep === 'matching' ? 'bg-blue-100 border-blue-300 text-blue-700' : 
                  progress > 60 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}>
                  {progress > 60 ? 
                    <CheckCircle className="h-6 w-6 mb-1" /> : 
                    currentStep === 'matching' ? <Loader2 className="h-6 w-6 mb-1 animate-spin" /> :
                    <AlertCircle className="h-6 w-6 mb-1" />
                  }
                  <span className="text-xs font-medium">Eşleştirme</span>
                </div>
                
                <div className={`flex flex-col items-center p-3 rounded-md border transition-all ${
                  currentStep === 'uploading' ? 'bg-blue-100 border-blue-300 text-blue-700' : 
                  progress > 90 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}>
                  {progress > 90 ? 
                    <CheckCircle className="h-6 w-6 mb-1" /> : 
                    currentStep === 'uploading' ? <Loader2 className="h-6 w-6 mb-1 animate-spin" /> :
                    <Upload className="h-6 w-6 mb-1" />
                  }
                  <span className="text-xs font-medium">Yükleme</span>
                </div>
                
                <div className={`flex flex-col items-center p-3 rounded-md border transition-all ${
                  currentStep === 'complete' ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}>
                  {currentStep === 'complete' ? 
                    <CheckCircle className="h-6 w-6 mb-1" /> : 
                    <CheckCircle className="h-6 w-6 mb-1" />
                  }
                  <span className="text-xs font-medium">Tamamlandı</span>
                </div>
              </div>

              {/* Loading Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-center">
                <p className="text-sm text-blue-700">
                  Lütfen bekleyin, işlem devam ediyor...
                </p>
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-5 w-5" />
                    <div>
                      <p className="text-2xl font-bold">{result.success}</p>
                      <p className="text-sm">Başarılı</p>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex items-center gap-2 text-blue-700">
                    <AlertCircle className="h-5 w-5" />
                    <div>
                      <p className="text-2xl font-bold">{result.skipped}</p>
                      <p className="text-sm">Atlandı</p>
                    </div>
                  </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-5 w-5" />
                    <div>
                      <p className="text-2xl font-bold">{result.failed}</p>
                      <p className="text-sm">Başarısız</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 space-y-2">
                  <h4 className="font-medium text-yellow-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Uyarılar ({result.warnings.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {result.warnings.map((warning, idx) => (
                      <p key={idx} className="text-sm text-yellow-700">• {warning}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 space-y-2">
                  <h4 className="font-medium text-red-800 flex items-center gap-2">
                    <X className="h-4 w-4" />
                    Hatalar ({result.errors.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {result.errors.map((error, idx) => (
                      <p key={idx} className="text-sm text-red-700">• {error}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {!result ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  İptal
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!file || importing}
                >
                  {importing ? 'İçe Aktarılıyor...' : 'İçe Aktar'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetImport}
                >
                  Kapat
                </Button>
                <Button onClick={() => {
                  setResult(null)
                  setFile(null)
                }}>
                  Yeni Dosya Yükle
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}