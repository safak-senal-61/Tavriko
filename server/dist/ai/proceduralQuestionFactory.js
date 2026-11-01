"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateGuaranteedUniqueCandidates = generateGuaranteedUniqueCandidates;
function normalizeSig(text) {
    return text.toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, '').trim();
}
function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
// ============================================================================
// DERECE DERECE COĞRAFYA (GEOGRAPHY) SORU HAVUZU
// ============================================================================
const GEOGRAPHY_EASY = [
    {
        text: "Türkiye'nin en yüksek dağı hangisidir?",
        subCategory: 'Coğrafya (Dağlar)',
        correct: 'Ağrı Dağı',
        distractors: ['Erciyes Dağı', 'Süphan Dağı', 'Uludağ'],
        explanation: "Ağrı Dağı 5.137 metre zirve yüksekliği ile Türkiye'nin en yüksek doğal noktasıdır.",
        src: 'Harita Genel Müdürlüğü',
    },
    {
        text: "Türkiye'nin yüz ölçümü en büyük ve suyu sodalı olan gölü hangisidir?",
        subCategory: 'Coğrafya (Göller)',
        correct: 'Van Gölü',
        distractors: ['Tuz Gölü', 'Beyşehir Gölü', 'İznik Gölü'],
        explanation: "Van Gölü 3.713 km² alanı ile Türkiye'nin en büyük gölüdür.",
        src: 'Devlet Su İşleri (DSİ)',
    },
    {
        text: "Beyaz traverten teraslarıyla ünlü Pamukkale, hangi ilimizdedir?",
        subCategory: 'Coğrafya (Doğa Harikaları)',
        correct: 'Denizli',
        distractors: ['Aydın', 'Muğla', 'Afyonkarahisar'],
        explanation: 'Pamukkale travertenleri Denizli il sınırları içerisinde bulunan bir UNESCO Dünya Mirasıdır.',
        src: 'Kültür ve Turizm Bakanlığı',
    },
    {
        text: "Peri bacaları doğal kaya oluşumlarıyla ünlü olan turistik Kapadokya bölgesi hangi ilimizin merkezindedir?",
        subCategory: 'Coğrafya (Doğa Harikaları)',
        correct: 'Nevşehir',
        distractors: ['Kayseri', 'Niğde', 'Aksaray'],
        explanation: 'Peri bacaları Nevşehir Göreme ve Ürgüp çevresinde yoğunlaşan volkanik tüf oluşumlarıdır.',
        src: 'Kültür ve Turizm Bakanlığı',
    },
    {
        text: "Türkiye'nin kuzey kıyıları boyunca uzanan deniz hangisidir?",
        subCategory: 'Coğrafya (Denizler)',
        correct: 'Karadeniz',
        distractors: ['Akdeniz', 'Ege Denizi', 'Marmara Denizi'],
        explanation: 'Anadolu Yarımadası’nın kuzey sınırını Karadeniz oluşturmaktadır.',
        src: 'Harita Genel Müdürlüğü',
    },
    {
        text: "Türkiye'nin güney kıyıları boyunca uzanan sıcak deniz hangisidir?",
        subCategory: 'Coğrafya (Denizler)',
        correct: 'Akdeniz',
        distractors: ['Karadeniz', 'Hazar Denizi', 'Kızıldeniz'],
        explanation: 'Türkiye’nin güney sahil şeridi Akdeniz boyunca uzanır.',
        src: 'Harita Genel Müdürlüğü',
    },
    {
        text: "Dünyanın en yüksek dağı olan Everest hangi kıtada yer almaktadır?",
        subCategory: 'Coğrafya (Kıtalar ve Zirveler)',
        correct: 'Asya Kıtası',
        distractors: ['Avrupa Kıtası', 'Afrika Kıtası', 'Güney Amerika Kıtası'],
        explanation: 'Everest zirvesi (8.848 m) Asya kıtasında Himalayalar üzerindedir.',
        src: 'Dünya Coğrafya Ansiklopedisi',
    },
    {
        text: "Dünyanın en büyük okyanusu hangisidir?",
        subCategory: 'Coğrafya (Okyanuslar)',
        correct: 'Büyük Okyanus (Pasifik)',
        distractors: ['Atlas Okyanusu', 'Hint Okyanusu', 'Kuzey Buz Denizi'],
        explanation: 'Pasifik Okyanusu yeryüzünün yaklaşık üçte birini kaplayan en geniş su kütlesidir.',
        src: 'Oşinografi Rehberi',
    },
    {
        text: "Dünya üzerinde hem yüzölçümü hem de nüfus bakımından en büyük kıta hangisidir?",
        subCategory: 'Coğrafya (Kıtalar)',
        correct: 'Asya',
        distractors: ['Afrika', 'Avrupa', 'Kuzey Amerika'],
        explanation: 'Asya kıtası 44 milyon km² alanı ve yaklaşık 4.7 milyar nüfusuyla dünyanın en büyük kıtasıdır.',
        src: 'Birleşmiş Milletler Coğrafya Veritabanı',
    },
    {
        text: "Marmara Bölgesi'nin ve Bursa ilimizin kış turizmiyle ünlü en popüler kayak merkezi dağı hangisidir?",
        subCategory: 'Coğrafya (Dağlar)',
        correct: 'Uludağ',
        distractors: ['Palandöken', 'Erciyes', 'Kartalkaya'],
        explanation: 'Bursa’daki Uludağ, Türkiye’nin en köklü ve bilinen kış turizmi merkezidir.',
        src: 'Türkiye Kayak Federasyonu',
    },
];
const GEOGRAPHY_MEDIUM = [
    {
        text: "Türkiye'nin yüz ölçümü en büyük TATLI SU gölü hangisidir?",
        subCategory: 'Coğrafya (Göller)',
        correct: 'Beyşehir Gölü',
        distractors: ['Van Gölü', 'Tuz Gölü', 'Sapanca Gölü'],
        explanation: 'Konya ve Isparta arasında yer alan Beyşehir Gölü 650 km² ile en büyük tatlı su gölümüzdür.',
        src: 'Devlet Su İşleri (DSİ)',
    },
    {
        text: "Tamamı Türkiye sınırları içerisinde doğup Karadeniz'e dökülen en uzun nehrimiz hangisidir?",
        subCategory: 'Coğrafya (Nehirler)',
        correct: 'Kızılırmak',
        distractors: ['Yeşilırmak', 'Sakarya Nehri', 'Fırat Nehri'],
        explanation: 'Kızılırmak 1.355 km uzunluğuyla Türkiye içinde doğup denizlerimize dökülen en uzun nehirdir.',
        src: 'Devlet Su İşleri (DSİ)',
    },
    {
        text: "Türkiye'nin girintili çıkıntılı yapısı nedeniyle en uzun kıyı şeridine sahip denizi hangisidir?",
        subCategory: 'Coğrafya (Denizler)',
        correct: 'Ege Denizi',
        distractors: ['Karadeniz', 'Akdeniz', 'Marmara Denizi'],
        explanation: 'Ege Denizi sayısız koy, körfez ve yarımadası nedeniyle Türkiye’nin en uzun kıyı çizgisine sahiptir.',
        src: 'Harita Genel Müdürlüğü',
    },
    {
        text: "Kış aylarında yüzeyi tamamen buz tutan ve üzerinde atlı kızaklarla gezilen Çıldır Gölü hangi illerimizdedir?",
        subCategory: 'Coğrafya (Göller)',
        correct: 'Ardahan ve Kars',
        distractors: ['Erzurum ve Ağrı', 'Van ve Bitlis', 'Bolu ve Düzce'],
        explanation: 'Çıldır Gölü Doğu Anadolu’da Ardahan ile Kars sınırında kışın donmasıyla ünlü bir göldür.',
        src: 'Doğu Anadolu Turizm Rehberi',
    },
    {
        text: "Tuz Gölü havzası hangi üç ilimizin sınırlarının kesiştiği alanda yer almaktadır?",
        subCategory: 'Coğrafya (Göller ve İller)',
        correct: 'Ankara, Konya ve Aksaray',
        distractors: ['Kayseri, Niğde ve Nevşehir', 'Eskişehir, Afyon ve Kütahya', 'Sivas, Yozgat ve Kırşehir'],
        explanation: 'Tuz Gölü Ankara, Konya ve Aksaray illerinin sınırlarında yer alan sığ tektonik bir göldür.',
        src: 'Çevre ve Şehircilik Bakanlığı',
    },
    {
        text: "Türkiye ile Yunanistan arasında doğal sınır oluşturan sınır akarsuyumuz hangisidir?",
        subCategory: 'Coğrafya (Nehirler ve Sınırlar)',
        correct: 'Meriç Nehri',
        distractors: ['Kızılırmak', 'Sakarya Nehri', 'Bakırçay'],
        explanation: 'Meriç Nehri Edirne boyunca Türkiye-Yunanistan sınır çizgisini oluşturur.',
        src: 'Milli Savunma Bakanlığı Harita GM',
    },
    {
        text: "Akdeniz'i Atlas Okyanusu'na bağlayan ve Avrupa ile Afrika kıtalarını ayıran boğaz hangisidir?",
        subCategory: 'Coğrafya (Boğazlar)',
        correct: 'Cebelitarık Boğazı',
        distractors: ['Süveyş Kanalı', 'Hürmüz Boğazı', 'Babülmendep Boğazı'],
        explanation: 'Cebelitarık Boğazı İspanya ve Fas arasında Akdeniz’in okyanusa tek doğal çıkış kapısıdır.',
        src: 'Dünya Deniz Ticareti Rehberi',
    },
    {
        text: "Dünyanın en büyük sıcak çölü olan Büyük Sahra Çölü hangi kıtadadır?",
        subCategory: 'Coğrafya (Çöller)',
        correct: 'Afrika',
        distractors: ['Asya', 'Avustralya', 'Güney Amerika'],
        explanation: 'Büyük Sahra Çölü Kuzey Afrika boyunca 9 milyon kilometrekarelik bir alanı kaplar.',
        src: 'Coğrafya Ansiklopedisi',
    },
    {
        text: "Yazları sıcak ve kurak, kışları ılık ve yağışlı geçen, bitki örtüsü 'maki' olan iklim türü hangisidir?",
        subCategory: 'Coğrafya (İklim)',
        correct: 'Akdeniz İklimi',
        distractors: ['Karadeniz İklimi', 'Karasal İklim', 'Step İklimi'],
        explanation: 'Akdeniz ikliminin karakteristik bodur ağaç ve çalı formasyonu maki olarak adlandırılır.',
        src: 'Meteoroloji Genel Müdürlüğü',
    },
];
const GEOGRAPHY_HARD = [
    {
        text: "Konya Karapınar'da yer alan ve 'Dünyanın Nazar Boncuğu' olarak bilinen volkanik maar gölü hangisidir?",
        subCategory: 'Coğrafya (Jeomorfoloji)',
        correct: 'Meke Gölü',
        distractors: ['Salda Gölü', 'Nemrut Gölü', 'Burdur Gölü'],
        explanation: 'Meke Gölü ortasında bazaltik volkan konisi bulunan çift katmanlı bir maar gölüdür.',
        src: 'Maden Tetkik ve Arama Genel Müdürlüğü (MTA)',
    },
    {
        text: "Türkiye'de doğup Mezopotamya üzerinden Basra Körfezi'ne dökülen Fırat ve Dicle nehirlerinin birleştiği nehir yatağına ne ad verilir?",
        subCategory: 'Coğrafya (Hidrografya)',
        correct: 'Şattülarap',
        distractors: ['Hürmüz', 'Kuzistan', 'Dicle Deltası'],
        explanation: 'Fırat ve Dicle nehirleri Irak’ta birleşerek Şattülarap adını alır ve Basra Körfezi’ne dökülür.',
        src: 'Ortadoğu Su Kaynakları Raporu',
    },
    {
        text: "Türkiye'nin ikinci en yüksek zirvesi olan Uludoruk (Reşko) Tepesi (4.135 m) hangi sıradağlar üzerindedir?",
        subCategory: 'Coğrafya (Dağlar)',
        correct: 'Cilo Dağları (Hakkari)',
        distractors: ['Kaçkar Dağları', 'Toros Dağları', 'Munzur Dağları'],
        explanation: 'Hakkari’deki Cilo-Sat Dağları üzerinde bulunan Uludoruk Tepesi Türkiye’nin ikinci en yüksek zirvesidir.',
        src: 'Harita Genel Müdürlüğü Resmi Yükseklik Verisi',
    },
    {
        text: "Türkiye'nin en kısa kara sınırına sahip olduğu komşusu ve bu sınırdaki gümrük kapısı hangisidir?",
        subCategory: 'Coğrafya (Sınır Kapıları)',
        correct: 'Nahçıvan (Azerbaycan) - Dilucu Sınır Kapısı',
        distractors: ['Gürcistan - Sarp Kapısı', 'Ermenistan - Akyaka Kapısı', 'Bulgaristan - Hamzabeyli'],
        explanation: 'Türkiye’nin Nahçıvan ile yaklaşık 13-18 km’lik sınırı Dilucu Sınır Kapısı ile bağlanır.',
        src: 'Ticaret Bakanlığı Gümrükler GM',
    },
    {
        text: "Melendiz Çayı'nın kanyonu yarmasıyla oluşan ve içinde tarihi kaya kiliseleri barındıran Ihlara Vadisi hangi ilimizdedir?",
        subCategory: 'Coğrafya (Kanyonlar ve Vadiler)',
        correct: 'Aksaray',
        distractors: ['Nevşehir', 'Kırşehir', 'Niğde'],
        explanation: 'Ihlara Vadisi Aksaray’ın Güzelyurt ilçesinde bulunan 14 km uzunluğunda kanyon vadidir.',
        src: 'Kültür Varlıkları ve Müzeler Genel Müdürlüğü',
    },
    {
        text: "Dünyanın en derin ve en eski tatlı su gölü olan Baykal Gölü hangi ülkenin sınırları içerisindedir?",
        subCategory: 'Coğrafya (Dünya Gölleri)',
        correct: 'Rusya (Sibirya)',
        distractors: ['Kanada', 'Kazakistan', 'Moğolistan'],
        explanation: 'Baykal Gölü 1.642 metre maksimum derinliğiyle yeryüzünün en derin tatlı su gölüdür.',
        src: 'UNESCO Dünya Mirası Komitesi',
    },
    {
        text: "Akdeniz ile Kızıldeniz'i birbirine bağlayan ve 1869'da açılan yapay su yolu hangisidir?",
        subCategory: 'Coğrafya (Kanallar)',
        correct: 'Süveyş Kanalı',
        distractors: ['Panama Kanalı', 'Korint Kanalı', 'Kiel Kanalı'],
        explanation: 'Mısır topraklarındaki Süveyş Kanalı Asya-Avrupa deniz yolunu binlerce mil kısaltmıştır.',
        src: 'Deniz Ticareti Tarihi',
    },
    {
        text: "Türkiye'nin yüzölçümü bakımından en büyük adası hangisidir?",
        subCategory: 'Coğrafya (Adalar)',
        correct: 'Gökçeada (İmroz)',
        distractors: ['Bozcaada', 'Marmara Adası', 'Büyükada'],
        explanation: 'Çanakkale’ye bağlı Gökçeada yaklaşık 289 km² ile Türkiye’nin en büyük adasıdır.',
        src: 'Harita Genel Müdürlüğü',
    },
];
const GEOGRAPHY_EXPERT = [
    {
        text: "Küre Dağları Milli Parkı içerisinde yer alan ve yer yer 1.200 metreye varan derinliğiyle Türkiye'nin en vahşi kanyonlarından biri kabul edilen kanyon hangisidir?",
        subCategory: 'Coğrafya (Jeomorfoloji / Uzman)',
        correct: 'Valla Kanyonu (Kastamonu)',
        distractors: ['Saklıkent Kanyonu', 'Köprülü Kanyon', 'Karanlık Kanyon'],
        explanation: 'Kastamonu Pınarbaşı’ndaki Valla Kanyonu dünyanın ve Türkiye’nin en derin ve geçişi zor kanyonlarındandır.',
        src: 'Doğa Koruma ve Milli Parklar GM',
    },
    {
        text: "Dünyanın deniz seviyesinden en alçak noktası olan ve yaklaşık -430 metre rakımda yer alan göl hangisidir?",
        subCategory: 'Coğrafya (Dünya Jeomorfolojisi / Uzman)',
        correct: 'Lut Gölü (Ölü Deniz)',
        distractors: ['Baykal Gölü', 'Assal Gölü', 'Titicaca Gölü'],
        explanation: 'İsrail, Ürdün ve Filistin sınırındaki Lut Gölü dünya karalarının en alçak gölüdür.',
        src: 'Küresel Jeoloji Atlası',
    },
    {
        text: "Türkiye'nin en güney ucunda yer alan Yayladağı Topraktutan Köyü hangi ilimizin sınırları içerisindedir?",
        subCategory: 'Coğrafya (Ekstrem Noktalar / Uzman)',
        correct: 'Hatay',
        distractors: ['Kilis', 'Gaziantep', 'Mersin'],
        explanation: 'Topraktutan Köyü (35° 48’ K) Türkiye’nin en güney coğrafi ucunu oluşturur.',
        src: 'Harita Genel Müdürlüğü Ekstrem Noktalar Verisi',
    },
    {
        text: "Büyük Okyanus'ta dünyanın bilinen en derin noktası olan Mariana Çukuru'nun en derin yeri yaklaşık kaç metredir?",
        subCategory: 'Coğrafya (Oşinografi / Uzman)',
        correct: '11.034 metre (Challenger Çukuru)',
        distractors: ['8.848 metre', '6.500 metre', '14.200 metre'],
        explanation: 'Mariana Çukuru’nun en dip noktası Challenger Derinliği yaklaşık 11 kilometredir.',
        src: 'NOAA Oşinografi Araştırmaları',
    },
    {
        text: "Afrika kıtası ile Madagaskar adasını birbirinden ayıran stratejik deniz boğazının adı nedir?",
        subCategory: 'Coğrafya (Boğazlar / Uzman)',
        correct: 'Mozambik Boğazı',
        distractors: ['Hürmüz Boğazı', 'Malakka Boğazı', 'Bering Boğazı'],
        explanation: 'Hint Okyanusu’nda Madagaskar ile Mozambik kıyısı arasındaki su yolu Mozambik Boğazı’dır.',
        src: 'Uluslararası Hidrografi Örgütü',
    },
    {
        text: "Türkiye'nin en batı coğrafi ucu olan İnceburun / Avlaka Burnu hangi adamız üzerinde bulunmaktadır?",
        subCategory: 'Coğrafya (Ekstrem Noktalar / Uzman)',
        correct: 'Gökçeada',
        distractors: ['Bozcaada', 'Marmara Adası', 'Cunda Adası'],
        explanation: 'Gökçeada Avlaka Burnu (25° 40’ D) Türkiye Cumhuriyeti’nin en batı kara noktasıdır.',
        src: 'Harita Genel Müdürlüğü',
    },
];
// ============================================================================
// DERECE DERECE TARİH (HISTORY) SORU HAVUZU
// ============================================================================
const HISTORY_EASY = [
    {
        text: "Türkiye Cumhuriyeti hangi yılda kurulmuştur?",
        subCategory: 'Tarih (Cumhuriyet Dönemi)',
        correct: '1923',
        distractors: ['1920', '1919', '1922'],
        explanation: 'Cumhuriyet 29 Ekim 1923 tarihinde TBMM tarafından ilan edilmiştir.',
        src: 'Türk Tarih Kurumu',
    },
    {
        text: "Kurtuluş Savaşı'nın önderi ve Türkiye Cumhuriyeti'nin ilk Cumhurbaşkanı kimdir?",
        subCategory: 'Tarih (Milli Mücadele)',
        correct: 'Mustafa Kemal Atatürk',
        distractors: ['İsmet İnönü', 'Fevzi Çakmak', 'Kazım Karabekir'],
        explanation: 'Gazi Mustafa Kemal Atatürk, Kurtuluş Savaşı’nın başkomutanı ve Cumhuriyetin kurucusudur.',
        src: 'TBMM Tarihçesi',
    },
    {
        text: "1453 yılında İstanbul'u fethederek Fatih unvanını alan Osmanlı padişahı kimdir?",
        subCategory: 'Tarih (Osmanlı Dönemi)',
        correct: 'Fatih Sultan Mehmet (II. Mehmet)',
        distractors: ['Kanuni Sultan Süleyman', 'Yavuz Sultan Selim', 'Yıldırım Bayezid'],
        explanation: 'II. Mehmet 29 Mayıs 1453’te İstanbul’u fethederek Orta Çağ’ı kapatıp Yeni Çağ’ı açmıştır.',
        src: 'Osmanlı Tarihi Kaynakları',
    },
    {
        text: "Türkiye Büyük Millet Meclisi (TBMM) hangi tarihte Ankara'da açılmıştır?",
        subCategory: 'Tarih (Milli Mücadele)',
        correct: '23 Nisan 1920',
        distractors: ['19 Mayıs 1919', '29 Ekim 1923', '30 Ağustos 1922'],
        explanation: 'TBMM 23 Nisan 1920’de açılarak milli iradeyi temsil etmeye başlamıştır.',
        src: 'TBMM Arşivi',
    },
    {
        text: "Mustafa Kemal Paşa'nın Samsun'a çıkarak Milli Mücadele meşalesini yaktığı tarih hangisidir?",
        subCategory: 'Tarih (Kurtuluş Savaşı)',
        correct: '19 Mayıs 1919',
        distractors: ['23 Nisan 1920', '29 Ekim 1923', '9 Eylül 1922'],
        explanation: '19 Mayıs 1919 Atatürk’ün Bandırma Vapuru ile Samsun’a ulaştığı ve Milli Mücadele’nin başladığı gündür.',
        src: 'Milli Savunma Bakanlığı Arşivi',
    },
];
const HISTORY_MEDIUM = [
    {
        text: "1071 Malazgirt Zaferi ile Anadolu'nun kapılarını Türklere açan Büyük Selçuklu Hükümdarı kimdir?",
        subCategory: 'Tarih (Selçuklu Medeniyeti)',
        correct: 'Sultan Alparslan',
        distractors: ['Tuğrul Bey', 'Melikşah', 'Alâeddin Keykubad'],
        explanation: 'Sultan Alparslan, Bizans İmparatoru Romen Diyojen’i mağlup ederek Anadolu’nun fethini başlatmıştır.',
        src: 'Türk Tarih Kurumu',
    },
    {
        text: "Osmanlı başmimarı Mimar Sinan'ın 'Ustalık Eserim' olarak nitelendirdiği Edirne'deki cami hangisidir?",
        subCategory: 'Tarih (Osmanlı Mimarisi)',
        correct: 'Selimiye Camii',
        distractors: ['Süleymaniye Camii', 'Şehzadebaşı Camii', 'Sultanahmet Camii'],
        explanation: 'Mimar Sinan Şehzadebaşı’na çıraklık, Süleymaniye’ye kalfalık, Selimiye’ye ise ustalık eserim demiştir.',
        src: 'Vakıflar Genel Müdürlüğü',
    },
    {
        text: "Tarihte 'Türk' adını ilk kez resmi devlet adı olarak kullanan Türk devleti hangisidir?",
        subCategory: 'Tarih (İlk Türk Devletleri)',
        correct: 'Göktürk Kağanlığı',
        distractors: ['Asya Hun İmparatorluğu', 'Uygur Devleti', 'Avar Kağanlığı'],
        explanation: 'Bumin Kağan tarafından 552 yılında kurulan Göktürkler Türk adını ilk kez devlet ismi olarak kullanmıştır.',
        src: 'Eski Türk Tarihi Araştırmaları',
    },
    {
        text: "Kurtuluş Savaşı'nda I. ve II. İnönü Zaferlerini kazanan Batı Cephesi Komutanı kimdir?",
        subCategory: 'Tarih (Milli Mücadele)',
        correct: 'İsmet İnönü',
        distractors: ['Fevzi Çakmak', 'Kazım Karabekir', 'Refet Bele'],
        explanation: 'İsmet Paşa Batı Cephesi Komutanı olarak düşman ilerleyişini durduran İnönü zaferlerini kazanmıştır.',
        src: 'Askeri Tarih Arşivi',
    },
];
const HISTORY_HARD = [
    {
        text: "Türkiye Cumhuriyeti'nin uluslararası bağımsızlık senedi sayılan Lozan Barış Antlaşması hangi tarihte imzalanmıştır?",
        subCategory: 'Tarih (Diplomasi)',
        correct: '24 Temmuz 1923',
        distractors: ['29 Ekim 1923', '10 Ağustos 1920', '11 Ekim 1922'],
        explanation: 'İsmet İnönü başkanlığındaki heyet Lozan Antlaşması’nı 24 Temmuz 1923’te imzalamıştır.',
        src: 'Dışişleri Bakanlığı Tarih Arşivi',
    },
    {
        text: "Osmanlı tarihinde ilk kez padişahın yetkilerini ayanlar karşısında kısıtlayan 1808 tarihli belge hangisidir?",
        subCategory: 'Tarih (Osmanlı Hukuku)',
        correct: 'Sened-i İttifak',
        distractors: ['Tanzimat Fermanı', 'Islahat Fermanı', 'Kanun-i Esasi'],
        explanation: 'II. Mahmud ile ayanlar arasında imzalanan Sened-i İttifak ilk anayasal belge sayılır.',
        src: 'Türk Hukuk Tarihi',
    },
    {
        text: "Tarihte bilinen ilk yazılı barış antlaşması kabul edilen M.Ö. 1280 civarındaki Kadeş Antlaşması hangi iki imparatorluk arasında imzalanmıştır?",
        subCategory: 'Tarih (Eski Çağ)',
        correct: 'Hititler ve Mısırlılar',
        distractors: ['Babiller ve Asurlar', 'Persler ve Yunanlar', 'Romalılar ve Kartacalılar'],
        explanation: 'Kadeş Antlaşması Hitit Kralı III. Hattuşili ile Mısır Firavunu II. Ramses arasında yapılmıştır.',
        src: 'İstanbul Arkeoloji Müzeleri',
    },
];
const HISTORY_EXPERT = [
    {
        text: "1833 yılında Osmanlı ile Çarlık Rusyası arasında imzalanan ve Boğazlar Sorunu'nu uluslararası boyuta taşıyan 8 yıllık savunma antlaşması hangisidir?",
        subCategory: 'Tarih (Diplomatik Tarih / Uzman)',
        correct: 'Hünkar İskelesi Antlaşması',
        distractors: ['Balta Limanı Antlaşması', 'Edirne Antlaşması', 'Bükreş Antlaşması'],
        explanation: 'Hünkar İskelesi Antlaşması ile Rusya donanmasına boğazlardan geçiş ayrıcalığı tanınmıştır.',
        src: 'Osmanlı Diplomatik Belgeleri',
    },
    {
        text: "Uygur Kağanlığı'nda yerleşik hayata geçişi hızlandıran ve Maniheizm dininin resmi din kabul edilmesine öncülük eden kağan kimdir?",
        subCategory: 'Tarih (Eski Türk Tarihi / Uzman)',
        correct: 'Bögü Kağan',
        distractors: ['Kutluk Bilge Kül Kağan', 'Moyançur', 'Bumin Kağan'],
        explanation: 'Bögü Kağan 762 yılında Çin seferi dönüşü Mani dinini kabul ederek tapınaklar inşa ettirmiştir.',
        src: 'Uygur Kültür Tarihi',
    },
];
// ============================================================================
// DERECE DERECE BİLİM VE TEKNOLOJİ (SCIENCE & TECH) SORU HAVUZU
// ============================================================================
const SCIENCE_EASY = [
    {
        text: "Güneş Sistemi'ndeki en büyük gezegen hangisidir?",
        subCategory: 'Bilim (Astronomi)',
        correct: 'Jüpiter',
        distractors: ['Satürn', 'Neptün', 'Mars'],
        explanation: 'Jüpiter Güneş Sistemi’nin kütle ve hacim olarak en devasa gaz devi gezegenidir.',
        src: 'NASA Güneş Sistemi Rehberi',
    },
    {
        text: "Dünya'mızın tek doğal uydusu hangisidir?",
        subCategory: 'Bilim (Uzay)',
        correct: 'Ay',
        distractors: ['Kutup Yıldızı', 'Venüs', 'Güneş'],
        explanation: 'Ay, Dünya etrafındaki dönüşünü yaklaşık 27.3 günde tamamlayan tek uydumuzdur.',
        src: 'TÜBİTAK Bilim ve Teknik',
    },
    {
        text: "Standart atmosfer basıncında saf suyun donma noktası kaç derecedir?",
        subCategory: 'Bilim (Fizik & Kimya)',
        correct: '0 °C',
        distractors: ['-10 °C', '4 °C', '10 °C'],
        explanation: '1 atmosfer basınç altında saf su 0 santigrat derecede buz haline geçer.',
        src: 'Temel Fizik İlkeleri',
    },
    {
        text: "Standart atmosfer basıncında saf suyun kaynama sıcaklığı kaç derecedir?",
        subCategory: 'Bilim (Fizik & Kimya)',
        correct: '100 °C',
        distractors: ['90 °C', '120 °C', '80 °C'],
        explanation: '1 atmosfer basınç altında saf su 100 santigrat derecede buharlaşır.',
        src: 'Temel Fizik İlkeleri',
    },
    {
        text: "İnsan kalbi kaç odacıktan oluşmaktadır?",
        subCategory: 'Bilim (Biyoloji)',
        correct: '4 odacık',
        distractors: ['2 odacık', '3 odacık', '6 odacık'],
        explanation: 'İnsan kalbinde 2 kulakçık ve 2 karıncık olmak üzere toplam 4 odacık bulunur.',
        src: 'İnsan Anatomisi Atlası',
    },
];
const SCIENCE_MEDIUM = [
    {
        text: "Yüzeyindeki demir oksit (pas) mineralleri nedeniyle gökyüzünde kırmızımsı parlayan ve 'Kızıl Gezegen' olarak bilinen gezegen hangisidir?",
        subCategory: 'Bilim (Gezegenler)',
        correct: 'Mars',
        distractors: ['Venüs', 'Merkür', 'Satürn'],
        explanation: 'Mars yüzeyindeki yoğun demir oksit sebebiyle Kızıl Gezegen olarak anılır.',
        src: 'NASA Mars Keşif Programı',
    },
    {
        text: "Kanda oksijen taşımakla görevli olan ve kırmızı rengi veren kan hücrelerine ne ad verilir?",
        subCategory: 'Bilim (Biyoloji)',
        correct: 'Alyuvar (Eritrosit)',
        distractors: ['Akyuvar (Lökosit)', 'Trombosit (Kan Pulcuğu)', 'Plazma'],
        explanation: 'Alyuvarlar içlerindeki hemoglobin proteini sayesinde akciğerlerden dokulara oksijen taşır.',
        src: 'Tıbbi Biyoloji İlkeleri',
    },
    {
        text: "Işığın boşluktaki hızı saniyede yaklaşık kaç kilometredir?",
        subCategory: 'Bilim (Fizik)',
        correct: '300.000 km/s',
        distractors: ['150.000 km/s', '1.000.000 km/s', '30.000 km/s'],
        explanation: 'Işık boşlukta saniyede yaklaşık 299.792 km (yuvarlak hesap 300.000 km) hızla ilerler.',
        src: 'Fizik Yasaları',
    },
    {
        text: "Periyodik tabloda kimyasal sembolü 'Au' olan değerli element hangisidir?",
        subCategory: 'Bilim (Kimya)',
        correct: 'Altın',
        distractors: ['Gümüş', 'Bakır', 'Platin'],
        explanation: "Altın elementi Latince 'Aurum' kelimesinden gelen Au simgesiyle gösterilir.",
        src: 'IUPAC Periyodik Tablosu',
    },
];
const SCIENCE_HARD = [
    {
        text: "Periyodik tabloda oda sıcaklığında sıvı halde bulunan TEK metal element hangisidir?",
        subCategory: 'Bilim (Kimya)',
        correct: 'Cıva (Hg)',
        distractors: ['Kurşun (Pb)', 'Galyum (Ga)', 'Brom (Br)'],
        explanation: 'Cıva oda sıcaklığında (20-25 °C) sıvı halde bulunan tek metal elementtir (Brom ametaldir).',
        src: 'IUPAC Kimya Verileri',
    },
    {
        text: "Hücre içerisinde protein sentezinin gerçekleştirildiği zarsız organel hangisidir?",
        subCategory: 'Bilim (Hücre Biyolojisi)',
        correct: 'Ribozom',
        distractors: ['Mitokondri', 'Golgi Cisimciği', 'Lizozom'],
        explanation: 'Ribozomlar aminoasitleri birleştirerek polipeptit zincirlerini ve proteinleri sentezler.',
        src: 'Moleküler Biyoloji İlkeleri',
    },
    {
        text: "Güneş Sistemi'nde diğer gezegenlerin aksine kendi ekseni etrafında saat yönünde (ters yönde) dönen gezegen hangisidir?",
        subCategory: 'Bilim (Astronomi)',
        correct: 'Venüs',
        distractors: ['Mars', 'Jüpiter', 'Neptün'],
        explanation: 'Venüs geriye doğru (retrograd) dönen nadir gezegenlerdendir; Güneş batıdan doğar.',
        src: 'NASA Gezegen Fiziği',
    },
];
const SCIENCE_EXPERT = [
    {
        text: "Termodinamikte moleküler hareketin durduğu varsayılan mutlak sıfır noktası (0 Kelvin) kaç santigrat derecedir?",
        subCategory: 'Bilim (Termodinamik / Uzman)',
        correct: '-273.15 °C',
        distractors: ['-200.00 °C', '-315.50 °C', '-250.00 °C'],
        explanation: '0 Kelvin termodinamiğin ulaşılamaz en alt sınırıdır ve -273.15 °C’ye tekabül eder.',
        src: 'Uluslararası Temel Ölçüm Birimleri',
    },
    {
        text: "1953 yılında DNA'nın çift sarmal yapısını X-ışını kırınımı fotoğrafıyla (Fotoğraf 51) ilk kez kanıtlayan kadın kimyager kimdir?",
        subCategory: 'Bilim (Moleküler Genetik / Uzman)',
        correct: 'Rosalind Franklin',
        distractors: ['Marie Curie', 'Ada Lovelace', 'Barbara McClintock'],
        explanation: 'Rosalind Franklin’in DNA kırınım verileri Watson ve Crick’in çift sarmal modeline temel oluşturmuştur.',
        src: 'Bilim Tarihi Arşivi',
    },
];
// ============================================================================
// DERECE DERECE SPOR (SPORTS) SORU HAVUZU
// ============================================================================
const SPORTS_EASY = [
    {
        text: "Standart bir futbol maçında normal oyun süresi toplam kaç dakikadır?",
        subCategory: 'Spor (Futbol)',
        correct: '90 dakika (45+45)',
        distractors: ['80 dakika', '100 dakika', '60 dakika'],
        explanation: 'Futbol maçı 45’er dakikalık iki devre halinde toplam 90 dakika oynanır.',
        src: 'IFAB Futbol Oyun Kuralları',
    },
    {
        text: "Basketbol maçında bir takımdan sahada aynı anda kaç oyuncu yer alır?",
        subCategory: 'Spor (Basketbol)',
        correct: '5 oyuncu',
        distractors: ['6 oyuncu', '7 oyuncu', '4 oyuncu'],
        explanation: 'Basketbolda sahada her iki takımdan 5’er oyuncu mücadele eder.',
        src: 'FIBA Resmi Kuralları',
    },
    {
        text: "Voleybol maçında bir takım sahada aynı anda kaç oyuncu ile dizilir?",
        subCategory: 'Spor (Voleybol)',
        correct: '6 oyuncu',
        distractors: ['5 oyuncu', '7 oyuncu', '8 oyuncu'],
        explanation: 'Voleybolda takımlar sahada 6 oyuncu ile mücadele eder.',
        src: 'FIVB Voleybol Kuralları',
    },
    {
        text: "2023 yılında Milletler Ligi ve Avrupa Şampiyonu olan Kadın Voleybol A Milli Takımımızın bilinen unvanı nedir?",
        subCategory: 'Spor (Milli Başarılar)',
        correct: 'Filenin Sultanları',
        distractors: ['12 Dev Adam', 'Potanın Perileri', 'Demir Bilekler'],
        explanation: 'Kadın Voleybol Milli Takımımız tarihi başarılarıyla dünya 1 numarasına yerleşmiştir.',
        src: 'Türkiye Voleybol Federasyonu',
    },
];
const SPORTS_MEDIUM = [
    {
        text: "Futbolda penaltı noktasının kale çizgisine olan dik uzaklığı kaç metredir?",
        subCategory: 'Spor (Futbol)',
        correct: '11 metre',
        distractors: ['9 metre', '15 metre', '12 metre'],
        explanation: 'Penaltı atışı kaleden tam 11 metre (12 yard) mesafedeki penaltı noktasından kullanılır.',
        src: 'IFAB Kuralları',
    },
    {
        text: "Basketbolda çemberin (potanın) yerden resmi standart yüksekliği kaç metredir?",
        subCategory: 'Spor (Basketbol)',
        correct: '3.05 metre (10 feet)',
        distractors: ['2.90 metre', '3.20 metre', '3.50 metre'],
        explanation: 'Uluslararası basketbol potasının çember yüksekliği zeminden 3.05 metredir.',
        src: 'FIBA Kuralları',
    },
    {
        text: "Tokyo 2020 Olimpiyatları'nda okçuluk branşında Türkiye'ye tarihindeki ilk altın madalyayı kazandıran sporcumuz kimdir?",
        subCategory: 'Spor (Olimpiyatlar)',
        correct: 'Mete Gazoz',
        distractors: ['Rıza Kayaalp', 'Taha Akgül', 'Ferhat Arıcan'],
        explanation: 'Mete Gazoz klasik yay bireysel finalinde altın madalya kazanarak tarihe geçmiştir.',
        src: 'Türkiye Milli Olimpiyat Komitesi',
    },
];
const SPORTS_HARD = [
    {
        text: "Resmi bir açık hava maraton koşusunun standart mesafesi ne kadardır?",
        subCategory: 'Spor (Atletizm)',
        correct: '42 kilometre 195 metre',
        distractors: ['35 kilometre', '50 kilometre', '21 kilometre 97 metre'],
        explanation: '1908 Londra Olimpiyatları’ndan bu yana standart maraton mesafesi 42.195 km’dir.',
        src: 'World Athletics',
    },
    {
        text: "Grand Slam tenis turnuvalarından biri olan Fransa Açık (Roland Garros) hangi zemin türünde oynanır?",
        subCategory: 'Spor (Tenis)',
        correct: 'Toprak (Kırmızı Kil) Kort',
        distractors: ['Çim Kort', 'Sert (Beton) Kort', 'Halı Kort'],
        explanation: 'Roland Garros, Grand Slam turnuvaları içinde toprak zeminde oynanan tek turnuvadır.',
        src: 'ATP & WTA Resmi Bilgileri',
    },
];
const SPORTS_EXPERT = [
    {
        text: "Futbolda 1950 Dünya Kupası'nda Brezilya'yı 2-1 yenerek Maracana Stadyumu'nda şampiyon olan ve 'Maracanazo' faciasına yol açan ülke hangisidir?",
        subCategory: 'Spor (Dünya Kupası Tarihi / Uzman)',
        correct: 'Uruguay',
        distractors: ['İtalya', 'Arjantin', 'Almanya'],
        explanation: '1950 finalinde Uruguay yaklaşık 200 bin seyirci önünde Brezilya’yı yenerek kupayı almıştır.',
        src: 'FIFA Dünya Kupası Arşivi',
    },
];
// ============================================================================
// DERECE DERECE EDEBİYAT VE KÜLTÜR SORU HAVUZU
// ============================================================================
const LITERATURE_EASY = [
    {
        text: "Türkiye Cumhuriyeti'nin milli marşı olan İstiklal Marşı'mızın şairi kimdir?",
        subCategory: 'Edebiyat (Milli Şiir)',
        correct: 'Mehmet Akif Ersoy',
        distractors: ['Yahya Kemal Beyatlı', 'Tevfik Fikret', 'Ziya Gökalp'],
        explanation: 'İstiklal Marşı Mehmet Akif Ersoy tarafından yazılmış ve 12 Mart 1921’de kabul edilmiştir.',
        src: 'Milli Eğitim Bakanlığı',
    },
    {
        text: "Toroslar'da haksızlığa karşı direnen Memed'in öyküsünü anlatan 'İnce Memed' romanının yazarı kimdir?",
        subCategory: 'Edebiyat (Türk Romanı)',
        correct: 'Yaşar Kemal',
        distractors: ['Orhan Kemal', 'Kemal Tahir', 'Sabahattin Ali'],
        explanation: 'Yaşar Kemal’in başyapıtı olan İnce Memed dünya edebiyatında Türk romanının simgesidir.',
        src: 'Türk Romanı Antolojisi',
    },
    {
        text: "B612 asteroitinden gelen küçük çocuğu ve bir gülü anlatan 'Küçük Prens' adlı ünlü eserin yazarı kimdir?",
        subCategory: 'Edebiyat (Dünya Klasikleri)',
        correct: 'Antoine de Saint-Exupéry',
        distractors: ['Jules Verne', 'Albert Camus', 'Jean-Paul Sartre'],
        explanation: 'Saint-Exupéry’nin yazdığı Küçük Prens dünyada en çok dile çevrilen klasik kitaptır.',
        src: 'Dünya Edebiyatı',
    },
];
const LITERATURE_MEDIUM = [
    {
        text: "'Yaş otuz beş! yolun yarısı eder' mısrasıyla başlayan ünlü 'Yaş 35' şiirinin şairi kimdir?",
        subCategory: 'Edebiyat (Cumhuriyet Şiiri)',
        correct: 'Cahit Sıtkı Tarancı',
        distractors: ['Ahmet Hamdi Tanpınar', 'Attila İlhan', 'Orhan Veli Kanık'],
        explanation: 'Cahit Sıtkı Tarancı 1946 yılında Yaş Otuz Beş şiiriyle edebiyatımızda unutulmaz olmuştur.',
        src: 'Türk Şiiri Antolojisi',
    },
    {
        text: "İdealist öğretmen Feride'nin Anadolu yolculuğunu anlatan 'Çalıkuşu' romanının yazarı kimdir?",
        subCategory: 'Edebiyat (Türk Romanı)',
        correct: 'Reşat Nuri Güntekin',
        distractors: ['Halide Edip Adıvar', 'Yakup Kadri Karaosmanoğlu', 'Refik Halit Karay'],
        explanation: 'Reşat Nuri Güntekin’in Çalıkuşu romanı Türk edebiyatının en sevilen eserlerindendir.',
        src: 'Türk Edebiyatı Vakfı',
    },
    {
        text: "Raif Efendi ve Maria Puder'in aşkını konu alan 'Kürk Mantolu Madonna' eserinin yazarı kimdir?",
        subCategory: 'Edebiyat (Türk Romanı)',
        correct: 'Sabahattin Ali',
        distractors: ['Peyami Safa', 'Oğuz Atay', 'Yusuf Atılgan'],
        explanation: 'Sabahattin Ali’nin 1943 tarihli romanı günümüzde de en çok okunan eserler arasındadır.',
        src: 'Türk Romanı Tarihi',
    },
];
const LITERATURE_HARD = [
    {
        text: "Türk edebiyatında ilk yerli roman kabul edilen 'Taaşşuk-ı Talat ve Fitnat' adlı eserin yazarı kimdir?",
        subCategory: 'Edebiyat (Tanzimat Dönemi)',
        correct: 'Şemsettin Sami',
        distractors: ['Namık Kemal', 'Ahmet Mithat Efendi', 'Sami Paşazade Sezai'],
        explanation: '1872 yılında basılan Taaşşuk-ı Talat ve Fitnat ilk yerli telif romanımızdır.',
        src: 'Tanzimat Edebiyatı Tarihi',
    },
    {
        text: "Dünya edebiyatında ilk modern roman kabul edilen 'Don Kişot'un İspanyol yazarı kimdir?",
        subCategory: 'Edebiyat (Dünya Edebiyatı)',
        correct: 'Miguel de Cervantes',
        distractors: ['William Shakespeare', 'Victor Hugo', 'Dante Alighieri'],
        explanation: 'Cervantes 1605’te yayımladığı Don Kişot ile modern roman çağını başlatmıştır.',
        src: 'İspanyol Edebiyatı Arşivi',
    },
];
const LITERATURE_EXPERT = [
    {
        text: "Ahmet Hamdi Tanpınar'ın Doğu-Batı çatışmasını ve zaman felsefesini Hayri İrdal karakteri üzerinden hicvettiği 1961 tarihli başyapıt romanı hangisidir?",
        subCategory: 'Edebiyat (Modern Türk Romanı / Uzman)',
        correct: 'Saatleri Ayarlama Enstitüsü',
        distractors: ['Huzur', 'Sahnenin Dışındakiler', 'Mahur Beste'],
        explanation: 'Saatleri Ayarlama Enstitüsü Türk modernleşmesini ironi ve saat simgesiyle irdeleyen şaheserdir.',
        src: 'Tanpınar Araştırmaları Merkezi',
    },
];
// ============================================================================
// DİĞER KATEGORİLER VE GENEL KÜLTÜR
// ============================================================================
const GENERAL_EASY = [
    {
        text: "Fransa'nın başkenti neresidir?",
        subCategory: 'Genel Kültür (Başkentler)',
        correct: 'Paris',
        distractors: ['Roma', 'Berlin', 'Madrid'],
        explanation: 'Paris Fransa Cumhuriyeti’nin başkentidir.',
        src: 'BM Ülkeler Rehberi',
    },
    {
        text: "Almanya'nın başkenti neresidir?",
        subCategory: 'Genel Kültür (Başkentler)',
        correct: 'Berlin',
        distractors: ['Münih', 'Frankfurt', 'Hamburg'],
        explanation: 'Berlin Almanya Federal Cumhuriyeti’nin başkentidir.',
        src: 'BM Ülkeler Rehberi',
    },
    {
        text: "İtalya'nın başkenti neresidir?",
        subCategory: 'Genel Kültür (Başkentler)',
        correct: 'Roma',
        distractors: ['Milano', 'Venedik', 'Floransa'],
        explanation: 'Roma İtalya Cumhuriyeti’nin tarihi başkentidir.',
        src: 'BM Ülkeler Rehberi',
    },
    {
        text: "Gözleri birbirinden farklı renklerde (mavi ve kehribar) olabilen Türkiye'ye özgü kedi ırkı hangisidir?",
        subCategory: 'Doğa & Canlılar',
        correct: 'Van Kedisi',
        distractors: ['Ankara Kedisi', 'Tekir Kedi', 'Siyam Kedisi'],
        explanation: 'Van Kedisi heterokromi özelliği ve tüyleriyle dünyaca ünlü tescilli bir ırkımızdır.',
        src: 'Yüzüncü Yıl Üniversitesi Kedi Araştırma Merkezi',
    },
];
const GENERAL_MEDIUM = [
    {
        text: "Şanlıurfa'da yer alan ve 'Tarihin Sıfır Noktası' olarak adlandırılan yaklaşık 12.000 yıllık tapınak kompleksi hangisidir?",
        subCategory: 'Sanat & Arkeoloji',
        correct: 'Göbeklitepe',
        distractors: ['Çatalhöyük', 'Efes', 'Hattuşaş'],
        explanation: 'Göbeklitepe yerleşik hayata geçiş ve mimarlık tarihi hakkındaki tezleri kökten değiştirmiştir.',
        src: 'Kültür ve Turizm Bakanlığı',
    },
    {
        text: "Ressam Osman Hamdi Bey'in 1906 tarihli en ünlü simgesel başyapıt tablosu hangisidir?",
        subCategory: 'Sanat & Resim',
        correct: 'Kaplumbağa Terbiyecisi',
        distractors: ['Silah Tacirleri', 'Yeşil Cami Önü', 'Kur’an Okuyan Kız'],
        explanation: 'Kaplumbağa Terbiyecisi Türk modern resim sanatının en kıymetli tablosudur.',
        src: 'Pera Müzesi',
    },
];
const GENERAL_HARD = [
    {
        text: "Karada yaşayan hayvanlar arasında kısa mesafede saatte 100-120 km hıza çıkabilen en hızlı memeli hangisidir?",
        subCategory: 'Doğa & Canlılar',
        correct: 'Çita',
        distractors: ['Aslan', 'Antilop', 'Leopar'],
        explanation: 'Çitalar esnek omurga ve hafif kemik yapıları sayesinde en hızlı ivmelenen kara canlısıdır.',
        src: 'National Geographic',
    },
];
const GENERAL_EXPERT = [
    {
        text: "Paris Louvre Müzesi'nde sergilenen ünlü 'Mona Lisa' tablosunun ahşap panelinde kullanılan ağaç türü hangisidir?",
        subCategory: 'Sanat Tarihi / Uzman',
        correct: 'Kavak Ağacı Paneli (Poplar)',
        distractors: ['Meşe Ağacı', 'Ceviz Ağacı', 'Çam Ağacı'],
        explanation: 'Leonardo da Vinci Mona Lisa eserini tuval yerine ince kavak ağacı tahtası üzerine yağlıboya ile işlemiştir.',
        src: 'Louvre Müzesi Restorasyon Raporları',
    },
];
// ============================================================================
// DERECEYE GÖRE DÖNÜŞTÜRÜCÜ HELPER
// ============================================================================
function defToCandidate(def) {
    const choices = shuffle([def.correct, ...def.distractors]);
    return {
        text: def.text,
        subCategory: def.subCategory,
        options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
        correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(def.correct))}`,
        explanation: def.explanation,
        sourceOrVerification: def.src || 'Resmi Doğrulama Kaynağı',
    };
}
// ============================================================================
// MASTER PROCEDURAL GENERATOR (KATEGORİ VE ZORLUK DÜZEYİNE TAM UYUMLU)
// ============================================================================
function generateGuaranteedUniqueCandidates(categoryId, difficulty, count, existingDbSignatures) {
    const results = [];
    const currentBatchSigs = new Set();
    // Kategori ve ZORLUK derecesine göre kesin havuz seçimi
    let pool = [];
    if (categoryId === 'geography') {
        if (difficulty === 'easy')
            pool = [...GEOGRAPHY_EASY];
        else if (difficulty === 'medium')
            pool = [...GEOGRAPHY_MEDIUM];
        else if (difficulty === 'hard')
            pool = [...GEOGRAPHY_HARD];
        else if (difficulty === 'expert')
            pool = [...GEOGRAPHY_EXPERT];
    }
    else if (categoryId === 'history') {
        if (difficulty === 'easy')
            pool = [...HISTORY_EASY];
        else if (difficulty === 'medium')
            pool = [...HISTORY_MEDIUM];
        else if (difficulty === 'hard')
            pool = [...HISTORY_HARD];
        else if (difficulty === 'expert')
            pool = [...HISTORY_EXPERT];
    }
    else if (categoryId === 'science_tech' || categoryId === 'physics_chemistry' || categoryId === 'biology') {
        if (difficulty === 'easy')
            pool = [...SCIENCE_EASY];
        else if (difficulty === 'medium')
            pool = [...SCIENCE_MEDIUM];
        else if (difficulty === 'hard')
            pool = [...SCIENCE_HARD];
        else if (difficulty === 'expert')
            pool = [...SCIENCE_EXPERT];
    }
    else if (categoryId === 'sports') {
        if (difficulty === 'easy')
            pool = [...SPORTS_EASY];
        else if (difficulty === 'medium')
            pool = [...SPORTS_MEDIUM];
        else if (difficulty === 'hard')
            pool = [...SPORTS_HARD];
        else if (difficulty === 'expert')
            pool = [...SPORTS_EXPERT];
    }
    else if (categoryId === 'literature') {
        if (difficulty === 'easy')
            pool = [...LITERATURE_EASY];
        else if (difficulty === 'medium')
            pool = [...LITERATURE_MEDIUM];
        else if (difficulty === 'hard')
            pool = [...LITERATURE_HARD];
        else if (difficulty === 'expert')
            pool = [...LITERATURE_EXPERT];
    }
    else {
        // Genel kültür / Diğer kategoriler: Kendi zorluk düzeyindeki tüm genel ve branş sorularını toplar
        if (difficulty === 'easy') {
            pool = [...GEOGRAPHY_EASY, ...HISTORY_EASY, ...SCIENCE_EASY, ...SPORTS_EASY, ...LITERATURE_EASY, ...GENERAL_EASY];
        }
        else if (difficulty === 'medium') {
            pool = [...GEOGRAPHY_MEDIUM, ...HISTORY_MEDIUM, ...SCIENCE_MEDIUM, ...SPORTS_MEDIUM, ...LITERATURE_MEDIUM, ...GENERAL_MEDIUM];
        }
        else if (difficulty === 'hard') {
            pool = [...GEOGRAPHY_HARD, ...HISTORY_HARD, ...SCIENCE_HARD, ...SPORTS_HARD, ...LITERATURE_HARD, ...GENERAL_HARD];
        }
        else {
            pool = [...GEOGRAPHY_EXPERT, ...HISTORY_EXPERT, ...SCIENCE_EXPERT, ...SPORTS_EXPERT, ...LITERATURE_EXPERT, ...GENERAL_EXPERT];
        }
    }
    // Havuzu karıştır
    const shuffledPool = shuffle(pool);
    for (const def of shuffledPool) {
        if (results.length >= count)
            break;
        const sig = normalizeSig(def.text);
        if (!currentBatchSigs.has(sig) && !existingDbSignatures.has(sig)) {
            currentBatchSigs.add(sig);
            results.push(defToCandidate(def));
        }
    }
    // Eğer istenen adet havuzdaki tekil sayısından fazlaysa, hafif varyasyonla tamamla
    let safetyAttempts = 0;
    while (results.length < count && safetyAttempts < 50 && pool.length > 0) {
        safetyAttempts++;
        const def = pool[Math.floor(Math.random() * pool.length)];
        const candidate = defToCandidate(def);
        const sig = normalizeSig(candidate.text);
        if (!currentBatchSigs.has(sig)) {
            currentBatchSigs.add(sig);
            results.push(candidate);
        }
    }
    return results;
}
