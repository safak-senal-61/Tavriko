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

## Sıradaki geliştirmeler

- **Destek talepleri ve itiraz:** Sorumlu atama, durum ve yanıt süresi; oyuncunun moderasyon itirazını aynı zaman çizelgesine bağlama.
- **Personel güvenliği:** Tek oturum açma ve MFA; limit tekrarlarını veya olağandışı toplu işlemleri işaretleyen inceleme kuyruğu.
- **Ürün analitiği:** Kayıt → ilk maç dönüşümü, D1/D7 geri dönüş kohortları ve kategori bazlı tamamlanma.
