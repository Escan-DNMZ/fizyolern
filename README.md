# FizyoLern – Günlük fizyoterapi çalışması (iPhone web-uygulaması)

iPhone'a "Ana Ekrana Ekle" ile kurulan, çevrimdışı çalışan bir uygulama (PWA). Mac veya App Store gerekmez.

## Özellikler
- **Bugün:** Notion'daki haftalık programa göre günün dersleri ve „Yarın: …“ satırı, sabah testi, ✗ hata kartları, günün kası/kemiği, seri (🔥), Claude'a durum raporu
- **Günün kelimeleri:** Grundwortschatz'tan 5 kelime – sabah ve dönüşte farklı soru tipiyle (DE→TR, TR→DE yazarak, Lückentext, Partizip II); „Biliyorum“ → seyrek tekrar (Leitner)
- **Dönüş yolu (14:30'dan sonra):** bugünün yanlışları → ✗ kartları → dönüş kelimeleri → bugünün ders notları (okuma modu) + 5 soruluk mini test; her adım atlanabilir
- **Cumartesi:** haftanın yanlışları, tüm ✗ kartları, haftanın kelimeleri, açık uçlu sorular
- **Test:** ders notlarından sorular (falsch / Zuordnung / Reihenfolge / Fallbeispiel / Zahlen dahil) + otomatik kas/kemik/eklem/egzersiz soruları; Anatomie ve Physiologie ağırlıklı, yanlışlar sık, dün doğru bilinenler bugün tekrar gelmez; 2× doğru → açık uçlu soruya geçiş
- **Kalça (PT-Befund):** folyo değerleri (Neutral-Null, ADL, kas grupları) + otomatik sorular; aynı yapı diz/omuz için de doldurulabilir (`rom`, `adl`, `muskelGruppen` alanları)
- **Kartlar:** aralıklı tekrar ile kelime, kas (💪 stüdyo egzersizi dahil), kemik ve eklem kartları; kendi kelimeni ekleyebilirsin
- **3D Anatomi:** BodyParts3D modelleri; kas odak modu (parçalar, Ursprung/Ansatz noktaları, derin kaslar), Yüzey/Orta/Derin katmanları

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

## Notion bağlantısı (kişisel program, hata listesi, Grundwortschatz)
Kişisel veriler GitHub'a hiç gitmez: uygulama bunları telefondan **doğrudan Notion'dan** okur.

1. Bilgisayarda https://www.notion.so/profile/integrations → **New integration**
   - Type: **Internal** · Name: `FizyoLern` · Workspace: kendi çalışma alanın
   - **Capabilities:** sadece **Read content** açık kalsın (Update/Insert content ve user information kapalı)
   - **Internal Integration Secret** (`ntn_…`) değerini kopyala — kimseyle paylaşma, sohbete yapıştırma.
2. Notion'da fizyoterapi **Dashboard** sayfanı aç → sağ üstte **•••** → **Connections** → `FizyoLern`'i ekle.
   (Sadece bu sayfa ve alt sayfaları paylaşılır: Haftalık Plan, Dersler, Grundwortschatz.)
3. iPhone'da uygulama → ⚙️ Ayarlar → **Notion bağlantısı** → anahtarı yapıştır → **Bağlan ve güncelle**.

Uygulama açıldığında en fazla 3 saatte bir kendini günceller; "Şimdi güncelle" ile elle de yapılabilir.

**Birden çok hafta:** "Haftalık Plan" sayfasındaki tüm `## … KW NN (DD.–DD.MM.YYYY …)` başlıkları ve tabloları okunur; uygulama **bugünün tarihini içeren** haftayı kendisi seçer (yoksa en yakın gelecek hafta). Bu yüzden Pazar günü haftayı en üste taşıyan otomatik "hafta değişimi" görevi artık gerekli değil — gelecek haftaları "📅 Gelecek haftalar" altına önceden eklemek yeterli.
Anahtar sadece o telefonun tarayıcı deposunda durur ve sadece `api.notion.com`'a gönderilir (sayfadaki Content-Security-Policy başka bir sunucuya bağlantıyı engeller).
Telefon kaybolursa veya şüphelenirsen: Notion → integrations → `FizyoLern` → **Refresh/Delete secret**; eski anahtar anında geçersiz olur.

Okunan yapı: "Haftalık Plan" sayfasındaki `KW …` başlığı + tablo (Gün · Ders 1 · Ders 2 · Tekrar ("Sabah testi: …") · Ödev/Not) ve
ders başlıkları (heading 3) altındaki `✗ … (tekrar et)` paragraflarını izleyen `✗` / `½` maddeleri (kalın yazılan kısımlar kartta boşluk olur).

## Notlar
- 3D kemik ve kas modelleri: BodyParts3D, © The Database Center for Life Science (DBCLS), CC BY 4.0 (`models/`, `tools/build_bp3d.py` + `tools/compress_models.sh` ile üretilir). BodyParts3D'de olmayan 4 kas (latissimus dorsi, rectus abdominis, transversus abdominis, quadratus lumborum) gerçek iskelet noktalarından çizilir (`js/anatomy3d.js` → `buildSheetMuscles`).
- İçerik ders kitaplarıyla (Prometheus, Schünke vb.) kontrol edilmelidir.
- Three.js (MIT lisansı) `vendor/` klasöründe yerel olarak bulunur.
