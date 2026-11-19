# Yönetici paneli: kullanıcı hesapları

`/admin/kullanicilar`, PostgreSQL’deki hesap kayıtlarını tek bir dizinden arar. Misafir oturumları yalnız veritabanında kayıtları varsa görünür. Liste 20 kayıtla sayfalanır; ad, kullanıcı adı veya tam hesap kimliğiyle aranır. En yeni kayıt veya maç sayısına göre sıralanabilir.

- **Ölçümler:** Kayıt grafiği İstanbul saatinde bugün dahil yedi takvim gününü gösterir. HTTP grafiği mevcut dağıtık izleme deposundan ölçülen 24 saatlik dilimi kullanır, herkesi veya tekil ziyaretçi sayısını göstermez. Trafik deposu kapalıysa ekran bundan açıkça bahseder.
- **Hesap görünümü:** Ayrıntıda seviye, oyun bakiyeleri, kayıt tarihi, Premium Pass durumu, envanter sayısı, bildirim cihazı sayısı ve en son beş kayıtlı maç bulunur. Yeni uç noktalar e-posta, telefon, parola özeti, bildirim belirteci veya ham avatar adresi döndürmez.
- **Profil ve işlem geçmişi:** Görünür ad ve varsayılan avatar düzenlenebilir. Arada değişen hesap sürümü `409` ile reddedilir. Profil değişiklikleri (önce/sonra dahil), iç notlar, moderasyon ve telafi kararları PostgreSQL’de aktör, rol, hedef hesap, tarih ve gerekçeyle kalıcı olarak kaydedilir. Eski işlemler geriye dönük doldurulmaz.
- **Moderasyon:** Uyarı, 1 ila 720 saat çevrimiçi oyun kısıtlaması ve erken kaldırma desteklenir. Süre kendiliğinden dolar. Oyuncu yalnız işlem ve varsa bitiş tarihini uygulama içi bildirimde görür; iç notu ve gerekçeyi görmez. Bu özellik giriş veya tek kişilik oyunu kapatmaz. Bağlı oyuncuların erişimi mesaj geldikçe yeniden değerlendirilir; her durumda anında bağlantı kesme garantisi yoktur.
- **Oyuncu analitiği:** Son yedi İstanbul takvim gününde kayıtlı çevrimiçi maç bitiren tekil oyuncular günlük ve haftalık olarak sayılır. “Yeni kayıt ve ilk maç” aynı pencerede kaydolup ilk gözlenen maçını bitirenleri, “geri dönen” ise pencere öncesinde de kayıtlı maçı olanları gösterir. Misafirler, botlar, salt HTTP ziyaretleri ve solo oturumlar sayılmaz. Eski maçlar geriye dönük doldurulmaz; kapsam başlangıcı ekranda gösterilir. Yerel Socket.IO’da doğrulanmış oda katılımcıları yalnız erişim kontrolü açıkken izlenir.
- **Oturum ve yazma güvenliği:** Hesap API’leri portal oturumu, değişiklikler ayrıca aynı origin ve JSON ister. Servis anahtarı ve Telegram doğrulaması tek başına yeterli değildir. Arama terimleri, özel notlar ve işlem gövdeleri genel HTTP kayıtlarına alınmaz. Eski `/api/admin/prisma-sync` toplu aktarımı canlı veritabanı yapılandırmasında devre dışıdır; yerel durum canlı profil, bakiye veya envanterin üzerine yazmamalıdır.

## Roller ve kurulum

| Rol | İşlemler |
| --- | --- |
| `owner` | Mevcut panel erişimi ve tüm hesap işlemleri; kendi talebini değerlendiremez |
| `support` | Hesapları ve geçmişi okur, profil düzeltir, iç not ve telafi talebi ekler |
| `moderator` | Hesapları ve geçmişi okur, iç not ekler, uyarı ve süreli kısıtlama uygular veya kaldırır |
| `approver` | Hesapları ve geçmişi okur, başkasının bekleyen telafisini onaylar veya reddeder |

Backend’de `PORTAL_STAFF_JSON` gizli ortam değişkeni, `{"email":"…","role":"support","passwordHash":"<saltHex>:<hashHex>"}` nesnelerinin dizisidir. Her personel için ayrı e-posta ve parola kullanın. Güvenilir yerel bir ortamda `randomBytes(16)` ile tuz ve `scryptSync(password, salt, 64)` ile özet üretin; ikisini hex olarak `:` ile birleştirin. Düz parolayı yapılandırmaya, Git’e veya komut geçmişine koymayın. Personel oturumu 8 saattir; e-posta, rol veya özet değiştirilirse eski oturum erişimi kaybeder. Mevcut `PORTAL_ADMIN_EMAIL` ve `PORTAL_ADMIN_PASSWORD` sahibin girişi olarak kalır.

- **Veritabanı:** Önce yedek alın ve aşağıdaki geçiş sırasını izleyin. Çalışma zamanında `prisma db push` kullanmayın.
- **Kısıtlama açılışı:** İlk dağıtımda iki tarafta da `ACCOUNT_RESTRICTIONS_ENABLED` kapalı kalabilir. Backend ve Cloudflare Worker aynı `INTERNAL_API_SECRET` ile konuşmalı; Worker `BACKEND_API_URL` üzerinden backend’e ulaşmalı. Önce hazırlıkta izinli ve kısıtlı hesapla iki tarafı doğrulayın, sonra flag’i iki tarafta açın. Worker açıkken doğrulama hizmeti erişilemiyorsa kayıtlı oyuncu için çevrimiçi erişim verilmez. Kapatma gerekiyorsa önce Worker flag’ini kapatın.
- **Veri saklama:** Denetim defteri hesap silinse de hedef kimliğini tutar; otomatik silme politikası yoktur. Yayına almadan önce saklama süresini ve denetim erişimini belirleyin. Gerekçeye parola, ödeme verisi veya gereksiz kişisel veri yazmayın.

## Telafi sınırları

Hesap ve telafi türü başına son 24 saatte **1.000 altın, 50 elmas veya 1 kozmetik** doğrudan verilebilir. Toplam **10.000 altın, 500 elmas veya 5 kozmetik** üst sınırdır; doğrudan eşiği aşan her talebi başka bir görevli onaylar. Talep 48 saatte dolar ve hesap başına en çok beş etkin talep bekleyebilir. Aynı işlem kimliği tekrar gönderilirse bakiye iki kez artmaz; onay ve bakiye/envanter değişikliği birlikte kaydedilir. Eşya telafisi yalnız katalogdaki bir saatlik kozmetikleri içerir; farklı süreli mevcut kopya değiştirilmez. Para iadesi, bakiye düşme, sandık ve anahtar yoktur.

## Destek ve moderasyon itirazı

Oyuncu Ayarlar → Hesap → Destek talepleri ve itirazlar altında başvuru açar, durumunu ve sonuç yanıtını takip eder. Kayıtlı hesap gerekir; üç etkin ve son 24 saatte beş yeni başvuru sınırı vardır. Oyuncu son 30 gündeki kendi uyarı veya kısıtlamasına yalnız bir kez itiraz edebilir. İç moderasyon gerekçesi, iç işlem notu ve personel e-postası oyuncuya gönderilmez.

- **Kuyruk:** Destek rolü genel talepleri, moderatör itirazları, sahip ikisini görür. Sahip uygun bir görevli atayabilir; personel kendi adına alır. Atama, durum ve iç gerekçe zaman çizelgesine kaydedilir. Görevli kendi moderasyon işlemine yönelik itirazı sonuçlandıramaz; ikinci bir moderatör veya sahip gerekir.
- **Konuşma:** Oyuncu ve atanmış görevli aynı dosyada mesajlaşabilir. Görevli “Oyuncudan bilgi iste” seçtiğinde kayıt oyuncu yanıtı bekleyenlere taşınır; oyuncu yazınca ekibin aktif kuyruğuna döner. Görevlinin mesajı uygulama içi bildirim oluşturur. Dosya başına en çok 60 mesaj, oyuncu başına saatte en çok 10 mesaj vardır. Sonuçlanan konuşma salt okunurdur. Dosya eki yoktur.
- **İlk yanıt hedefi:** `SUPPORT_FIRST_REPLY_HOURS` ile 1–168 saat arası seçilir (varsayılan 24 takvim saati). Atama ve dahili not süreyi durdurmaz; oyuncunun gördüğü ilk görevli mesajı veya sonuç yanıtı durdurur. Aşan yanıtsız kayıtlar otomatik olarak portal sahibinin “Geciken · ekip sorumlusu” filtresinde öne çıkar. Bu bir panel kuyruğudur; harici bildirim veya otomatik görevli değişikliği yapmaz.
- **Sonuç:** İtiraz kararı kısıtlamayı otomatik kaldırmaz. Oyuncu hesabı silinirse talepler ve konuşma silinir; talep kimliği ve işlem metaverisi iç denetim defterinde kalır.

## İki adımlı portal girişi ve risk kuyruğu

- **Kurulum sırası:** Migration’ı uygulayın. Her portal hesabı için ayrı, güvenli rastgele (en az 20 bayt) Base32 TOTP anahtarı üretin, şifreli kanaldan doğrulayıcı uygulamada zaman tabanlı hesap olarak tanımlayın. 6 hane, SHA-1, 30 saniye kullanın. Backend gizli ayarı `PORTAL_TOTP_SECRETS_JSON`, küçük harf e-posta → büyük harf Base32 anahtarı içeren JSON nesnesidir. Anahtarları Git’e, sohbetlere veya loglara koymayın. Hazırlık ortamında sahip dahil her hesabı test etmeden `PORTAL_TOTP_REQUIRED=true` açmayın. Zorunluluk açıkken anahtarı eksik veya geçersiz hesap giriş yapamaz.
- **Oturumlar:** Hesabın faktörü eklenir, kaldırılır veya değiştirilirse eski oturum geçersizdir. Aynı kod zaman adımında yeniden kabul edilmez; PostgreSQL her hesap için beş dakikalık dilimde sekiz kod denemesi sınırı uygular. Sahipte iki adımlı giriş etkinken HTTP Basic çalışmaz. Ayrı servis ve Telegram kimlikleri bu portal ayarıyla değiştirilmez; hesap çalışma alanı servis/Telegram kimliği kabul etmez. Kayıp cihazda yetkili operatör yeni anahtar üretip gizli ayarı değiştirir; otomatik kurtarma kodu yoktur.
- **Risk incelemesi:** Bir görevli farklı hesaplar dahil son bir saatte beş farklı telafi kaydı oluşturursa uyarı açılır. Onay bekleyen kayıtlar sayılır; aynı işlem kimliğiyle tekrarlar sayılmaz. Sahip/onaycı ilgili kayıtları inceleyebilir ve gerekçe ekleyerek uyarıyı kapatabilir; kişi kendi uyarısını kapatamaz. Bu uyarı işlem limitlerinin yerine geçmez ve otomatik engelleme yapmaz.

## Personel oturumları ve geçiş anahtarları

Önce migration’ı uygulayın. Dağıtımla birlikte veritabanında kaydı olmayan eski portal çerezleri ve Bearer anahtarları çalışmaz; herkes tekrar giriş yapar. Personel kendi oturumlarını, portal sahibi ayrıca ekip oturumlarını listeler ve tek tek kapatır. Cihaz adı tarayıcı bildiriminden yaklaşık olarak üretilir; ham kullanıcı aracısı veya IP bu tablolara yazılmaz. Kapatılan çerez/Bearer sonraki istekte reddedilir, açık canlı log bağlantısı en geç yaklaşık 10 saniyelik denetimde kapanır. Basic/servis/Telegram kimlikleri ayrı kalır; personel paneli oturumu sayılmaz.

Geçiş anahtarını açmak için `PORTAL_WEBAUTHN_ORIGIN` ayarına panelin sabit tam HTTPS origin’ini girin (yol ve sonda `/` yok; yerel geliştirmede `http://localhost:PORT` kabul edilir). Kimlik alanı bu ana makine adıdır; rastgele Vercel önizleme adreslerini paylaşmaz. Aktif TOTP ile giriş yapan kişi beş dakika içinde anahtar ekleyebilir veya kaldırabilir. Tarayıcı kullanıcı doğrulamasını (cihaz PIN’i/biyometri) ister. Anahtar, şifre veya TOTP sırrı yerine yalnız cihazın imzasını doğrular; veritabanında açık anahtar tutulur. Anahtar silinince o anahtarla açılan oturumlar da iptal edilir. Normal şifre + doğrulayıcı girişi kurtarma seçeneği olarak kalır.

### Supabase geçişi

1. Hazırlık için ayrı bir veritabanı ve ayrı uygulama ortamı kullanın. Üretime benzeyen şemayı ve RLS/grant durumunu hazırlık veritabanına taşıyın; personel ve oyuncu testleri için sentetik hesaplar kullanın. Önizleme bağlantısını üretim `DATABASE_URL` veya `DIRECT_URL` değerlerine yönlendirmeyin.
2. `SELECT to_regclass('public._prisma_migrations');` ile geçmişi inceleyin. Tavriko’nun mevcut Supabase şeması daha önce Supabase üzerinden de değiştirilmiştir. Tablolar zaten varken bu geçmiş yoksa doğrudan `migrate deploy` çalıştırmayın. Hazırlıkta önce her temel migration’ın tablo, kolon, varsayılan, indeks, anahtar ve RLS/grant etkisini karşılaştırın. Yalnızca eksiksiz doğrulanmış migration’ları `prisma migrate resolve --applied <migration_adı> --schema=server/prisma/schema.prisma` ile kaydedin; eksik etkiler varsa farkı önce inceleyip ayrı ve kontrollü biçimde ele alın. Supabase migration listesi, Prisma geçmişinin yerine geçmez.
3. Hazırlıkta kalan migration’ları `npx prisma migrate deploy --schema=server/prisma/schema.prisma` ile uygulayın ve `npx prisma generate --schema=server/prisma/schema.prisma` çalıştırın. Temiz bir yerel PostgreSQL provasında Supabase rollerinin ve `auth.role()` işlevinin eşdeğerlerini oluşturun. Başarılı temiz kurulum, dolu Supabase şemasına geçişi tek başına doğrulamaz.
4. Sabit hazırlık HTTPS adresinde eski çerezin reddedilmesini, sahip ve personelin şifre + TOTP ile yeniden girişini, geçiş anahtarı kaydını ve tek oturum iptalini doğrulayın. Üretimden önce personeli bilgilendirin; aynı geçiş sırasına göre üretim yedeğini ve geri dönüş planını doğrulayın. Hata halinde önceki uygulama sürümüne dönüş ile yeni tabloların korunmasını hazırlıkta deneyin; tablolara otomatik `DROP` uygulamayın.

## Kayıt kohortları

Son 30 kayıt günü, Türkiye saatine göre gösterilir. D0 kayıt günüdür. İlk maç dönüşümü, D0–D6 içinde en az bir doğrulanmış çevrimiçi maçı tamamlayanların oranıdır. D1 ve D7 tam olarak ilgili takvim gününde bir maç tamamlayanların oranıdır. Henüz bitmemiş gözlem süreleri oranın paydasına girmez. Maç ölçümünün başladığı kısmi gün ve öncesi, misafirler ve eski doğrulanmamış maç kayıtları dahil edilmez; uygun veri yoksa sıfır yerine bilgi mesajı görünür.

## İlk Hızlı Düello hunisi

Backend ve Cloudflare Worker sürümleri hazırlandıktan sonra Worker’da `DUEL_FUNNEL_TRACKING_ENABLED=true`, backend’de `DUEL_FUNNEL_START_AT=YYYY-MM-DDTHH:MM:SSZ` ayarlayın. Paylaşılan `INTERNAL_API_SECRET` ile hazırlıkta eşleşme ve maç sonucu akışını doğrulamadan canlıda tarih ayarlamayın. Ölçüm, ilk 24 saatinde Ayarlar → Gizlilik’ten açıkça katılan yeni hesapları kapsar; dileyen oyuncu aynı yerde izni kaldırınca huni kayıtları silinir. Bu özellik PostHog’a veri göndermez. Huni, son 30 olgun kayıt gününde kayıt tarihinden itibaren tam yedi günlük pencere kullanır. Olay sırası ve eşleşme kimliği eşleşmelidir; Hızlı Düello dışındaki oyunlar, yerel Socket.IO, olgunlaşmamış hesaplar ve geriye dönük olaylar dahil değildir. Hızlı Düello bot eşleşmeleri dahil, bot hesapları ve misafirler hariçtir. Ekrandaki yüzdeler bir önceki adımdandır; sonuç tüm kayıtların oranı olarak yorumlanmamalıdır.

## Sıradaki geliştirmeler

- **Destek operasyonu:** Öncelik, kategoriler, hazır yanıtlar ve sonradan yeniden açma kuralları.
- **Operasyon güvenliği:** Rol değişiklikleri ve açıklamalı personel güvenliği denetim ekranı.
- **Ürün analitiği:** Rakip türü, bekleme süresi ve bağlantı kopmasıyla eşleşme kayıplarını ayırma.
