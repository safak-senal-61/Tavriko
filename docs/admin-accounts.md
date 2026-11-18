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

- **Veritabanı:** Önce hazırlık ortamında yedek alın, `npx prisma migrate deploy --schema=server/prisma/schema.prisma` ve `npx prisma generate --schema=server/prisma/schema.prisma` çalıştırın. Supabase dışındaki test veritabanında RLS migration’ları için Supabase rollerinin ve `auth.role()` işlevinin eşdeğerleri gerekir. Çalışma zamanında `prisma db push` kullanmayın.
- **Kısıtlama açılışı:** İlk dağıtımda iki tarafta da `ACCOUNT_RESTRICTIONS_ENABLED` kapalı kalabilir. Backend ve Cloudflare Worker aynı `INTERNAL_API_SECRET` ile konuşmalı; Worker `BACKEND_API_URL` üzerinden backend’e ulaşmalı. Önce hazırlıkta izinli ve kısıtlı hesapla iki tarafı doğrulayın, sonra flag’i iki tarafta açın. Worker açıkken doğrulama hizmeti erişilemiyorsa kayıtlı oyuncu için çevrimiçi erişim verilmez. Kapatma gerekiyorsa önce Worker flag’ini kapatın.
- **Veri saklama:** Denetim defteri hesap silinse de hedef kimliğini tutar; otomatik silme politikası yoktur. Yayına almadan önce saklama süresini ve denetim erişimini belirleyin. Gerekçeye parola, ödeme verisi veya gereksiz kişisel veri yazmayın.

## Telafi sınırları

Hesap ve telafi türü başına son 24 saatte **1.000 altın, 50 elmas veya 1 kozmetik** doğrudan verilebilir. Toplam **10.000 altın, 500 elmas veya 5 kozmetik** üst sınırdır; doğrudan eşiği aşan her talebi başka bir görevli onaylar. Talep 48 saatte dolar ve hesap başına en çok beş etkin talep bekleyebilir. Aynı işlem kimliği tekrar gönderilirse bakiye iki kez artmaz; onay ve bakiye/envanter değişikliği birlikte kaydedilir. Eşya telafisi yalnız katalogdaki bir saatlik kozmetikleri içerir; farklı süreli mevcut kopya değiştirilmez. Para iadesi, bakiye düşme, sandık ve anahtar yoktur.

## Destek ve moderasyon itirazı

Oyuncu Ayarlar → Hesap → Destek talepleri ve itirazlar altında başvuru açar, durumunu ve sonuç yanıtını takip eder. Kayıtlı hesap gerekir; üç etkin ve son 24 saatte beş yeni başvuru sınırı vardır. Oyuncu son 30 gündeki kendi uyarı veya kısıtlamasına yalnız bir kez itiraz edebilir. İç moderasyon gerekçesi, iç işlem notu ve personel e-postası oyuncuya gönderilmez.

- **Kuyruk:** Destek rolü genel talepleri, moderatör itirazları, sahip ikisini görür. Sahip uygun bir görevli atayabilir; personel kendi adına alır. Atama, durum ve iç gerekçe zaman çizelgesine kaydedilir. Görevli kendi moderasyon işlemine yönelik itirazı sonuçlandıramaz; ikinci bir moderatör veya sahip gerekir.
- **Yanıt:** Sonuçlandırma oyuncuya ayrı bir yanıt ve uygulama içi bildirim verir. İtiraz kararı kısıtlamayı otomatik kaldırmaz. Bu sürüm karşılıklı mesajlaşma veya dosya eki içermez. Oyuncu hesabı silinirse talepler ve yanıtlar silinir; talep kimliği ve işlem metaverisi iç denetim defterinde kalır.

## İki adımlı portal girişi ve risk kuyruğu

- **Kurulum sırası:** Migration’ı uygulayın. Her portal hesabı için ayrı, güvenli rastgele (en az 20 bayt) Base32 TOTP anahtarı üretin, şifreli kanaldan doğrulayıcı uygulamada zaman tabanlı hesap olarak tanımlayın. 6 hane, SHA-1, 30 saniye kullanın. Backend gizli ayarı `PORTAL_TOTP_SECRETS_JSON`, küçük harf e-posta → büyük harf Base32 anahtarı içeren JSON nesnesidir. Anahtarları Git’e, sohbetlere veya loglara koymayın. Hazırlık ortamında sahip dahil her hesabı test etmeden `PORTAL_TOTP_REQUIRED=true` açmayın. Zorunluluk açıkken anahtarı eksik veya geçersiz hesap giriş yapamaz.
- **Oturumlar:** Hesabın faktörü eklenir, kaldırılır veya değiştirilirse eski oturum geçersizdir. Aynı kod zaman adımında yeniden kabul edilmez; PostgreSQL her hesap için beş dakikalık dilimde sekiz kod denemesi sınırı uygular. Sahipte iki adımlı giriş etkinken HTTP Basic çalışmaz. Ayrı servis ve Telegram kimlikleri bu portal ayarıyla değiştirilmez; hesap çalışma alanı servis/Telegram kimliği kabul etmez. Kayıp cihazda yetkili operatör yeni anahtar üretip gizli ayarı değiştirir; otomatik kurtarma kodu yoktur.
- **Risk incelemesi:** Bir görevli farklı hesaplar dahil son bir saatte beş farklı telafi kaydı oluşturursa uyarı açılır. Onay bekleyen kayıtlar sayılır; aynı işlem kimliğiyle tekrarlar sayılmaz. Sahip/onaycı ilgili kayıtları inceleyebilir ve gerekçe ekleyerek uyarıyı kapatabilir; kişi kendi uyarısını kapatamaz. Bu uyarı işlem limitlerinin yerine geçmez ve otomatik engelleme yapmaz.

## Kayıt kohortları

Son 30 kayıt günü, Türkiye saatine göre gösterilir. D0 kayıt günüdür. İlk maç dönüşümü, D0–D6 içinde en az bir doğrulanmış çevrimiçi maçı tamamlayanların oranıdır. D1 ve D7 tam olarak ilgili takvim gününde bir maç tamamlayanların oranıdır. Henüz bitmemiş gözlem süreleri oranın paydasına girmez. Maç ölçümünün başladığı kısmi gün ve öncesi, misafirler ve eski doğrulanmamış maç kayıtları dahil edilmez; uygun veri yoksa sıfır yerine bilgi mesajı görünür.

## Sıradaki geliştirmeler

- **Destek önceliği ve yanıt süresi:** İlk yanıt hedefi, süresi aşan talepler ve oyuncudan bilgi isteme.
- **Operasyon güvenliği:** Yönetici oturumlarını cihaz bazında iptal etme, kurtarma kodları veya kurumsal SSO.
- **Ürün analitiği:** İlk maç öncesi terk adımları, oyun modu ve kayıt kanalı bazında kohortlar.
