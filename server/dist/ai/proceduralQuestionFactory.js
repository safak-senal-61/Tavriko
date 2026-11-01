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
// 1. COĞRAFYA (GEOGRAPHY) - GENİŞ VE ÇOK YÖNLÜ VERİ SETLERİ
// ============================================================================
// A) Dağlar ve Zirveler
const GEOGRAPHY_MOUNTAINS = [
    {
        name: 'Ağrı Dağı',
        feature: "Türkiye'nin en yüksek dağı",
        detail: "5.137 metre yüksekliği ile Türkiye'nin ve Anadolu Yarımadası'nın en yüksek zirvesidir.",
        distractors: ['Erciyes Dağı', 'Süphan Dağı', 'Kaçkar Dağı'],
    },
    {
        name: 'Uludağ',
        feature: "Marmara Bölgesi'nin ve Bursa ilimizin en ünlü kış turizmi ve kayak merkezi olan dağı",
        detail: 'Eski adı Keşiş Dağı olan Uludağ, 2.543 metre yüksekliğiyle Marmara’nın en yüksek noktasıdır.',
        distractors: ['Palandöken Dağı', 'Erciyes Dağı', 'Kartepe'],
    },
    {
        name: 'Palandöken Dağı',
        feature: "Kış sporları ve Dünya Üniversiteler Kış Oyunları'na ev sahipliği yapmış olan Erzurum'daki ünlü kayak merkezi dağı",
        detail: 'Palandöken, Türkiye’nin en uzun ve dik kayak pistlerine sahip dağlarından biridir.',
        distractors: ['Uludağ', 'Kartalkaya', 'Erciyes Dağı'],
    },
    {
        name: 'Erciyes Dağı',
        feature: "Kayseri ilimizin simgesi olan sönmüş volkanik dağ",
        detail: "İç Anadolu Bölgesi'nin 3.917 metre ile en yüksek zirvesi olan sönmüş bir stratovolkandır.",
        distractors: ['Hasan Dağı', 'Nemrut Dağı', 'Süphan Dağı'],
    },
    {
        name: 'Kaçkar Dağları',
        feature: "Rize ve Artvin illerimiz boyunca uzanan, buzul gölleri ve yaylalarıyla ünlü sıradağlar",
        detail: 'Doğu Karadeniz Dağları’nın en yüksek bölümünü oluşturan Kaçkarlar milli park statüsündedir.',
        distractors: ['Toros Dağları', 'Yıldız Dağları', 'Köroğlu Dağları'],
    },
    {
        name: 'Everest',
        feature: 'Himalayalar üzerinde bulunan dünyanın en yüksek dağı',
        detail: 'Deniz seviyesinden 8.848 metre yüksekliğiyle yeryüzünün en yüksek zirvesidir.',
        distractors: ['K2', 'Kilimanjaro', 'Mont Blanc'],
    },
    {
        name: 'Kilimanjaro',
        feature: "Afrika kıtasının en yüksek dağı",
        detail: "Tanzanya sınırları içerisinde yer alan sönmüş bir stratovolkandır (5.895 m).",
        distractors: ['Everest', 'Alpler', 'And Dağları'],
    },
    {
        name: 'Mont Blanc',
        feature: "Avrupa kıtasında Alpler sıradağlarının en yüksek zirvesi",
        detail: 'Fransa ile İtalya sınırında yer alır ve 4.808 metre yüksekliğe sahiptir.',
        distractors: ['Everest', 'Kilimanjaro', 'Ural Dağları'],
    },
];
// B) Göller ve Sulak Alanlar
const GEOGRAPHY_LAKES = [
    {
        name: 'Van Gölü',
        feature: "Türkiye'nin yüz ölçümü en büyük ve suyu sodalı olan gölü",
        detail: '3.713 km² alanı ile Türkiye’nin en büyük gölüdür ve dünyanın en büyük sodalı gölü kabul edilir.',
        distractors: ['Tuz Gölü', 'Beyşehir Gölü', 'İznik Gölü'],
    },
    {
        name: 'Tuz Gölü',
        feature: "Türkiye'nin ikinci büyük gölü olup ülkemizin tuz ihtiyacının büyük kısmını karşılayan göl",
        detail: 'İç Anadolu’da Ankara, Konya ve Aksaray illerinin kesişiminde yer alan sığ bir tektonik göldür.',
        distractors: ['Van Gölü', 'Eğirdir Gölü', 'Burdur Gölü'],
    },
    {
        name: 'Beyşehir Gölü',
        feature: "Türkiye'nin yüz ölçümü en büyük TATLI SU gölü",
        detail: 'Konya ve Isparta sınırlarında yer alan Beyşehir Gölü 650 km² alana sahip en büyük tatlı su gölümüzdür.',
        distractors: ['Van Gölü', 'Tuz Gölü', 'Sapanca Gölü'],
    },
    {
        name: 'Çıldır Gölü',
        feature: "Kış aylarında yüzeyi tamamen buz tutan ve üzerinde atlı kızaklarla gezilebilen gölümüz",
        detail: 'Ardahan ve Kars illerimiz arasında yer alır ve kış turizminin simgelerindendir.',
        distractors: ['Abant Gölü', 'Tortum Gölü', 'Nemrut Gölü'],
    },
    {
        name: 'Meke Gölü',
        feature: "Konya Karapınar'da yer alan ve 'Dünyanın Nazar Boncuğu' olarak bilinen maar gölü",
        detail: 'Ortasında bir volkan konisi bulunan çift katmanlı eşsiz bir jeolojik oluşumdur.',
        distractors: ['Salda Gölü', 'Nemrut Gölü', 'Eğirdir Gölü'],
    },
    {
        name: 'Salda Gölü',
        feature: "Beyaz kumsalları ve berrak turkuaz suyuyla 'Türkiye'nin Maldivleri' olarak anılan Burdur'daki gölümüz",
        detail: 'Yüksek magnezyum içeren beyaz hidromanyezit tortullarıyla Mars yüzeyine benzerliği araştırılmıştır.',
        distractors: ['Meke Gölü', 'Van Gölü', 'İznik Gölü'],
    },
    {
        name: 'Baykal Gölü',
        feature: "Dünyanın en derin ve en eski tatlı su gölü",
        detail: 'Rusya’nın Sibirya bölgesinde yer alır; derinliği 1.642 metreye ulaşır.',
        distractors: ['Victoria Gölü', 'Hazar Denizi', 'Süperior Gölü'],
    },
    {
        name: 'Hazar Denizi',
        feature: "Dünyanın yüz ölçümü bakımından en büyük kapalı su kütlesi / gölü",
        detail: 'Genişliği ve tuzlu yapısı nedeniyle deniz olarak adlandırılsa da okyanus bağlantısı olmayan devasa bir göldür.',
        distractors: ['Baykal Gölü', 'Aral Gölü', 'Karadeniz'],
    },
];
// C) Nehirler ve Akarsular
const GEOGRAPHY_RIVERS = [
    {
        name: 'Kızılırmak',
        feature: "Tamamı Türkiye sınırları içerisinde doğup Karadeniz'e dökülen en uzun nehrimiz",
        detail: "Sivas'ın İmranlı ilçesinden doğar, Bafra Deltası'ndan Karadeniz'e dökülür (1.355 km).",
        distractors: ['Yeşilırmak', 'Sakarya Nehri', 'Fırat Nehri'],
    },
    {
        name: 'Fırat ve Dicle',
        feature: "Türkiye'de doğup Mezopotamya üzerinden Basra Körfezi'ne dökülen nehir çifti",
        detail: 'Şattülarap bölgesinde birleşerek Basra Körfezi’ne ulaşan tarihi Mezopotamya akarsularıdır.',
        distractors: ['Kızılırmak ve Yeşilırmak', 'Seyhan ve Ceyhan', 'Aras ve Kura'],
    },
    {
        name: 'Çoruh Nehri',
        feature: "Dünyanın en hızlı akan ve uluslararası rafting yarışmalarına ev sahipliği yapan Artvin'deki nehrimiz",
        detail: 'Mescit Dağları’ndan doğup Gürcistan Batum sınırından Karadeniz’e dökülür.',
        distractors: ['Manavgat Çayı', 'Gediz Nehri', 'Meriç Nehri'],
    },
    {
        name: 'Meriç Nehri',
        feature: "Türkiye ile Yunanistan arasında doğal sınır oluşturan sınır nehrimiz",
        detail: 'Bulgaristan’dan doğup Edirne üzerinden Ege Denizi Saros Körfezi’ne dökülür.',
        distractors: ['Kızılırmak', 'Sakarya Nehri', 'Bakırçay'],
    },
    {
        name: 'Nil Nehri',
        feature: "Afrika kıtasında yer alan dünyanın en uzun nehri",
        detail: 'Afrika’nın doğusundan Akdeniz’e doğru 6.650 km boyunca uzanır.',
        distractors: ['Amazon Nehri', 'Tuna Nehri', 'Mississippi Nehri'],
    },
    {
        name: 'Amazon Nehri',
        feature: "Güney Amerika'da yer alan, taşıdığı su miktarı bakımından dünyanın en büyük nehri",
        detail: 'Atlas Okyanusu’na dökülen nehir dünyanın en geniş yağmur ormanı havzasına sahiptir.',
        distractors: ['Nil Nehri', 'Tuna Nehri', 'Ganj Nehri'],
    },
    {
        name: 'Tuna Nehri',
        feature: "Almanya'dan doğup Avrupa'nın 10 ülkesinden geçerek Karadeniz'e dökülen uluslararası nehir",
        detail: 'Viyana, Budapeşte ve Belgrad gibi Avrupa başkentlerinden geçer.',
        distractors: ['Ren Nehri', 'Volga Nehri', 'Sen Nehri'],
    },
];
// D) Denizler, Boğazlar ve Kanallar
const GEOGRAPHY_SEAS_STRAITS = [
    {
        name: 'Marmara Denizi',
        feature: "Tamamı Türkiye'nin ulusal sınırları içerisinde yer alan iç deniz",
        detail: 'İstanbul ve Çanakkale boğazlarıyla Karadeniz ve Ege Denizi’ni birbirine bağlar.',
        distractors: ['Ege Denizi', 'Karadeniz', 'Akdeniz'],
    },
    {
        name: 'İstanbul Boğazı',
        feature: "Karadeniz ile Marmara Denizi'ni birbirine bağlayan ve Asya ile Avrupa'yı ayıran su yolu",
        detail: 'Uluslararası deniz ticaretinde Montrö Boğazlar Sözleşmesi hükümlerine tabidir.',
        distractors: ['Çanakkale Boğazı', 'Cebelitarık Boğazı', 'Hürmüz Boğazı'],
    },
    {
        name: 'Çanakkale Boğazı',
        feature: "Marmara Denizi ile Ege Denizi'ni birbirine bağlayan tarihi boğazımız",
        detail: '1915 Çanakkale Zaferi’nin kazanıldığı stratejik deniz geçididir.',
        distractors: ['İstanbul Boğazı', 'Süveyş Kanalı', 'Korint Kanalı'],
    },
    {
        name: 'Cebelitarık Boğazı',
        feature: "Akdeniz'i Atlas Okyanusu'na bağlayan ve Avrupa ile Afrika kıtalarını ayıran boğaz",
        detail: 'İspanya ile Fas arasında yer alır ve Akdeniz’in okyanusa tek doğal çıkışıdır.',
        distractors: ['Babülmendep Boğazı', 'Hürmüz Boğazı', 'Bering Boğazı'],
    },
    {
        name: 'Süveyş Kanalı',
        feature: "Akdeniz ile Kızıldeniz'i birbirine bağlayan insan yapımı kanal",
        detail: 'Mısır topraklarında 1869’da açılmış ve Asya-Avrupa deniz ticaret yolunu binlerce kilometre kısaltmıştır.',
        distractors: ['Panama Kanalı', 'Kiel Kanalı', 'Korint Kanalı'],
    },
    {
        name: 'Panama Kanalı',
        feature: "Atlas Okyanusu ile Büyük Okyanus'u (Pasifik) birbirine bağlayan kanal",
        detail: 'Orta Amerika’da Panama kıstağında yer alır ve havuzlu asansör sistemiyle çalışır.',
        distractors: ['Süveyş Kanalı', 'Cebelitarık Boğazı', 'Malakka Boğazı'],
    },
    {
        name: 'Gökçeada (İmroz)',
        feature: "Türkiye'nin yüz ölçümü en büyük adası",
        detail: "Çanakkale ilimize bağlı olup Ege Denizi'nde yer almaktadır.",
        distractors: ['Bozcaada', 'Marmara Adası', 'Büyükada'],
    },
];
// E) Doğa Harikaları ve Turistik Oluşumlar
const GEOGRAPHY_WONDERS = [
    {
        name: 'Pamukkale Travertenleri',
        city: 'Denizli',
        feature: "Beyaz kalker terasları ve termal sularıyla ünlü UNESCO Dünya Mirası doğa harikası",
        detail: 'Kalsiyum hidrokarbonatça zengin termal suların oksijenle teması sonucu çökelmesiyle oluşmuştur.',
        distractors: ['Afyonkarahisar', 'Aydın', 'Muğla'],
    },
    {
        name: 'Peri Bacaları (Kapadokya)',
        city: 'Nevşehir',
        feature: "Volkanik tüflerin rüzgar ve yağmurla aşınmasıyla oluşan peri bacalarının bulunduğu ilimiz",
        detail: 'Erciyes ve Hasan Dağı’nın püskürttüğü tüflerin milyonlarca yıllık aşınımı sonucu meydana gelmiştir.',
        distractors: ['Kayseri', 'Niğde', 'Konya'],
    },
    {
        name: 'Düden ve Manavgat Şelaleleri',
        city: 'Antalya',
        feature: "Akdeniz'e dökülen ünlü Düden ve Manavgat şelalelerine ev sahipliği yapan ilimiz",
        detail: 'Karstik su kaynaklarıyla beslenen şelaleler Türkiye turizminin en önemli duraklarındandır.',
        distractors: ['Mersin', 'Muğla', 'Adana'],
    },
    {
        name: 'Saklıkent Kanyonu',
        city: 'Muğla - Antalya Sınırı',
        feature: "18 km uzunluğu ve dik yamaçlarıyla Türkiye'nin en görkemli kanyonlarından biri",
        detail: 'Karaçay nehrinin derin vadiyi yarmasıyla oluşmuştur ve yürüyüş parkurlarıyla ünlüdür.',
        distractors: ['Rize', 'Bolu', 'Eskişehir'],
    },
    {
        name: 'Ihlara Vadisi',
        city: 'Aksaray',
        feature: "Melendiz Çayı'nın kanyonu yarmasıyla oluşan ve tarihi kaya kiliselerine sahip vadi",
        detail: 'Kapadokya bölgesinin batı ucunda yer alan 14 km uzunluğunda doğal bir kanyondur.',
        distractors: ['Nevşehir', 'Kırşehir', 'Yozgat'],
    },
    {
        name: 'Cennet ve Cehennem Obrukları',
        city: 'Mersin (Silifke)',
        feature: "Yeraltı sularının kireçtaşını eritip çökmesiyle oluşan karstik obruklarımız",
        detail: 'Cennet obruğunun tabanında Meryem Ana Kilisesi ve mağara bulunmaktadır.',
        distractors: ['Antalya', 'Hatay', 'Gaziantep'],
    },
];
// F) Bölgeler, Sınırlar ve Komşular
const GEOGRAPHY_REGIONS = [
    {
        q: "Türkiye'nin en uzun kara sınırına sahip olduğu komşu ülke hangisidir?",
        correct: 'Suriye (yaklaşık 911 km)',
        distractors: ['İran', 'Irak', 'Yunanistan'],
        exp: 'Türkiye’nin en uzun kara sınırı 911 km ile Suriye iledir.',
    },
    {
        q: "Türkiye'nin en kısa kara sınırına sahip olduğu komşusu hangisidir?",
        correct: 'Azerbaycan (Nahçıvan Özerk Cumhuriyeti)',
        distractors: ['Gürcistan', 'Ermenistan', 'Bulgaristan'],
        exp: 'Dilucu Sınır Kapısı üzerinden Nahçıvan ile yaklaşık 13-18 km’lik en kısa kara sınırımız bulunur.',
    },
    {
        q: "Türkiye'nin Bulgaristan ile ana karayolu sınır kapısı hangisidir?",
        correct: 'Kapıkule Sınır Kapısı (Edirne)',
        distractors: ['İpsala Sınır Kapısı', 'Sarp Sınır Kapısı', 'Gürbulak Sınır Kapısı'],
        exp: 'Kapıkule, Edirne’de yer alan ve Avrupa’ya açılan en yoğun gümrük kapımızdır.',
    },
    {
        q: "Türkiye'nin Gürcistan ile Karadeniz kıyısındaki sınır kapısı hangisidir?",
        correct: 'Sarp Sınır Kapısı (Artvin)',
        distractors: ['Dilucu', 'Habur', 'Öncüpınar'],
        exp: 'Sarp Sınır Kapısı Artvin’in Kemalpaşa ilçesinde yer alır ve Gürcistan’a açılır.',
    },
    {
        q: "Türkiye'de orman varlığı ve yağış miktarı en fazla olan coğrafi bölge hangisidir?",
        correct: 'Karadeniz Bölgesi',
        distractors: ['Akdeniz Bölgesi', 'Ege Bölgesi', 'Marmara Bölgesi'],
        exp: 'Karadeniz Bölgesi, her mevsim yağışlı iklimi sayesinde Türkiye’nin en zengin orman örtüsüne sahiptir.',
    },
    {
        q: "Türkiye'nin yüz ölçümü bakımından en büyük coğrafi bölgesi hangisidir?",
        correct: 'Doğu Anadolu Bölgesi',
        distractors: ['İç Anadolu Bölgesi', 'Karadeniz Bölgesi', 'Akdeniz Bölgesi'],
        exp: 'Doğu Anadolu Bölgesi 164.000 km² ile Türkiye topraklarının yaklaşık %21’ini kapsar.',
    },
];
// G) Kıtalar, Okyanuslar ve İklim
const GEOGRAPHY_CONTINENTS = [
    {
        q: 'Dünya üzerinde hem alan hem de nüfus bakımından en büyük kıta hangisidir?',
        correct: 'Asya Kıtası',
        distractors: ['Afrika Kıtası', 'Avrupa Kıtası', 'Kuzey Amerika Kıtası'],
        exp: 'Asya kıtası yaklaşık 44 milyon km² yüz ölçümüyle dünyanın en büyük kıtasıdır.',
    },
    {
        q: 'Dünyanın en büyük okyanusu hangisidir?',
        correct: 'Pasifik (Büyük Okyanus)',
        distractors: ['Atlas Okyanusu (Atlantik)', 'Hint Okyanusu', 'Kuzey Buz Denizi (Arktik)'],
        exp: 'Büyük Okyanus, Dünya yüzeyinin yaklaşık üçte birini kaplayan en geniş okyanustur.',
    },
    {
        q: 'Dünyanın en büyük sıcak çölü olan Büyük Sahra Çölü hangi kıtadadır?',
        correct: 'Afrika Kıtası',
        distractors: ['Asya Kıtası', 'Avustralya Kıtası', 'Güney Amerika Kıtası'],
        exp: 'Büyük Sahra Çölü Kuzey Afrika boyunca yaklaşık 9 milyon km² alanı kaplar.',
    },
    {
        q: "Yazları sıcak ve kurak, kışları ılık ve yağışlı geçen, bitki örtüsü 'maki' olan iklim tipi hangisidir?",
        correct: 'Akdeniz İklimi',
        distractors: ['Karadeniz İklimi', 'Karasal İklim', 'Muson İklimi'],
        exp: 'Akdeniz ikliminin karakteristik bodur ağaç ve çalı topluluğuna maki adı verilir.',
    },
];
// H) Dünya Başkentleri (Seyrek Çıkacak)
const WORLD_CAPITALS = [
    { country: 'Fransa', capital: 'Paris' },
    { country: 'İtalya', capital: 'Roma' },
    { country: 'Almanya', capital: 'Berlin' },
    { country: 'İspanya', capital: 'Madrid' },
    { country: 'Portekiz', capital: 'Lizbon' },
    { country: 'İngiltere', capital: 'Londra' },
    { country: 'Japonya', capital: 'Tokyo' },
    { country: 'Güney Kore', capital: 'Seul' },
    { country: 'Avustralya', capital: 'Canberra' },
    { country: 'Kanada', capital: 'Ottawa' },
    { country: 'Mısır', capital: 'Kahire' },
    { country: 'Yunanistan', capital: 'Atina' },
    { country: 'Norveç', capital: 'Oslo' },
    { country: 'Azerbaycan', capital: 'Bakü' },
    { country: 'Özbekistan', capital: 'Taşkent' },
];
// I) İl Plakaları (Seyrek Çıkacak)
const TURKISH_CITIES = [
    { plate: '01', name: 'Adana', food: 'Adana Kebabı' },
    { plate: '06', name: 'Ankara', food: 'Ankara Tavası' },
    { plate: '07', name: 'Antalya', food: 'Piyaz' },
    { plate: '16', name: 'Bursa', food: 'İskender Kebabı' },
    { plate: '27', name: 'Gaziantep', food: 'Antep Baklavası' },
    { plate: '34', name: 'İstanbul', food: 'Sultanahmet Köftesi' },
    { plate: '35', name: 'İzmir', food: 'Boyoz' },
    { plate: '38', name: 'Kayseri', food: 'Mantı ve Pastırma' },
    { plate: '42', name: 'Konya', food: 'Etli Ekmek' },
    { plate: '53', name: 'Rize', food: 'Rize Çayı ve Muhlama' },
    { plate: '61', name: 'Trabzon', food: 'Akçaabat Köftesi' },
];
// ============================================================================
// 2. DİĞER KATEGORİLER İÇİN ZENGİN VERİ HAVUZLARI
// ============================================================================
// TARİH
const HISTORY_TOPICS = [
    {
        q: "Mustafa Kemal Atatürk'ün Samsun'a çıkarak Kurtuluş Savaşı'nı fiilen başlattığı tarihi gün hangisidir?",
        correct: '19 Mayıs 1919',
        distractors: ['23 Nisan 1920', '29 Ekim 1923', '30 Ağustos 1922'],
        exp: '19 Mayıs 1919, Atatürk’ün Samsun’a ayak basarak milli egemenlik mücadelesini başlattığı gündür.',
    },
    {
        q: "Türkiye Büyük Millet Meclisi (TBMM) hangi tarihte Ankara'da açılmıştır?",
        correct: '23 Nisan 1920',
        distractors: ['19 Mayıs 1919', '29 Ekim 1923', '9 Eylül 1922'],
        exp: '23 Nisan 1920’de TBMM açılarak milli irade resmi olarak yönetime geçmiştir.',
    },
    {
        q: 'Cumhuriyet hangi tarihte ilan edilmiştir?',
        correct: '29 Ekim 1923',
        distractors: ['23 Nisan 1920', '30 Ağustos 1922', '19 Mayıs 1919'],
        exp: '29 Ekim 1923’te TBMM’de kabul edilen anayasa değişikliği ile Türkiye Devleti’nin yönetim şekli Cumhuriyet olmuştur.',
    },
    {
        q: "1071 yılında Malazgirt Zaferi ile Anadolu'nun kapılarını Türklere açan Büyük Selçuklu Hükümdarı kimdir?",
        correct: 'Sultan Alparslan',
        distractors: ['Tuğrul Bey', 'Melikşah', 'Alâeddin Keykubad'],
        exp: 'Sultan Alparslan, Bizans İmparatoru Romen Diyojen’i mağlup ederek Türklerin Anadolu’ya yerleşmesini sağlamıştır.',
    },
    {
        q: "1453 yılında İstanbul'u fethederek bir çağı kapatıp yeni bir çağ açan Osmanlı padişahı kimdir?",
        correct: 'Fatih Sultan Mehmet (II. Mehmet)',
        distractors: ['Yavuz Sultan Selim', 'Kanuni Sultan Süleyman', 'Yıldırım Bayezid'],
        exp: 'Fatih Sultan Mehmet, 29 Mayıs 1453’te 21 yaşında İstanbul’u fethederek Orta Çağ’ı kapatmıştır.',
    },
    {
        q: "Osmanlı Devleti'nde 'Ustalık Eserim' dediği Edirne Selimiye Camii'ni inşa eden dahi başmimar kimdir?",
        correct: 'Mimar Sinan',
        distractors: ['Mimar Hayreddin', 'Sedefkar Mehmet Ağa', 'Mimar Davut Ağa'],
        exp: 'Mimar Sinan Şehzadebaşı’na çıraklık, Süleymaniye’ye kalfalık, Selimiye’ye ise ustalık eserim demiştir.',
    },
    {
        q: "Tarihte 'Türk' adını resmi devlet adı olarak kullanan İLK Türk devleti hangisidir?",
        correct: 'Göktürk Kağanlığı',
        distractors: ['Asya Hun İmparatorluğu', 'Uygur Devleti', 'Avar Kağanlığı'],
        exp: 'Bumin Kağan tarafından 552 yılında kurulan Göktürkler Türk adını ilk kez devlet adı olarak kullanmıştır.',
    },
    {
        q: 'Dünyanın ilk kadın savaş pilotu unvanına sahip Türk havacı kimdir?',
        correct: 'Sabiha Gökçen',
        distractors: ['Bedriye Tahir Gökmen', 'Nene Hatun', 'Halide Edip Adıvar'],
        exp: 'Atatürk’ün manevi kızı Sabiha Gökçen 1937 yılında dünyanın ilk kadın savaş pilotu olmuştur.',
    },
];
// BİLİM VE TEKNOLOJİ / UZAY / BİYOLOJİ
const SCIENCE_TECH_TOPICS = [
    {
        q: "Güneş Sistemi'ndeki en büyük gezegen hangisidir?",
        correct: 'Jüpiter',
        distractors: ['Satürn', 'Neptün', 'Mars'],
        exp: 'Jüpiter, kütlesi ve hacmiyle Güneş Sistemi’nin en devasa gaz devi gezegenidir.',
    },
    {
        q: "Güneş Sistemi'nde yüzeyindeki demir oksit nedeniyle 'Kızıl Gezegen' olarak bilinen gezegen hangisidir?",
        correct: 'Mars',
        distractors: ['Venüs', 'Merkür', 'Jüpiter'],
        exp: 'Mars, toprağındaki paslı demir minerallerinden dolayı gökyüzünde kırmızımsı parlar.',
    },
    {
        q: 'Dünya’mızın tek doğal uydusu hangisidir?',
        correct: 'Ay',
        distractors: ['Güneş', 'Kutup Yıldızı', 'Titan'],
        exp: 'Ay, Dünya etrafındaki dönüşünü yaklaşık 27.3 günde tamamlayan tek doğal uydumuzdur.',
    },
    {
        q: '1969 yılında Ay yüzeyine ilk ayak basan astronot kimdir?',
        correct: 'Neil Armstrong',
        distractors: ['Buzz Aldrin', 'Yuri Gagarin', 'Michael Collins'],
        exp: 'Apollo 11 göreviyle Ay’a inen Neil Armstrong, "İnsan için küçük, insanlık için dev bir adım" demiştir.',
    },
    {
        q: 'İnsan vücudunun en büyük iç organı hangisidir?',
        correct: 'Karaciğer',
        distractors: ['Akciğer', 'Mide', 'Kalp'],
        exp: 'Karaciğer yaklaşık 1.5 kg ağırlığıyla vücudun en büyük ve en çok metabolik işlem yapan iç organıdır.',
    },
    {
        q: 'İnsan kalbi kaç odacıktan (kulakçık ve karıncık) oluşmaktadır?',
        correct: '4 odacık',
        distractors: ['2 odacık', '3 odacık', '6 odacık'],
        exp: 'İnsan kalbinde 2 üst kulakçık ve 2 alt karıncık olmak üzere toplam 4 odacık bulunur.',
    },
    {
        q: 'Kanda oksijen taşımakla görevli kırmızı kan hücrelerine ne ad verilir?',
        correct: 'Alyuvar (Eritrosit)',
        distractors: ['Akyuvar (Lökosit)', 'Trombosit (Kan Pulcuğu)', 'Plazma'],
        exp: 'Alyuvarlar içerdikleri hemoglobin proteini sayesinde akciğerlerden dokulara oksijen taşır.',
    },
    {
        q: 'Saf suyun standart deniz seviyesi basıncında kaynama sıcaklığı kaç derecedir?',
        correct: '100 °C',
        distractors: ['90 °C', '120 °C', '80 °C'],
        exp: '1 atmosfer basınç altında saf su 0 °C’de donar ve 100 °C’de kaynar.',
    },
    {
        q: 'Ses dalgaları neden uzay boşluğunda yayılamaz?',
        correct: 'Maddesel bir ortam (tanecik) bulunmadığı için',
        distractors: ['Uzay çok soğuk olduğu için', 'Yerçekimi olmadığı için', 'Işık hızı daha hızlı olduğu için'],
        exp: 'Ses mekanik bir dalgadır ve yayılmak için katı, sıvı veya gaz gibi maddesel ortama ihtiyaç duyar.',
    },
];
// SPOR
const SPORTS_TOPICS = [
    {
        q: 'Standart bir futbol maçında normal oyun süresi kaç dakikadır?',
        correct: '90 dakika (45+45)',
        distractors: ['80 dakika', '100 dakika', '60 dakika'],
        exp: 'Futbol maçı 45’er dakikalık iki devre halinde toplam 90 dakika oynanır.',
    },
    {
        q: 'Futbolda penaltı noktasının kale çizgisine olan uzaklığı kaç metredir?',
        correct: '11 metre',
        distractors: ['9 metre', '15 metre', '12 metre'],
        exp: 'Resmi futbol kurallarına göre penaltı atışı kale çizgisinden 11 metre (12 yarda) mesafeden yapılır.',
    },
    {
        q: 'Basketbol maçında bir takımdan sahada aynı anda kaç oyuncu mücadele eder?',
        correct: '5 oyuncu',
        distractors: ['6 oyuncu', '7 oyuncu', '4 oyuncu'],
        exp: 'Basketbolda sahada her iki takımdan 5’er oyuncu yer alır.',
    },
    {
        q: 'Voleybol maçında sahada bir takımdan aynı anda kaç oyuncu yer alır?',
        correct: '6 oyuncu',
        distractors: ['5 oyuncu', '7 oyuncu', '8 oyuncu'],
        exp: 'Voleybol takımları sahada 6 oyuncu ile dizilir ve pozisyon rotasyonu yaparlar.',
    },
    {
        q: "2023 yılında Milletler Ligi ve Avrupa Şampiyonu olan Kadın Voleybol Milli Takımımızın popüler unvanı nedir?",
        correct: 'Filenin Sultanları',
        distractors: ['12 Dev Adam', 'Potanın Perileri', 'Demir Bilekler'],
        exp: 'Türkiye Kadın Voleybol A Milli Takımımız başarılarıyla dünyada 1 numaraya yükselmiştir.',
    },
    {
        q: "Tokyo 2020 Olimpiyatları'nda okçuluk branşında Türkiye'ye tarihindeki ilk altın madalyayı kazandıran milli sporcumuz kimdir?",
        correct: 'Mete Gazoz',
        distractors: ['Rıza Kayaalp', 'Taha Akgül', 'Ferhat Arıcan'],
        exp: 'Mete Gazoz klasik yay bireysel finalinde altın madalya kazanarak tarihi bir başarı elde etmiştir.',
    },
    {
        q: "Olimpiyatlarda üst üste 3 kez altın madalya kazanan ve 'Cep Herkülü' olarak anılan halter efsanemiz kimdir?",
        correct: 'Naim Süleymanoğlu',
        distractors: ['Halil Mutlu', 'Taner Sağır', 'Nurcan Taylan'],
        exp: 'Naim Süleymanoğlu kendi ağırlığının 3 katından fazlasını kaldırarak dünya rekorları kırmıştır.',
    },
];
// EDEBİYAT VE KÜLTÜR
const LITERATURE_TOPICS = [
    {
        q: "Türkiye Cumhuriyeti'nin milli marşı olan İstiklal Marşı'mızın şairi kimdir?",
        correct: 'Mehmet Akif Ersoy',
        distractors: ['Yahya Kemal Beyatlı', 'Tevfik Fikret', 'Ziya Gökalp'],
        exp: 'İstiklal Marşı, Mehmet Akif Ersoy tarafından kaleme alınmış ve 12 Mart 1921’de kabul edilmiştir.',
    },
    {
        q: "'Yaş otuz beş! yolun yarısı eder' mısrasıyla başlayan ünlü 'Yaş 35' şiirinin şairi kimdir?",
        correct: 'Cahit Sıtkı Tarancı',
        distractors: ['Ahmet Hamdi Tanpınar', 'Attila İlhan', 'Orhan Veli Kanık'],
        exp: 'Cahit Sıtkı Tarancı, 1946 yılında bu şiiriyle CHP Şiir Ödülü’nü kazanmıştır.',
    },
    {
        q: "Toros dağlarında Çukurova eşkıyası Memed'in haksızlıklara karşı mücadelesini anlatan 'İnce Memed' romanının yazarı kimdir?",
        correct: 'Yaşar Kemal',
        distractors: ['Orhan Kemal', 'Kemal Tahir', 'Sabahattin Ali'],
        exp: 'Yaşar Kemal’in başyapıtı olan İnce Memed, dünya dillerine çevrilmiş en seçkin Türk romanlarındandır.',
    },
    {
        q: "İdealist öğretmen Feride'nin Anadolu'daki hayatını konu alan 'Çalıkuşu' romanının yazarı kimdir?",
        correct: 'Reşat Nuri Güntekin',
        distractors: ['Halide Edip Adıvar', 'Yakup Kadri Karaosmanoğlu', 'Refik Halit Karay'],
        exp: 'Reşat Nuri Güntekin, Çalıkuşu eseriyle Türk edebiyatında silinmez bir iz bırakmıştır.',
    },
    {
        q: "Raif Efendi ve Maria Puder'in unutulmaz aşkını anlatan 'Kürk Mantolu Madonna' eserinin yazarı kimdir?",
        correct: 'Sabahattin Ali',
        distractors: ['Peyami Safa', 'Oğuz Atay', 'Yusuf Atılgan'],
        exp: 'Sabahattin Ali’nin 1943 yılında yayımlanan romanı Türkiye’de en çok okunan eserler arasındadır.',
    },
    {
        q: "Dünya edebiyatında ilk modern roman kabul edilen 'Don Kişot'un İspanyol yazarı kimdir?",
        correct: 'Miguel de Cervantes',
        distractors: ['William Shakespeare', 'Victor Hugo', 'Dante Alighieri'],
        exp: 'Cervantes, 1605 yılında yayımladığı Don Kişot ile modern roman türünün öncüsü olmuştur.',
    },
    {
        q: "'Küçük Prens' adlı ünlü masalsı romanın Fransız yazarı ve pilotu kimdir?",
        correct: 'Antoine de Saint-Exupéry',
        distractors: ['Jules Verne', 'Albert Camus', 'Jean-Paul Sartre'],
        exp: 'Saint-Exupéry’nin yazdığı Küçük Prens, dünyada en çok çevrilen kitaplardan biridir.',
    },
];
// SANAT VE SİNEMA
const ART_CINEMA_TOPICS = [
    {
        q: "Şanlıurfa'da yer alan ve 'Tarihin Sıfır Noktası' olarak adlandırılan yaklaşık 12.000 yıllık dünyanın en eski anıtsal tapınak alanı hangisidir?",
        correct: 'Göbeklitepe',
        distractors: ['Çatalhöyük', 'Efes Antik Kenti', 'Hattuşaş'],
        exp: 'Göbeklitepe, yerleşik hayata geçiş ve dinler tarihi hakkındaki bilinenleri kökten değiştirmiştir.',
    },
    {
        q: "Ressam Osman Hamdi Bey'in 1906 yılında tamamladığı en ünlü başyapıt tablosu hangisidir?",
        correct: 'Kaplumbağa Terbiyecisi',
        distractors: ['Silah Tacirleri', 'Yeşil Cami Önü', 'Kur’an Okuyan Kız'],
        exp: 'Kaplumbağa Terbiyecisi Türk resim sanatının en değerli ve simgesel tablolarından biridir.',
    },
    {
        q: "Paris Louvre Müzesi'nde sergilenen ünlü 'Mona Lisa' tablosunun İtalyan Rönesans ressamı kimdir?",
        correct: 'Leonardo da Vinci',
        distractors: ['Michelangelo', 'Raffaello', 'Sandro Botticelli'],
        exp: 'Leonardo da Vinci’nin eseri olan Mona Lisa, gizemli gülümsemesiyle dünyanın en bilinen tablosudur.',
    },
    {
        q: "Hababam Sınıfı film serisinde Mahmut Hoca (Kel Mahmut) karakterini canlandıran efsane oyuncumuz kimdir?",
        correct: 'Münir Özkul',
        distractors: ['Kemal Sunal', 'Şener Şen', 'Halit Akçatepe'],
        exp: 'Münir Özkul, Türk sinemasının babacan ve unutulmaz karakter oyuncusudur.',
    },
    {
        q: "Hababam Sınıfı'nda Badi Ekrem, Züğürt Ağa ve Neşeli Günler'de Ziya rollerini oynayan büyük sinema ustamız kimdir?",
        correct: 'Şener Şen',
        distractors: ['İlyas Salman', 'Ayşen Gruda', 'Sadri Alışık'],
        exp: 'Şener Şen, hem komedi hem dram türünde Türk sinemasına damga vurmuş büyük bir sanatçıdır.',
    },
    {
        q: "'Gülpembe', 'Arkadaşım Eşek' ve 'Dönence' şarkılarıyla tanınan, 7'den 70'e sevilen efsane Türk müzisyeni kimdir?",
        correct: 'Barış Manço',
        distractors: ['Cem Karaca', 'Erkin Koray', 'Fikret Kızılok'],
        exp: 'Barış Manço müziği ve televizyon programlarıyla Türk kültürünü dünyaya tanıtan bir kültür elçisidir.',
    },
    {
        q: "'Bozkırın Tezenesi' lakabıyla bilinen büyük Türk halk ozanı ve neşet ustası kimdir?",
        correct: 'Neşet Ertaş',
        distractors: ['Aşık Veysel', 'Mahzuni Şerif', 'Muharrem Ertaş'],
        exp: 'Neşet Ertaş, Kırşehir yöresi bozlakları ve türküleriyle UNESCO Somut Olmayan Kültürel Miras taşıyıcısıdır.',
    },
];
// HAYVANLAR VE DOĞA
const ANIMALS_NATURE_TOPICS = [
    {
        q: 'Karada yaşayan hayvanlar arasında en hızlı koşan memeli hangisidir?',
        correct: 'Çita (saatte 100-120 km)',
        distractors: ['Aslan', 'Antilop', 'At'],
        exp: 'Çita, kısa mesafelerde sıfırdan 100 km/s hıza saniyeler içinde ulaşabilen en hızlı kara canlısıdır.',
    },
    {
        q: 'Dünya üzerinde yaşamış ve günümüzde de yaşayan en büyük hayvan hangisidir?',
        correct: 'Mavi Balina (Gök Balina)',
        distractors: ['Afrika Fili', 'Balina Köpekbalığı', 'Dev Kalamar'],
        exp: 'Mavi balinaların boyu 30 metreyi, ağırlıkları ise 150 tonu aşabilir.',
    },
    {
        q: 'Kanatları olmasına rağmen uçamayan, ancak buzlu sularda mükemmel yüzen kutup kuşu hangisidir?',
        correct: 'Penguen',
        distractors: ['Martı', 'Albatros', 'Karabatak'],
        exp: 'Penguenlerin kanatları suda kürek görevi görecek şekilde evrimleşmiştir.',
    },
    {
        q: "Bir gözü mavi diğeri kehribar rengi olabilen, ipeksi beyaz kürküyle ünlü Türkiye'ye özgü kedi ırkı hangisidir?",
        correct: 'Van Kedisi',
        distractors: ['Ankara Kedisi', 'Tekir', 'Siyam Kedisi'],
        exp: 'Van Kedisi, heterokromi (farklı göz rengi) özelliği ve suyu sevmesiyle dünyaca ünlüdür.',
    },
];
// MATEMATİK VE MANTIK
function generateProceduralMath() {
    const type = Math.floor(Math.random() * 3);
    if (type === 0) {
        const a = Math.floor(10 + Math.random() * 20);
        const b = Math.floor(3 + Math.random() * 8);
        const c = Math.floor(5 + Math.random() * 20);
        const ans = a * b - c;
        const choices = shuffle([String(ans), String(ans + 5), String(ans - 3), String(ans + 12)]);
        return {
            text: `İşlemin sonucu kaçtır: (${a} × ${b}) - ${c} = ?`,
            subCategory: 'Matematik (Temel İşlemler)',
            options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
            correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(String(ans)))}`,
            explanation: `Önce çarpma yapılır: ${a} × ${b} = ${a * b}. Ardından çıkarma: ${a * b} - ${c} = ${ans}.`,
            sourceOrVerification: 'Temel Aritmetik',
        };
    }
    else if (type === 1) {
        const start = Math.floor(4 + Math.random() * 8);
        const step = Math.floor(3 + Math.random() * 6);
        const seq = [start, start + step, start + 2 * step, start + 3 * step];
        const next = start + 4 * step;
        const choices = shuffle([String(next), String(next + step), String(next - 2), String(next + 3)]);
        return {
            text: `Sayı dizisinde '?' yerine hangi sayı gelmelidir: ${seq.join(', ')}, ?`,
            subCategory: 'Mantık ve Sayı Dizileri',
            options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
            correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(String(next)))}`,
            explanation: `Dizideki her sayı bir öncekinden ${step} fazladır. ${seq[3]} + ${step} = ${next}.`,
            sourceOrVerification: 'Analitik Akıl Yürütme',
        };
    }
    else {
        const edges = [
            { name: 'Üçgen', sum: '180°' },
            { name: 'Dörtgen (Kare / Dikdörtgen)', sum: '360°' },
            { name: 'Beşgen', sum: '540°' },
            { name: 'Altıgen', sum: '720°' },
        ];
        const chosen = edges[Math.floor(Math.random() * edges.length)];
        const others = edges.filter((e) => e.name !== chosen.name);
        const choices = shuffle([chosen.sum, others[0].sum, others[1].sum, others[2].sum]);
        return {
            text: `${chosen.name}in iç açıları ölçüleri toplamı kaç derecedir?`,
            subCategory: 'Geometri (Açılar)',
            options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
            correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(chosen.sum))}`,
            explanation: `Geometride ${chosen.name}in iç açıları toplamı ${chosen.sum}'dir.`,
            sourceOrVerification: 'Öklid Geometrisi',
        };
    }
}
// ============================================================================
// 3. JENERATÖR FONKSİYONLARI (GENERATORS)
// ============================================================================
// Coğrafya Jeneratörleri (Çok çeşitli)
function genMountainQuestion() {
    const m = GEOGRAPHY_MOUNTAINS[Math.floor(Math.random() * GEOGRAPHY_MOUNTAINS.length)];
    const choices = shuffle([m.name, ...m.distractors]);
    return {
        text: `${m.feature} aşağıdakilerden hangisidir?`,
        subCategory: 'Coğrafya (Dağlar ve Zirveler)',
        options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
        correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(m.name))}`,
        explanation: `${m.name}: ${m.detail}`,
        sourceOrVerification: 'Harita Genel Müdürlüğü',
    };
}
function genLakeQuestion() {
    const l = GEOGRAPHY_LAKES[Math.floor(Math.random() * GEOGRAPHY_LAKES.length)];
    const choices = shuffle([l.name, ...l.distractors]);
    return {
        text: `${l.feature} hangisidir?`,
        subCategory: 'Coğrafya (Göller ve Sulak Alanlar)',
        options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
        correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(l.name))}`,
        explanation: `${l.name}: ${l.detail}`,
        sourceOrVerification: 'Devlet Su İşleri (DSİ)',
    };
}
function genRiverQuestion() {
    const r = GEOGRAPHY_RIVERS[Math.floor(Math.random() * GEOGRAPHY_RIVERS.length)];
    const choices = shuffle([r.name, ...r.distractors]);
    return {
        text: `${r.feature} hangisidir?`,
        subCategory: 'Coğrafya (Nehirler ve Akarsular)',
        options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
        correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(r.name))}`,
        explanation: `${r.name}: ${r.detail}`,
        sourceOrVerification: 'Devlet Su İşleri (DSİ)',
    };
}
function genSeaStraitQuestion() {
    const s = GEOGRAPHY_SEAS_STRAITS[Math.floor(Math.random() * GEOGRAPHY_SEAS_STRAITS.length)];
    const choices = shuffle([s.name, ...s.distractors]);
    return {
        text: `${s.feature} hangisidir?`,
        subCategory: 'Coğrafya (Denizler ve Boğazlar)',
        options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
        correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(s.name))}`,
        explanation: `${s.name}: ${s.detail}`,
        sourceOrVerification: 'Seyir, Hidrografi ve Oşinografi Dairesi',
    };
}
function genWonderQuestion() {
    const w = GEOGRAPHY_WONDERS[Math.floor(Math.random() * GEOGRAPHY_WONDERS.length)];
    const choices = shuffle([w.city, ...w.distractors]);
    return {
        text: `${w.feature} hangi ilimizde / bölgemizde bulunmaktadır?`,
        subCategory: 'Coğrafya (Doğa Harikaları)',
        options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
        correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(w.city))}`,
        explanation: `${w.name}, ${w.city} sınırlarında yer alır. ${w.detail}`,
        sourceOrVerification: 'Kültür ve Turizm Bakanlığı',
    };
}
function genRegionBorderQuestion() {
    const b = GEOGRAPHY_REGIONS[Math.floor(Math.random() * GEOGRAPHY_REGIONS.length)];
    const choices = shuffle([b.correct, ...b.distractors]);
    return {
        text: b.q,
        subCategory: 'Coğrafya (Sınırlar ve Bölgeler)',
        options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
        correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(b.correct))}`,
        explanation: b.exp,
        sourceOrVerification: 'Milli Savunma Bakanlığı ve Harita GM',
    };
}
function genContinentQuestion() {
    const c = GEOGRAPHY_CONTINENTS[Math.floor(Math.random() * GEOGRAPHY_CONTINENTS.length)];
    const choices = shuffle([c.correct, ...c.distractors]);
    return {
        text: c.q,
        subCategory: 'Coğrafya (Kıtalar ve İklim)',
        options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
        correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(c.correct))}`,
        explanation: c.exp,
        sourceOrVerification: 'Dünya Coğrafya Ansiklopedisi',
    };
}
// Nadir Başkent Sorusu (Sadece ara sıra)
function genCapitalQuestion() {
    const c = WORLD_CAPITALS[Math.floor(Math.random() * WORLD_CAPITALS.length)];
    const others = shuffle(WORLD_CAPITALS.filter((x) => x.capital !== c.capital)).slice(0, 3);
    const choices = shuffle([c.capital, others[0].capital, others[1].capital, others[2].capital]);
    return {
        text: `${c.country} ülkesinin başkenti neresidir?`,
        subCategory: 'Coğrafya (Başkentler)',
        options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
        correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(c.capital))}`,
        explanation: `${c.country} ülkesinin başkenti ${c.capital}'dir.`,
        sourceOrVerification: 'Birleşmiş Milletler Ülkeler Rehberi',
    };
}
// Nadir Plaka Sorusu (Sadece ara sıra)
function genPlateQuestion() {
    const city = TURKISH_CITIES[Math.floor(Math.random() * TURKISH_CITIES.length)];
    const others = shuffle(TURKISH_CITIES.filter((x) => x.plate !== city.plate)).slice(0, 3);
    const choices = shuffle([city.plate, others[0].plate, others[1].plate, others[2].plate]);
    return {
        text: `${city.name} ilimizin resmi araç plaka kodu kaçtır?`,
        subCategory: 'Coğrafya (İl Plakaları)',
        options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
        correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(city.plate))}`,
        explanation: `${city.name} ilimizin plaka kodu ${city.plate}'dir.`,
        sourceOrVerification: 'Emniyet Genel Müdürlüğü',
    };
}
// Genel Topic Helper
function makeCandidateFromTopic(topic, subCat) {
    const choices = shuffle([topic.correct, ...topic.distractors]);
    return {
        text: topic.q,
        subCategory: subCat,
        options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
        correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(topic.correct))}`,
        explanation: topic.exp,
        sourceOrVerification: 'Resmi Genel Kültür Kaynağı',
    };
}
function genHistoryQuestion() {
    const t = HISTORY_TOPICS[Math.floor(Math.random() * HISTORY_TOPICS.length)];
    return makeCandidateFromTopic(t, 'Tarih');
}
function genScienceQuestion() {
    const t = SCIENCE_TECH_TOPICS[Math.floor(Math.random() * SCIENCE_TECH_TOPICS.length)];
    return makeCandidateFromTopic(t, 'Bilim & Teknoloji');
}
function genSportsQuestion() {
    const t = SPORTS_TOPICS[Math.floor(Math.random() * SPORTS_TOPICS.length)];
    return makeCandidateFromTopic(t, 'Spor & Rekorlar');
}
function genLiteratureQuestion() {
    const t = LITERATURE_TOPICS[Math.floor(Math.random() * LITERATURE_TOPICS.length)];
    return makeCandidateFromTopic(t, 'Edebiyat');
}
function genArtCinemaQuestion() {
    const t = ART_CINEMA_TOPICS[Math.floor(Math.random() * ART_CINEMA_TOPICS.length)];
    return makeCandidateFromTopic(t, 'Sanat & Kültür');
}
function genAnimalNatureQuestion() {
    const t = ANIMALS_NATURE_TOPICS[Math.floor(Math.random() * ANIMALS_NATURE_TOPICS.length)];
    return makeCandidateFromTopic(t, 'Doğa & Canlılar');
}
function genFoodQuestion() {
    const city = TURKISH_CITIES[Math.floor(Math.random() * TURKISH_CITIES.length)];
    const others = shuffle(TURKISH_CITIES.filter((x) => x.name !== city.name)).slice(0, 3);
    const choices = shuffle([city.name, others[0].name, others[1].name, others[2].name]);
    return {
        text: `'${city.food}' lezzetiyle meşhur olan şehrimiz hangisidir?`,
        subCategory: 'Gastronomi & Mutfak',
        options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
        correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(city.name))}`,
        explanation: `${city.food}, ${city.name} ilimizin tescilli ve geleneksel lezzetidir.`,
        sourceOrVerification: 'Türk Patent ve Marka Kurumu Coğrafi İşaretler',
    };
}
// ============================================================================
// 4. MASTER PROCEDURAL GENERATOR (ÇOK ÇEŞİTLİ & SIFIR TEKRAR)
// ============================================================================
function generateGuaranteedUniqueCandidates(categoryId, difficulty, count, existingDbSignatures) {
    const results = [];
    const currentBatchSigs = new Set();
    // Determine category generator pool
    const generatorPool = [];
    if (categoryId === 'geography') {
        // Coğrafyada dağlar, göller, nehirler, denizler, doğa harikaları, sınırlar ve kıtalar AĞIRLIKLIDIR (%85).
        // Başkent ve plaka sadece nadiren (%15) gelebilir.
        generatorPool.push(genMountainQuestion, genLakeQuestion, genRiverQuestion, genSeaStraitQuestion, genWonderQuestion, genRegionBorderQuestion, genContinentQuestion, genMountainQuestion, genLakeQuestion, genRiverQuestion, genWonderQuestion, genCapitalQuestion, genPlateQuestion);
    }
    else if (categoryId === 'history') {
        generatorPool.push(genHistoryQuestion, genHistoryQuestion, genArtCinemaQuestion);
    }
    else if (categoryId === 'science_tech' || categoryId === 'physics_chemistry' || categoryId === 'biology') {
        generatorPool.push(genScienceQuestion, genScienceQuestion, genAnimalNatureQuestion);
    }
    else if (categoryId === 'sports') {
        generatorPool.push(genSportsQuestion, genSportsQuestion);
    }
    else if (categoryId === 'literature') {
        generatorPool.push(genLiteratureQuestion, genLiteratureQuestion, genHistoryQuestion);
    }
    else if (categoryId === 'cinema_tv' || categoryId === 'music' || categoryId === 'art_culture') {
        generatorPool.push(genArtCinemaQuestion, genArtCinemaQuestion, genLiteratureQuestion);
    }
    else if (categoryId === 'animals_wildlife' || categoryId === 'nature_ecology') {
        generatorPool.push(genAnimalNatureQuestion, genAnimalNatureQuestion, genScienceQuestion);
    }
    else if (categoryId === 'food_gastronomy') {
        generatorPool.push(genFoodQuestion, genFoodQuestion);
    }
    else if (categoryId === 'mathematics' || categoryId === 'logic_puzzles') {
        generatorPool.push(generateProceduralMath, generateProceduralMath);
    }
    else {
        // Genel Kültür / Karışık - Tüm zengin havuzdan dengeli dağılım
        generatorPool.push(genMountainQuestion, genLakeQuestion, genRiverQuestion, genSeaStraitQuestion, genWonderQuestion, genRegionBorderQuestion, genHistoryQuestion, genScienceQuestion, genSportsQuestion, genLiteratureQuestion, genArtCinemaQuestion, genAnimalNatureQuestion, genFoodQuestion, generateProceduralMath, genContinentQuestion);
    }
    let safetyAttempts = 0;
    while (results.length < count && safetyAttempts < 250) {
        safetyAttempts++;
        const genFunc = generatorPool[Math.floor(Math.random() * generatorPool.length)];
        const candidate = genFunc();
        const sig = normalizeSig(candidate.text);
        // Ensure it was NOT generated in current batch AND not already in DB
        if (!currentBatchSigs.has(sig) && !existingDbSignatures.has(sig)) {
            currentBatchSigs.add(sig);
            results.push(candidate);
        }
    }
    return results;
}
