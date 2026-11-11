"use strict";
/**
 * Tavriko yasal metinleri (tek kaynak).
 * ------------------------------------
 * Bu dosya hem istemcide (kayıt, Google girişi, Ayarlar > Yasal) hem de
 * sunucuda (/legal herkese açık sayfaları) kullanılır.
 *
 * ÖNEMLİ: Metinlerden herhangi biri değiştiğinde LEGAL_VERSION güncellenmelidir.
 * Sürüm değişince oturum açmış kullanıcılardan yeni metinleri tekrar onaylamaları
 * istenir.
 *
 * LEGAL_OPERATOR alanlarındaki köşeli parantezli değerler gerçek veri sorumlusu
 * bilgileriyle (ad/unvan, adres, iletişim e-postası) doldurulmalıdır.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGAL_DOCUMENTS = exports.REQUIRED_LEGAL_DOCUMENTS = exports.LEGAL_OPERATOR = exports.LEGAL_VERSION = void 0;
exports.getLegalDocument = getLegalDocument;
exports.hasAcceptedCurrentLegal = hasAcceptedCurrentLegal;
exports.LEGAL_VERSION = '2026-11-11';
exports.LEGAL_OPERATOR = {
    appName: 'Tavriko',
    controllerName: '[VERİ SORUMLUSU AD SOYAD / ŞİRKET UNVANI]',
    address: '[AÇIK ADRES]',
    contactEmail: '[İLETİŞİM E-POSTASI]',
    websiteUrl: 'https://tavriko-app.vercel.app',
};
/** Kayıt ve girişte onaylanması zorunlu metinler. */
exports.REQUIRED_LEGAL_DOCUMENTS = ['terms', 'privacy', 'kvkk'];
const O = exports.LEGAL_OPERATOR;
exports.LEGAL_DOCUMENTS = [
    {
        id: 'terms',
        title: 'Kullanıcı Sözleşmesi ve Kullanım Koşulları',
        shortTitle: 'Kullanım Koşulları',
        summary: 'Tavriko hesabını ve oyunu kullanırken geçerli olan kurallar.',
        sections: [
            {
                heading: '1. Taraflar ve Kapsam',
                paragraphs: [
                    `Bu sözleşme, ${O.appName} bilgi yarışması uygulamasını ve web sitesini (“Hizmet”) sunan ${O.controllerName} (“${O.appName}”, “biz”) ile Hizmet'i kullanan kişi (“Kullanıcı”, “sen”) arasındadır.`,
                    'Hesap oluşturarak, Google ile giriş yaparak veya Hizmet’i kullanmaya devam ederek bu koşulları okuduğunu ve kabul ettiğini beyan edersin. Koşulları kabul etmiyorsan Hizmet’i kullanmamalısın.',
                ],
            },
            {
                heading: '2. Hesap Oluşturma',
                paragraphs: [
                    'Hesap açmak için en az 13 yaşında olmalısın. 18 yaşından küçüksen Hizmet’i veli veya yasal temsilcinin izniyle kullanmalısın.',
                    'Kayıtta verdiğin bilgilerin doğru ve güncel olmasından, şifrenin gizliliğinden ve hesabında yapılan tüm işlemlerden sen sorumlusun. Hesabının izinsiz kullanıldığını fark edersen bize hemen bildirmelisin.',
                    'Bir kişi yalnızca kendi adına hesap açabilir. Hesaplar devredilemez, satılamaz veya kiralanamaz.',
                ],
            },
            {
                heading: '3. Oyun İçi Para Birimleri ve Ödüller',
                paragraphs: [
                    'Altın, elmas, ünvan, kozmetik ve benzeri oyun içi öğeler yalnızca Hizmet içinde kullanılabilen, gerçek para değeri olmayan ve nakde çevrilemeyen sanal öğelerdir.',
                    'Sanal öğeler sana mülkiyet değil, sınırlı ve devredilemez bir kullanım hakkı verir. Hile, hata istismarı veya kural ihlaliyle elde edilen öğeler geri alınabilir.',
                    'Günlük görevler, davet ödülleri, sezon ve etkinlik ödülleri önceden duyurulmak kaydıyla değiştirilebilir veya sonlandırılabilir.',
                ],
            },
            {
                heading: '4. Kullanım Kuralları',
                paragraphs: [
                    'Hile yazılımı, bot, otomasyon, birden çok hesapla skor manipülasyonu ve Hizmet’in güvenliğini veya altyapısını zorlayan her türlü girişim yasaktır.',
                    'Kullanıcı adı, biyografi, profil fotoğrafı ve mesajlarda hakaret, nefret söylemi, taciz, müstehcenlik, başkasının kişisel verisi veya hukuka aykırı içerik paylaşılamaz. Ayrıntılar Topluluk Kuralları’nda yer alır.',
                    'Başka bir kişi veya kurum gibi davranmak, başkalarının hesaplarına erişmeye çalışmak yasaktır.',
                ],
            },
            {
                heading: '5. Kullanıcı İçerikleri',
                paragraphs: [
                    'Profil fotoğrafı, kullanıcı adı, biyografi gibi yüklediğin içeriklerin sorumluluğu sana aittir. Bu içerikleri Hizmet’in işletilmesi amacıyla (örneğin profilinin diğer oyunculara gösterilmesi) kullanmamız için bize ücretsiz ve münhasır olmayan bir izin vermiş olursun.',
                    'Kurallara aykırı içerikleri önceden bildirimde bulunmadan kaldırabiliriz.',
                ],
            },
            {
                heading: '6. Fikri Mülkiyet',
                paragraphs: [
                    `Sorular, tasarımlar, logolar, yazılım ve diğer tüm Hizmet bileşenleri ${O.appName}’ya veya lisans verenlerine aittir. Yazılı iznimiz olmadan kopyalanamaz, çoğaltılamaz, tersine mühendislik yapılamaz.`,
                ],
            },
            {
                heading: '7. Hesabın Askıya Alınması ve Kapatılması',
                paragraphs: [
                    'Bu koşulların ihlali halinde hesabını uyarabilir, geçici olarak kısıtlayabilir veya kalıcı olarak kapatabiliriz.',
                    'Hesabını dilediğin zaman Ayarlar > Hesap bölümünden silebilirsin. Silme işlemiyle birlikte sanal öğelerin de kalıcı olarak silinir; yasal saklama yükümlülükleri saklıdır.',
                ],
            },
            {
                heading: '8. Sorumluluğun Sınırlandırılması',
                paragraphs: [
                    'Hizmet “olduğu gibi” sunulur. Kesintisiz veya hatasız çalışacağını garanti etmeyiz. Bakım, güncelleme veya teknik arızalar nedeniyle Hizmet geçici olarak kullanılamayabilir.',
                    'Sorulardaki bilgilerin doğruluğu için özen gösteririz; ancak sorular eğlence amaçlıdır ve profesyonel bilgi yerine geçmez.',
                    'Kanunen izin verilen ölçüde, dolaylı zararlardan ve kâr kaybından sorumlu değiliz.',
                ],
            },
            {
                heading: '9. Değişiklikler',
                paragraphs: [
                    'Bu koşulları güncelleyebiliriz. Önemli değişikliklerde uygulama içinde bildirim yapılır ve yeni metni onaylaman istenir. Onaylamadığın takdirde hesabını kullanmaya devam edemeyebilirsin.',
                ],
            },
            {
                heading: '10. Uygulanacak Hukuk ve İletişim',
                paragraphs: [
                    'Bu sözleşme Türkiye Cumhuriyeti hukukuna tabidir. Tüketici işlemlerinde Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir.',
                    `Sorular ve talepler için: ${O.contactEmail}`,
                ],
            },
        ],
    },
    {
        id: 'privacy',
        title: 'Gizlilik Politikası',
        shortTitle: 'Gizlilik Politikası',
        summary: 'Hangi verileri topladığımız, neden kullandığımız ve kimlerle paylaştığımız.',
        sections: [
            {
                heading: '1. Topladığımız Veriler',
                paragraphs: [
                    'Hesap bilgileri: e-posta adresi, kullanıcı adı, ad soyad (isteğe bağlı), şifre (yalnızca şifrelenmiş/özetlenmiş hâliyle), ülke, telefon numarası, doğum tarihi, cinsiyet ve biyografi (isteğe bağlı alanlar), profil fotoğrafı veya avatar.',
                    'Google ile giriş: Google hesabındaki e-posta adresin, adın ve profil fotoğrafın. Google şifren bize hiçbir zaman iletilmez.',
                    'Oyun verileri: maç geçmişi, puanlar, seviye, sıralamalar, kategori başarıları, günlük görevler, envanter, altın/elmas bakiyesi, arkadaş listesi, davetler, engellenen kullanıcılar ve bildirimler.',
                    'Teknik veriler: IP adresi, cihaz ve tarayıcı bilgisi, çevrim içi durumu, oturum anahtarları, hata ve erişim kayıtları.',
                    'Satın alma kayıtları: satın alınan paket, tarih, kart üzerindeki ad ve kartın son 4 hanesi. Tam kart numarası ve CVV bilgisi sunucularımızda saklanmaz.',
                ],
            },
            {
                heading: '2. Verileri Kullanma Amaçlarımız',
                paragraphs: [
                    'Hesabını oluşturmak, kimliğini doğrulamak ve oturumunu güvenle sürdürmek.',
                    'Oyunu oynatmak: eşleştirme, canlı odalar, düellolar, skor ve sıralamaların hesaplanması, ödüllerin tanımlanması.',
                    'Sosyal özellikler: profilinin, ünvanının ve çevrim içi durumunun (ayarlarına göre) diğer oyunculara gösterilmesi, arkadaşlık ve davet işlemleri.',
                    'Güvenlik: hile, kötüye kullanım ve yetkisiz erişimin önlenmesi, hız sınırlaması, hata tespiti.',
                    'Destek talepleri ve yasal yükümlülüklerin yerine getirilmesi.',
                ],
            },
            {
                heading: '3. Verilerin Paylaşılması',
                paragraphs: [
                    'Verilerini satmayız ve reklam amacıyla üçüncü kişilere vermeyiz.',
                    'Hizmeti sunabilmek için altyapı sağlayıcılarıyla çalışırız: barındırma ve sunucu (Vercel), veritabanı ve kimlik doğrulama (Supabase), gerçek zamanlı bağlantılar (Cloudflare), önbellek (Upstash), hata izleme (Sentry) ve Google ile giriş için Google. Bu sağlayıcıların sunucuları yurt dışında bulunabilir.',
                    'Kanunen yetkili kamu kurum ve kuruluşlarının talebi halinde veriler mevzuata uygun şekilde paylaşılabilir.',
                    'Kullanıcı adın, avatarın, ünvanın, seviyen ve skorların oyunun doğası gereği diğer oyuncular tarafından görülebilir. Profil gizliliğini Ayarlar > Gizlilik bölümünden yönetebilirsin.',
                ],
            },
            {
                heading: '4. Saklama Süresi',
                paragraphs: [
                    'Hesap verilerin hesabın açık olduğu sürece saklanır. Hesabını sildiğinde kişisel verilerin silinir veya anonim hâle getirilir.',
                    'Güvenlik ve erişim kayıtları ile satın alma kayıtları, ilgili mevzuatın öngördüğü süreler boyunca saklanabilir.',
                ],
            },
            {
                heading: '5. Güvenlik',
                paragraphs: [
                    'Şifreler tek yönlü özetleme ile saklanır. Bağlantılar HTTPS ile şifrelenir. Giriş ve şifre sıfırlama işlemlerinde hız sınırı ve deneme sınırı uygulanır. Yönetici erişimleri ayrıca korunur.',
                    'Hiçbir sistem %100 güvenli değildir; olası bir veri ihlalinde mevzuata uygun şekilde seni ve yetkili kurumu bilgilendiririz.',
                ],
            },
            {
                heading: '6. Çocukların Gizliliği',
                paragraphs: [
                    '13 yaşından küçük kişilerin hesap açmasına izin verilmez. Böyle bir hesap tespit edersek sileriz.',
                ],
            },
            {
                heading: '7. Hakların',
                paragraphs: [
                    'Verilerine erişme, düzeltme, silme ve işlenmesine itiraz etme hakların vardır. Ayrıntılar KVKK Aydınlatma Metni’nde yer alır.',
                    `Taleplerin için: ${O.contactEmail}`,
                ],
            },
        ],
    },
    {
        id: 'kvkk',
        title: 'KVKK Kişisel Verilerin Korunması Aydınlatma Metni',
        shortTitle: 'KVKK Aydınlatma Metni',
        summary: '6698 sayılı Kanun kapsamında veri sorumlusu olarak seni bilgilendirme metnimiz.',
        sections: [
            {
                heading: '1. Veri Sorumlusu',
                paragraphs: [
                    `6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca kişisel verilerin, veri sorumlusu sıfatıyla ${O.controllerName} (Adres: ${O.address}, E-posta: ${O.contactEmail}) tarafından aşağıda açıklanan kapsamda işlenmektedir.`,
                ],
            },
            {
                heading: '2. İşlenen Kişisel Veri Kategorileri',
                paragraphs: [
                    'Kimlik (ad soyad, kullanıcı adı, doğum tarihi, cinsiyet), iletişim (e-posta, telefon), müşteri işlem (oyun geçmişi, envanter, bakiye, satın alma kayıtları), işlem güvenliği (IP adresi, oturum ve erişim kayıtları, şifre özeti), görsel (profil fotoğrafı) ve pazarlama dışı tercih verileri (ayarlar, gizlilik tercihleri).',
                ],
            },
            {
                heading: '3. İşleme Amaçları ve Hukuki Sebepler',
                paragraphs: [
                    'Üyelik sözleşmesinin kurulması ve ifası (KVKK m.5/2-c): hesap oluşturma, oyun hizmetinin sunulması, ödüllerin ve satın alımların tanımlanması.',
                    'Hukuki yükümlülüğün yerine getirilmesi (KVKK m.5/2-ç): 5651 sayılı Kanun kapsamındaki erişim kayıtları, yetkili mercilerin talepleri.',
                    'Meşru menfaat (KVKK m.5/2-f): bilgi güvenliğinin sağlanması, hile ve kötüye kullanımın önlenmesi, hizmetin geliştirilmesi.',
                    'Bir hakkın tesisi, kullanılması veya korunması (KVKK m.5/2-e): uyuşmazlık hâlinde delil olarak kullanılması.',
                ],
            },
            {
                heading: '4. Toplama Yöntemi',
                paragraphs: [
                    'Verilerin; kayıt formu, Google ile giriş, uygulama ve web sitesi kullanımı sırasında elektronik ortamda, otomatik veya kısmen otomatik yollarla toplanmaktadır.',
                ],
            },
            {
                heading: '5. Aktarım',
                paragraphs: [
                    'Kişisel verilerin; hizmetin sunulması için zorunlu olan barındırma, veritabanı, gerçek zamanlı iletişim, önbellek, hata izleme ve kimlik doğrulama hizmet sağlayıcılarına (Vercel, Supabase, Cloudflare, Upstash, Sentry, Google) ve kanunen yetkili kamu kurumlarına aktarılabilir.',
                    'Bu hizmet sağlayıcıların sunucularının yurt dışında bulunması nedeniyle yapılan aktarımlar KVKK m.9’da öngörülen şartlara (standart sözleşme ve diğer uygun güvenceler) uygun olarak gerçekleştirilir.',
                ],
            },
            {
                heading: '6. KVKK m.11 Kapsamındaki Hakların',
                paragraphs: [
                    'Kişisel verilerinin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme; işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme; yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme; eksik veya yanlış işlenmişse düzeltilmesini isteme; KVKK m.7 çerçevesinde silinmesini veya yok edilmesini isteme; bu işlemlerin aktarılan üçüncü kişilere bildirilmesini isteme; münhasıran otomatik sistemlerle analiz edilmesi suretiyle aleyhine bir sonucun ortaya çıkmasına itiraz etme ve kanuna aykırı işleme sebebiyle zarara uğraman hâlinde zararın giderilmesini talep etme haklarına sahipsin.',
                    `Başvurularını ${O.contactEmail} adresine, kayıtlı e-posta adresinden ve kimliğini doğrulayacak bilgilerle iletebilirsin. Başvurular en geç 30 gün içinde ücretsiz olarak sonuçlandırılır.`,
                ],
            },
        ],
    },
    {
        id: 'cookies',
        title: 'Çerez ve Yerel Depolama Politikası',
        shortTitle: 'Çerez Politikası',
        summary: 'Web sürümünde tarayıcıda sakladığımız bilgiler.',
        sections: [
            {
                heading: '1. Ne Saklıyoruz?',
                paragraphs: [
                    'Web sürümü; oturumunu açık tutmak için oturum anahtarını, ses/müzik/oyun ayarlarını, bildirim durumunu ve davet bağlantısı bilgisini tarayıcının yerel depolama alanında (localStorage) saklar.',
                    'Yönetici paneli, yalnızca yöneticiler için güvenli ve yalnızca sunucunun okuyabildiği (HttpOnly) bir oturum çerezi kullanır.',
                ],
            },
            {
                heading: '2. Reklam ve İzleme',
                paragraphs: [
                    'Reklam veya üçüncü taraf izleme çerezi kullanmıyoruz. Hata izleme aracı yalnızca teknik hata bilgisi toplar.',
                ],
            },
            {
                heading: '3. Kontrol',
                paragraphs: [
                    'Tarayıcı ayarlarından yerel depolamayı ve çerezleri silebilirsin. Bu durumda oturumun kapanır ve cihazdaki ayarların sıfırlanır.',
                ],
            },
        ],
    },
    {
        id: 'purchases',
        title: 'Satın Alma, Sanal Öğe ve İade Koşulları',
        shortTitle: 'Satın Alma ve İade',
        summary: 'Mağaza ve paket satın alımlarına ilişkin koşullar.',
        sections: [
            {
                heading: '1. Kapsam',
                paragraphs: [
                    'Mağazadan satın alınan altın, elmas, sezon kartı ve kozmetik paketleri dijital içeriktir ve hesabına anında tanımlanır.',
                ],
            },
            {
                heading: '2. Cayma Hakkı',
                paragraphs: [
                    'Mesafeli Sözleşmeler Yönetmeliği m.15/1-ğ uyarınca, elektronik ortamda anında ifa edilen ve tüketiciye anında teslim edilen gayri maddi mallara ilişkin sözleşmelerde cayma hakkı kullanılamaz. Satın alma işlemini onaylayarak içeriğin anında teslim edilmesini talep ettiğini ve bu nedenle cayma hakkını kaybedeceğini kabul edersin.',
                ],
            },
            {
                heading: '3. Hatalı İşlemler',
                paragraphs: [
                    `Paket hesabına tanımlanmadıysa veya mükerrer ücretlendirme olduysa ${O.contactEmail} adresine işlem tarihi ve kartın son 4 hanesiyle başvurabilirsin. Doğrulanan hatalı işlemler iade edilir veya içerik tanımlanır.`,
                ],
            },
            {
                heading: '4. Ödeme Güvenliği',
                paragraphs: [
                    'Tam kart numarası ve güvenlik kodu (CVV) sunucularımızda saklanmaz. Satın alma kaydında yalnızca paket, tarih, kart üzerindeki ad ve kartın son 4 hanesi tutulur.',
                ],
            },
        ],
    },
    {
        id: 'community',
        title: 'Topluluk Kuralları',
        shortTitle: 'Topluluk Kuralları',
        summary: 'Herkes için adil ve keyifli bir oyun ortamı.',
        sections: [
            {
                heading: 'Saygılı Ol',
                paragraphs: [
                    'Hakaret, küfür, nefret söylemi, ayrımcılık, tehdit ve taciz yasaktır. Kullanıcı adı, biyografi ve profil fotoğrafı da bu kurala dahildir.',
                ],
            },
            {
                heading: 'Adil Oyna',
                paragraphs: [
                    'Hile, bot, ikinci hesapla kendine puan kazandırma, maçları bilerek bırakma veya hata istismarı yasaktır.',
                ],
            },
            {
                heading: 'Gizliliğe Saygı Göster',
                paragraphs: [
                    'Başkalarının kişisel bilgilerini (telefon, adres, fotoğraf vb.) izinsiz paylaşma.',
                ],
            },
            {
                heading: 'Bildir ve Engelle',
                paragraphs: [
                    'Kuralları ihlal eden oyuncuları profil kartlarından engelleyebilirsin. İhlaller uyarı, geçici kısıtlama veya kalıcı hesap kapatma ile sonuçlanabilir.',
                ],
            },
        ],
    },
];
function getLegalDocument(id) {
    return exports.LEGAL_DOCUMENTS.find((d) => d.id === id);
}
/** Kullanıcının mevcut sürüm yasal metinleri onaylayıp onaylamadığını döndürür. */
function hasAcceptedCurrentLegal(settings) {
    const consent = settings?.legalConsent;
    return Boolean(consent && typeof consent === 'object' && consent.version === exports.LEGAL_VERSION);
}
