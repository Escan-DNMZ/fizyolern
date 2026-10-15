# FizyoLern – Günlük fizyoterapi çalışması (iPhone web-uygulaması)

iPhone'a "Ana Ekrana Ekle" ile kurulan, çevrimdışı çalışan bir uygulama (PWA). Mac veya App Store gerekmez.

## Özellikler
- **Bugün:** günlük plan (günün kası, günün kemiği/eklemi, kart tekrarı, test, açık uçlu soru), seri (🔥), istatistik
- **Test:** çoktan seçmeli sorular (Almanca soru, Türkçe açıklama). Kas/kemik/eklem soruları anatomi verilerinden otomatik üretilir
- **Sorular:** açık uçlu sorular – Almanca yazarsın, anahtar kavramlar kontrol edilir, örnek cevap gösterilir
- **Kartlar:** aralıklı tekrar (spaced repetition) ile kelime, kas, kemik ve eklem kartları; kendi kelimeni ekleyebilirsin
- **3D Anatomi:** döndürülebilir şematik model; kemik/kas/eklem katmanları, arama, izole etme, kas opaklığı

## İçerik nerede?
| Dosya | İçerik |
|---|---|
| `js/data/anatomy.js` | Kemikler, kaslar (Ursprung, Ansatz, Innervation, Funktion), eklemler (Neutral-Null) + 3D koordinatları |
| `js/data/vocab.js` | Kelimeler (Almanca – Türkçe – örnek cümle) |
| `js/data/questions.js` | Çoktan seçmeli ve açık uçlu sorular |

Yeni içerik eklediğinde `sw.js` içindeki `VERSION` değerini artır (ör. `fizyolern-v3`), yoksa telefon eski sürümü göstermeye devam edebilir.

## Bilgisayarda çalıştırma
```bash
python -m http.server 8765
```
Sonra tarayıcıda: http://localhost:8765

## iPhone'a kurma
Uygulamanın **HTTPS** ile yayınlanması gerekir (çevrimdışı çalışma için). En kolay yol **GitHub Pages** (ücretsiz):
1. github.com'da yeni bir depo (repository) aç, bu klasördeki tüm dosyaları yükle.
2. Depo → Settings → Pages → "Deploy from a branch" → `main` / root → Save.
3. Birkaç dakika sonra çıkan adresi (`https://KULLANICIADI.github.io/DEPOADI/`) iPhone'da **Safari** ile aç.
4. **Paylaş** düğmesi → **Ana Ekrana Ekle**.

İlerleme sadece telefonda saklanır; Ayarlar → "Yedeği indir" ile yedek alabilirsin.

## Notlar
- 3D model şematiktir (kasların konumu ve başlangıç–bitiş noktaları için). Gerçekçi bir atlas değildir.
- İçerik ders kitaplarıyla (Prometheus, Schünke vb.) kontrol edilmelidir.
- Three.js (MIT lisansı) `vendor/` klasöründe yerel olarak bulunur.
