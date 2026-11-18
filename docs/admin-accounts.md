# Yönetici paneli: kullanıcı hesapları

`/admin/kullanicilar`, PostgreSQL’deki hesap kayıtlarını tek bir dizinden arar. Misafir oturumları yalnız veritabanında kayıtları varsa görünür. Liste 20 kayıtla sayfalanır; ad, kullanıcı adı veya tam hesap kimliğiyle aranır. En yeni kayıt veya maç sayısına göre sıralanabilir.

- **Ölçümler:** Kayıt grafiği İstanbul saatinde bugün dahil yedi takvim gününü gösterir. HTTP grafiği mevcut dağıtık izleme deposundan ölçülen 24 saatlik dilimi kullanır, herkesi veya tekil ziyaretçi sayısını göstermez. Trafik deposu kapalıysa ekran bundan açıkça bahseder.
- **Hesap görünümü:** Ayrıntıda seviye, oyun bakiyeleri, kayıt tarihi, Premium Pass durumu, envanter sayısı, bildirim cihazı sayısı ve en son beş kayıtlı maç bulunur. Yeni uç noktalar e-posta, telefon, parola özeti, bildirim belirteci veya ham avatar adresi döndürmez.
- **Profil düzeltmesi:** Görünür ad ve varsayılan avatar düzenlenebilir. Panel gerekçe ve kaydetmeden önce ikinci bir onay ister. Arada değişen hesap sürümü `409` ile reddedilir; profil dışı alanlara yazılmaz. İşlem kaydı mevcut Canlı Loglar altyapısına gider, kalıcı denetim defteri değildir.
- **Yönetici oturumu:** Yeni hesap API'leri portal yönetici oturumu gerektirir. Profil değişikliği aynı origin üzerinden JSON `PATCH` kabul eder; servis anahtarı ve Telegram doğrulaması tek başına yeterli değildir. Gereksiz kişisel verileri toplamamak için arama terimi ve profil düzenleme gövdesi genel HTTP kaydına yazılmaz.

## Sonraki geliştirmeler

1. Kalıcı denetim defteri ve ayrı destek/moderatör rolleri: işleme göre yetki, işlem gerekçesi, kim/ne zaman ve geri alma kaydı.
2. Süreli kısıtlama ve kaldırma: yalnız HTTP değil, Cloudflare oyun bağlantısı ve aktif oturumları da kapsayan ortak yaptırım modeli.
3. Destek zaman çizelgesi: envanter hareketleri, son maçlar ve bildirim teslimat durumu; kişisel veriler için saklama ve erişim sınırları.
4. Kullanım analitiği: anlamlı oyun etkinliklerinden aktif oyuncu, geri dönüş ve oyun akışı dönüşümleri; bunları HTTP istek sayısından ayrı tutun.
5. Oyun bakiyesi telafisi: kalıcı ve idempotent hareket defteri, limit, ikinci onay ve telafi işlemi olmadan eklemeyin.
