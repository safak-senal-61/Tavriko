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
// ---------------------------------------------------------------------------
// 1. DATA ENTITIES FOR HIGH-VARIETY PROCEDURAL GENERATION
// ---------------------------------------------------------------------------
// 81 Turkish Cities & Plate Numbers
const TURKISH_CITIES = [
    { plate: '01', name: 'Adana', region: 'Akdeniz', food: 'Adana Kebabı' },
    { plate: '02', name: 'Adıyaman', region: 'Güneydoğu Anadolu', food: 'Çiğ Köfte' },
    { plate: '03', name: 'Afyonkarahisar', region: 'Ege', food: 'Afyon Kaymağı ve Sucuğu' },
    { plate: '04', name: 'Ağrı', region: 'Doğu Anadolu', food: 'Abdigör Köftesi' },
    { plate: '05', name: 'Amasya', region: 'Karadeniz', food: 'Amasya Elması' },
    { plate: '06', name: 'Ankara', region: 'İç Anadolu', food: 'Ankara Tavası' },
    { plate: '07', name: 'Antalya', region: 'Akdeniz', food: 'Piyaz ve Turunç Reçeli' },
    { plate: '08', name: 'Artvin', region: 'Karadeniz', food: 'Laz Böreği' },
    { plate: '09', name: 'Aydın', region: 'Ege', food: 'Kuru İncir' },
    { plate: '10', name: 'Balıkesir', region: 'Marmara', food: 'Höşmerim Tatlısı' },
    { plate: '14', name: 'Bolu', region: 'Karadeniz', food: 'Mengen Yemekleri' },
    { plate: '16', name: 'Bursa', region: 'Marmara', food: 'İskender Kebap ve Kestane Şekeri' },
    { plate: '17', name: 'Çanakkale', region: 'Marmara', food: 'Peynir Helvası' },
    { plate: '20', name: 'Denizli', region: 'Ege', food: 'Denizli Kebabı ve Pamukkale' },
    { plate: '21', name: 'Diyarbakır', region: 'Güneydoğu Anadolu', food: 'Diyarbakır Karpuzu ve Ciğer' },
    { plate: '22', name: 'Edirne', region: 'Marmara', food: 'Edirne Tava Ciğeri' },
    { plate: '25', name: 'Erzurum', region: 'Doğu Anadolu', food: 'Cağ Kebabı ve Kadayıf Dolması' },
    { plate: '26', name: 'Eskişehir', region: 'İç Anadolu', food: 'Çibörek ve Balaban Köfte' },
    { plate: '27', name: 'Gaziantep', region: 'Güneydoğu Anadolu', food: 'Antep Baklavası ve Beyran' },
    { plate: '31', name: 'Hatay', region: 'Akdeniz', food: 'Künefe ve Tepsi Kebabı' },
    { plate: '34', name: 'İstanbul', region: 'Marmara', food: 'Sultanahmet Köftesi' },
    { plate: '35', name: 'İzmir', region: 'Ege', food: 'Boyoz, Gevrek ve Kumru' },
    { plate: '38', name: 'Kayseri', region: 'İç Anadolu', food: 'Kayseri Mantısı ve Pastırması' },
    { plate: '41', name: 'Kocaeli', region: 'Marmara', food: 'Pişmaniye' },
    { plate: '42', name: 'Konya', region: 'İç Anadolu', food: 'Etli Ekmek ve Fırın Kebabı' },
    { plate: '44', name: 'Malatya', region: 'Doğu Anadolu', food: 'Malatya Kayısısı' },
    { plate: '45', name: 'Manisa', region: 'Ege', food: 'Mesir Macunu' },
    { plate: '46', name: 'Kahramanmaraş', region: 'Akdeniz', food: 'Maraş Dondurması' },
    { plate: '48', name: 'Muğla', region: 'Ege', food: 'Çökertme Kebabı' },
    { plate: '50', name: 'Nevşehir', region: 'İç Anadolu', food: 'Testi Kebabı ve Peri Bacaları' },
    { plate: '52', name: 'Ordu', region: 'Karadeniz', food: 'Ordu Fındığı' },
    { plate: '53', name: 'Rize', region: 'Karadeniz', food: 'Rize Çayı ve Muhlama' },
    { plate: '55', name: 'Samsun', region: 'Karadeniz', food: 'Bafra ve Terme Pidesi' },
    { plate: '58', name: 'Sivas', region: 'İç Anadolu', food: 'Sivas Köftesi' },
    { plate: '60', name: 'Tokat', region: 'Karadeniz', food: 'Tokat Kebabı ve Yaprağı' },
    { plate: '61', name: 'Trabzon', region: 'Karadeniz', food: 'Akçaabat Köftesi ve Kuymak' },
    { plate: '63', name: 'Şanlıurfa', region: 'Güneydoğu Anadolu', food: 'Urfa Kebabı ve Lahmacun' },
    { plate: '65', name: 'Van', region: 'Doğu Anadolu', food: 'Van Otlu Peyniri ve Kahvaltısı' },
    { plate: '67', name: 'Zonguldak', region: 'Karadeniz', food: 'Karaelmas Taş Kömürü' },
];
// World Capitals
const WORLD_CAPITALS = [
    { country: 'Fransa', capital: 'Paris', continent: 'Avrupa' },
    { country: 'İtalya', capital: 'Roma', continent: 'Avrupa' },
    { country: 'Almanya', capital: 'Berlin', continent: 'Avrupa' },
    { country: 'İspanya', capital: 'Madrid', continent: 'Avrupa' },
    { country: 'Portekiz', capital: 'Lizbon', continent: 'Avrupa' },
    { country: 'İngiltere (Birleşik Krallık)', capital: 'Londra', continent: 'Avrupa' },
    { country: 'Japonya', capital: 'Tokyo', continent: 'Asya' },
    { country: 'Güney Kore', capital: 'Seul', continent: 'Asya' },
    { country: 'Çin', capital: 'Pekin', continent: 'Asya' },
    { country: 'Avustralya', capital: 'Canberra', continent: 'Okyanusya' },
    { country: 'Kanada', capital: 'Ottawa', continent: 'Kuzey Amerika' },
    { country: 'Brezilya', capital: 'Brasilia', continent: 'Güney Amerika' },
    { country: 'Arjantin', capital: 'Buenos Aires', continent: 'Güney Amerika' },
    { country: 'Mısır', capital: 'Kahire', continent: 'Afrika' },
    { country: 'Yunanistan', capital: 'Atina', continent: 'Avrupa' },
    { country: 'Hollanda', capital: 'Amsterdam', continent: 'Avrupa' },
    { country: 'Norveç', capital: 'Oslo', continent: 'Avrupa' },
    { country: 'İsveç', capital: 'Stockholm', continent: 'Avrupa' },
    { country: 'Finlandiya', capital: 'Helsinki', continent: 'Avrupa' },
    { country: 'Polonya', capital: 'Varşova', continent: 'Avrupa' },
    { country: 'İsviçre', capital: 'Bern', continent: 'Avrupa' },
    { country: 'Avusturya', capital: 'Viyana', continent: 'Avrupa' },
    { country: 'Azerbaycan', capital: 'Bakü', continent: 'Asya' },
    { country: 'Özbekistan', capital: 'Taşkent', continent: 'Asya' },
    { country: 'Kazakistan', capital: 'Astana', continent: 'Asya' },
    { country: 'Meksika', capital: 'Mexico City', continent: 'Kuzey Amerika' },
    { country: 'Hindistan', capital: 'Yeni Delhi', continent: 'Asya' },
];
// Chemical Elements
const ELEMENTS = [
    { symbol: 'Au', name: 'Altın', atomicNumber: 79, note: "Latince 'Aurum' kökenlidir." },
    { symbol: 'Ag', name: 'Gümüş', atomicNumber: 47, note: "Latince 'Argentum' kökenlidir." },
    { symbol: 'Fe', name: 'Demir', atomicNumber: 26, note: "Latince 'Ferrum' kökenlidir." },
    { symbol: 'Cu', name: 'Bakır', atomicNumber: 29, note: "Latince 'Cuprum' kökenlidir." },
    { symbol: 'Hg', name: 'Cıva', atomicNumber: 80, note: 'Oda sıcaklığında sıvı olan tek metal elementtir.' },
    { symbol: 'O', name: 'Oksijen', atomicNumber: 8, note: 'Atmosferin yaklaşık %21’ini oluşturur.' },
    { symbol: 'N', name: 'Azot (Nitrojen)', atomicNumber: 7, note: 'Atmosfer havasının yaklaşık %78’ini oluşturur.' },
    { symbol: 'H', name: 'Hidrojen', atomicNumber: 1, note: 'Evrende en çok bulunan en hafif elementtir.' },
    { symbol: 'He', name: 'Helyum', atomicNumber: 2, note: 'Soygazlar grubunda yer alan ikinci en hafif elementtir.' },
    { symbol: 'C', name: 'Karbon', atomicNumber: 6, note: 'Organik yaşamın temel yapı taşı olan elementtir.' },
    { symbol: 'Na', name: 'Sodyum', atomicNumber: 11, note: 'Sofra tuzunun (NaCl) bileşenlerinden biridir.' },
    { symbol: 'K', name: 'Potasyum', atomicNumber: 19, note: 'Hücre içi sıvı dengesinde kritik bir alkali metaldir.' },
    { symbol: 'Pb', name: 'Kurşun', atomicNumber: 82, note: "Radyasyona karşı kalkan olarak kullanılan ağır metaldir (Latince 'Plumbum')." },
];
// Famous Turkish & World Inventions
const INVENTIONS = [
    { invention: 'Telefon', inventor: 'Alexander Graham Bell', year: '1876' },
    { invention: 'Matbaa (Hareketli Harflerle)', inventor: 'Johannes Gutenberg', year: '1440' },
    { invention: 'Ampul (Ticari)', inventor: 'Thomas Edison', year: '1879' },
    { invention: 'Kuduz Aşısı', inventor: 'Louis Pasteur', year: '1885' },
    { invention: 'Penisilin (İlk Antibiyotik)', inventor: 'Alexander Fleming', year: '1928' },
    { invention: 'Yerçekimi Kanunu', inventor: 'Isaac Newton', year: '1687' },
    { invention: 'Genel Görelilik Teorisi', inventor: 'Albert Einstein', year: '1915' },
    { invention: 'Teleskop ile İlk Gökyüzü Gözlemi', inventor: 'Galileo Galilei', year: '1609' },
    { invention: 'Modern Bilgisayarın Mantıksal Temelleri', inventor: 'Alan Turing', year: '1936' },
    { invention: 'Dünya Çapında Ağ (WWW / Web)', inventor: 'Tim Berners-Lee', year: '1989' },
    { invention: 'Röntgen Cihazı (X Işınları)', inventor: 'Wilhelm Röntgen', year: '1895' },
];
// Historical Battles & Treaties
const HISTORICAL_EVENTS = [
    { event: 'Malazgirt Meydan Muharebesi', year: '1071', leader: 'Sultan Alparslan', note: "Anadolu'nun kapılarını Türklere açan zaferdir." },
    { event: "İstanbul'un Fethi", year: '1453', leader: 'Fatih Sultan Mehmet', note: 'Orta Çağ’ı kapatıp Yeni Çağ’ı başlatan tarihi olaydır.' },
    { event: 'Mohaç Meydan Muharebesi', year: '1526', leader: 'Kanuni Sultan Süleyman', note: 'Tarihin en kısa süren (yaklaşık 2 saat) meydan muharebelerinden biridir.' },
    { event: 'Çanakkale Deniz Zaferi', year: '18 Mart 1915', leader: 'Cevat Çobanlı ve Mustafa Kemal', note: "İtilaf donanmasının boğazı geçemediği destansı zaferdir." },
    { event: 'Büyük Taarruz ve Başkomutanlık Meydan Muharebesi', year: '1922', leader: 'Mustafa Kemal Atatürk', note: "Kurtuluş Savaşı'nı kesin zaferle taçlandıran 30 Ağustos zaferidir." },
    { event: "Lozan Barış Antlaşması", year: '1923', leader: 'İsmet İnönü', note: "Türkiye Cumhuriyeti'nin uluslararası bağımsızlık senedidir." },
    { event: 'TBMM’nin Açılışı', year: '23 Nisan 1920', leader: 'Mustafa Kemal Atatürk', note: 'Milli iradenin temsil edildiği ilk meclisin açılış tarihidir.' },
    { event: "Cumhuriyet'in İlanı", year: '29 Ekim 1923', leader: 'Mustafa Kemal Atatürk', note: "Türkiye Devleti'nin yönetim şeklinin Cumhuriyet olarak tescil edildiği gündür." },
];
// Literature Classics (Turkish & World)
const LITERATURE_BOOKS = [
    { book: 'Kürk Mantolu Madonna', author: 'Sabahattin Ali', char: 'Raif Efendi ve Maria Puder' },
    { book: 'İnce Memed', author: 'Yaşar Kemal', char: 'Toros Dağları ve Çukurova eşkıyası Memed' },
    { book: 'Çalıkuşu', author: 'Reşat Nuri Güntekin', char: 'İdealist öğretmen Feride' },
    { book: 'Saatleri Ayarlama Enstitüsü', author: 'Ahmet Hamdi Tanpınar', char: 'Hayri İrdal ve Halit Ayarcı' },
    { book: 'Tutunamayanlar', author: 'Oğuz Atay', char: 'Selim Işık ve Turgut Özben' },
    { book: 'Yaban', author: 'Yakup Kadri Karaosmanoğlu', char: 'Kurtuluş Savaşı yıllarında Ahmet Celal' },
    { book: 'Sefiller', author: 'Victor Hugo', char: 'Jean Valjean ve Dedektif Javert' },
    { book: 'Suç ve Ceza', author: 'Fyodor Dostoyevski', char: 'Raskolnikov' },
    { book: '1984', author: 'George Orwell', char: 'Büyük Birader ve Winston Smith' },
    { book: 'Küçük Prens', author: 'Antoine de Saint-Exupéry', char: 'B612 gezegeninden gelen çocuk ve gül' },
    { book: 'Simyacı', author: 'Paulo Coelho', char: 'Endülüslü çoban Santiago' },
    { book: 'Dönüşüm', author: 'Franz Kafka', char: 'Bir sabah böceğe dönüşen Gregor Samsa' },
];
// Sports Legends & Facts
const SPORTS_FACTS = [
    {
        text: "Olimpiyatlarda üç kez üst üste altın madalya kazanarak 'Cep Herkülü' unvanını alan efsane Türk halterci kimdir?",
        correct: 'Naim Süleymanoğlu',
        distractors: ['Halil Mutlu', 'Taner Sağır', 'Hasan Güngör'],
        exp: 'Naim Süleymanoğlu 1988, 1992 ve 1996 Olimpiyatlarında altın madalya kazanarak dünya spor tarihine geçmiştir.',
        src: 'Türkiye Milli Olimpiyat Komitesi',
    },
    {
        text: 'Tokyo 2020 Olimpiyatları’nda okçuluk branşında Türkiye’ye tarihindeki ilk altın madalyayı kazandıran sporcumuz kimdir?',
        correct: 'Mete Gazoz',
        distractors: ['Rıza Kayaalp', 'Taha Akgül', 'Ferhat Arıcan'],
        exp: 'Mete Gazoz bireysel klasik yay okçuluk finalinde altın madalya kazanmıştır.',
        src: 'Gençlik ve Spor Bakanlığı',
    },
    {
        text: 'Resmi bir maraton koşusunun standart mesafesi yaklaşık ne kadardır?',
        correct: '42 kilometre 195 metre',
        distractors: ['35 kilometre', '50 kilometre', '21 kilometre 97 metre'],
        exp: 'Standart maraton mesafesi 1908 Londra Olimpiyatları’ndan bu yana 42.195 km olarak uygulanır.',
        src: 'Dünya Atletizm Federasyonu (World Athletics)',
    },
    {
        text: 'Standart bir basketbol maçında sahada aynı anda bir takımdan kaç oyuncu yer alır?',
        correct: '5 oyuncu',
        distractors: ['6 oyuncu', '7 oyuncu', '4 oyuncu'],
        exp: 'Basketbolda iki takım da sahada 5’er oyuncuyla mücadele eder.',
        src: 'FIBA Resmi Oyun Kuralları',
    },
    {
        text: 'Futbolda Dünya Kupası’nı en çok kazanan ülke hangisidir?',
        correct: 'Brezilya (5 Kez)',
        distractors: ['Almanya (4 Kez)', 'İtalya (4 Kez)', 'Arjantin (3 Kez)'],
        exp: 'Brezilya 1958, 1962, 1970, 1994 ve 2002 yıllarında toplam 5 kez Dünya Kupası şampiyonu olmuştur.',
        src: 'FIFA Dünya Kupası Arşivi',
    },
];
// ---------------------------------------------------------------------------
// 2. PROCEDURAL QUESTION GENERATORS
// ---------------------------------------------------------------------------
function generatePlateQuestion() {
    const chosenCity = TURKISH_CITIES[Math.floor(Math.random() * TURKISH_CITIES.length)];
    const otherCities = shuffle(TURKISH_CITIES.filter((c) => c.name !== chosenCity.name)).slice(0, 3);
    const isAskingPlate = Math.random() > 0.5;
    if (isAskingPlate) {
        const choices = shuffle([chosenCity.plate, otherCities[0].plate, otherCities[1].plate, otherCities[2].plate]);
        return {
            text: `${chosenCity.name} ilimizin resmi araç plaka kodu kaçtır?`,
            subCategory: 'Coğrafya (İl Plakaları)',
            options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
            correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(chosenCity.plate))}`,
            explanation: `${chosenCity.name} ilinin plaka kodu ${chosenCity.plate}'dir.`,
            sourceOrVerification: 'Emniyet Genel Müdürlüğü Trafik Tescil',
        };
    }
    else {
        const choices = shuffle([chosenCity.name, otherCities[0].name, otherCities[1].name, otherCities[2].name]);
        return {
            text: `${chosenCity.plate} plaka koduna sahip ilimiz hangisidir?`,
            subCategory: 'Coğrafya (İl Plakaları)',
            options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
            correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(chosenCity.name))}`,
            explanation: `${chosenCity.plate} numaralı plaka kodu ${chosenCity.name} ilimize aittir.`,
            sourceOrVerification: 'Emniyet Genel Müdürlüğü Trafik Tescil',
        };
    }
}
function generateCapitalQuestion() {
    const chosen = WORLD_CAPITALS[Math.floor(Math.random() * WORLD_CAPITALS.length)];
    const others = shuffle(WORLD_CAPITALS.filter((c) => c.country !== chosen.country)).slice(0, 3);
    const isAskingCapital = Math.random() > 0.4;
    if (isAskingCapital) {
        const choices = shuffle([chosen.capital, others[0].capital, others[1].capital, others[2].capital]);
        return {
            text: `${chosen.country} ülkesinin başkenti neresidir?`,
            subCategory: 'Coğrafya (Dünya Başkentleri)',
            options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
            correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(chosen.capital))}`,
            explanation: `${chosen.country} ülkesinin resmi başkenti ${chosen.capital} kentidir (${chosen.continent} kıtası).`,
            sourceOrVerification: 'Birleşmiş Milletler Ülkeler Coğrafya Rehberi',
        };
    }
    else {
        const choices = shuffle([chosen.country, others[0].country, others[1].country, others[2].country]);
        return {
            text: `${chosen.capital} hangi ülkenin başkentidir?`,
            subCategory: 'Coğrafya (Dünya Başkentleri)',
            options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
            correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(chosen.country))}`,
            explanation: `${chosen.capital}, ${chosen.country} devletinin başkentidir.`,
            sourceOrVerification: 'Birleşmiş Milletler Ülkeler Coğrafya Rehberi',
        };
    }
}
function generateElementQuestion() {
    const chosen = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
    const others = shuffle(ELEMENTS.filter((e) => e.symbol !== chosen.symbol)).slice(0, 3);
    const askSymbol = Math.random() > 0.5;
    if (askSymbol) {
        const choices = shuffle([chosen.symbol, others[0].symbol, others[1].symbol, others[2].symbol]);
        return {
            text: `Periyodik tabloda '${chosen.name}' elementinin kimyasal sembolü hangisidir?`,
            subCategory: 'Kimya (Elementler)',
            options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
            correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(chosen.symbol))}`,
            explanation: `${chosen.name} elementinin sembolü '${chosen.symbol}'dir. Atom numarası ${chosen.atomicNumber}'dir. ${chosen.note}`,
            sourceOrVerification: 'IUPAC Periyodik Tablosu',
        };
    }
    else {
        const choices = shuffle([chosen.name, others[0].name, others[1].name, others[2].name]);
        return {
            text: `Kimyasal sembolü '${chosen.symbol}' olan element hangisidir?`,
            subCategory: 'Kimya (Elementler)',
            options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
            correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(chosen.name))}`,
            explanation: `'${chosen.symbol}' sembolü ${chosen.name} elementine aittir. ${chosen.note}`,
            sourceOrVerification: 'IUPAC Periyodik Tablosu',
        };
    }
}
function generateInventionQuestion() {
    const chosen = INVENTIONS[Math.floor(Math.random() * INVENTIONS.length)];
    const others = shuffle(INVENTIONS.filter((i) => i.invention !== chosen.invention)).slice(0, 3);
    const choices = shuffle([chosen.inventor, others[0].inventor, others[1].inventor, others[2].inventor]);
    return {
        text: `'${chosen.invention}' kimin tarafından icat edilmiş veya geliştirilmiştir?`,
        subCategory: 'Bilim ve Teknoloji (İcatlar)',
        options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
        correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(chosen.inventor))}`,
        explanation: `${chosen.invention}, ${chosen.inventor} tarafından tarihe kazandırılmıştır (${chosen.year}).`,
        sourceOrVerification: 'Bilim Tarihi Ansiklopedisi',
    };
}
function generateHistoryQuestion() {
    const chosen = HISTORICAL_EVENTS[Math.floor(Math.random() * HISTORICAL_EVENTS.length)];
    const others = shuffle(HISTORICAL_EVENTS.filter((e) => e.event !== chosen.event)).slice(0, 3);
    const isAskingYear = Math.random() > 0.5;
    if (isAskingYear) {
        const choices = shuffle([chosen.year, others[0].year, others[1].year, others[2].year]);
        return {
            text: `${chosen.event} hangi yılda gerçekleşmiştir?`,
            subCategory: 'Tarih (Dönüm Noktaları)',
            options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
            correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(chosen.year))}`,
            explanation: `${chosen.event} ${chosen.year} yılında gerçekleşmiştir. ${chosen.note}`,
            sourceOrVerification: 'Türk Tarih Kurumu Arşivi',
        };
    }
    else {
        const choices = shuffle([chosen.event, others[0].event, others[1].event, others[2].event]);
        return {
            text: `${chosen.note.replace('zaferdir.', 'tarihi zafer hangisidir?').replace('olaydır.', 'tarihi olay hangisidir?')}`,
            subCategory: 'Tarih (Dönüm Noktaları)',
            options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
            correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(chosen.event))}`,
            explanation: `Doğru cevap ${chosen.event}'dir (${chosen.year}). Komutan/Lider: ${chosen.leader}.`,
            sourceOrVerification: 'Türk Tarih Kurumu Arşivi',
        };
    }
}
function generateLiteratureQuestion() {
    const chosen = LITERATURE_BOOKS[Math.floor(Math.random() * LITERATURE_BOOKS.length)];
    const others = shuffle(LITERATURE_BOOKS.filter((b) => b.book !== chosen.book)).slice(0, 3);
    const isAskingAuthor = Math.random() > 0.35;
    if (isAskingAuthor) {
        const choices = shuffle([chosen.author, others[0].author, others[1].author, others[2].author]);
        return {
            text: `'${chosen.book}' adlı ünlü eserin yazarı kimdir?`,
            subCategory: 'Edebiyat Klasikleri',
            options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
            correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(chosen.author))}`,
            explanation: `'${chosen.book}', Türk/Dünya edebiyatının usta kalemi ${chosen.author}'e aittir. Karakterler: ${chosen.char}.`,
            sourceOrVerification: 'Türk ve Dünya Edebiyatı Antolojisi',
        };
    }
    else {
        const choices = shuffle([chosen.book, others[0].book, others[1].book, others[2].book]);
        return {
            text: `Yazar ${chosen.author}'ün unutulmaz eserlerinden biri hangisidir?`,
            subCategory: 'Edebiyat Klasikleri',
            options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
            correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(chosen.book))}`,
            explanation: `${chosen.author}'ün kaleme aldığı ünlü eser '${chosen.book}'dir.`,
            sourceOrVerification: 'Türk ve Dünya Edebiyatı Antolojisi',
        };
    }
}
function generateFoodQuestion() {
    const chosen = TURKISH_CITIES[Math.floor(Math.random() * TURKISH_CITIES.length)];
    const others = shuffle(TURKISH_CITIES.filter((c) => c.name !== chosen.name)).slice(0, 3);
    const choices = shuffle([chosen.name, others[0].name, others[1].name, others[2].name]);
    return {
        text: `'${chosen.food}' lezzetiyle ünlü olan şehrimiz hangisidir?`,
        subCategory: 'Gastronomi ve Yöresel Mutfak',
        options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
        correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(chosen.name))}`,
        explanation: `${chosen.food}, ${chosen.name} ilimizin tescilli ve geleneksel lezzetlerindendir.`,
        sourceOrVerification: 'Türk Patent ve Marka Kurumu Coğrafi İşaretler',
    };
}
function generateMathQuestion() {
    const type = Math.floor(Math.random() * 4);
    if (type === 0) {
        // Arithmetic logic
        const a = Math.floor(12 + Math.random() * 25);
        const b = Math.floor(4 + Math.random() * 9);
        const c = Math.floor(10 + Math.random() * 30);
        const answer = a * b - c;
        const dist1 = answer + Math.floor(2 + Math.random() * 5);
        const dist2 = answer - Math.floor(2 + Math.random() * 5);
        const dist3 = answer + 10;
        const choices = shuffle([String(answer), String(dist1), String(dist2), String(dist3)]);
        return {
            text: `İşlemin sonucu kaçtır: (${a} × ${b}) - ${c} = ?`,
            subCategory: 'Matematik (Temel İşlemler)',
            options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
            correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(String(answer)))}`,
            explanation: `Önce çarpma yapılır: ${a} × ${b} = ${a * b}. Ardından çıkarma: ${a * b} - ${c} = ${answer}.`,
            sourceOrVerification: 'Temel Aritmetik Kuralları',
        };
    }
    else if (type === 1) {
        // Number series pattern
        const start = Math.floor(3 + Math.random() * 8);
        const step = Math.floor(4 + Math.random() * 7);
        const s = [start, start + step, start + 2 * step, start + 3 * step];
        const next = start + 4 * step;
        const choices = shuffle([String(next), String(next + 2), String(next - step), String(next + step)]);
        return {
            text: `Sayı örüntüsünde soru işareti yerine hangi sayı gelmelidir: ${s.join(', ')}, ?`,
            subCategory: 'Mantık ve Sayı Örüntüleri',
            options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
            correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(String(next)))}`,
            explanation: `Dizi her adımda ${step} artmaktadır. ${s[3]} + ${step} = ${next}.`,
            sourceOrVerification: 'Analitik Akıl Yürütme',
        };
    }
    else if (type === 2) {
        // Geometry logic
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
            text: `${chosen.name}in iç açıları toplamı kaç derecedir?`,
            subCategory: 'Geometri (Açılar)',
            options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
            correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(chosen.sum))}`,
            explanation: `Geometride ${chosen.name}in iç açıları ölçüleri toplamı ${chosen.sum}'dir.`,
            sourceOrVerification: 'Öklid Geometrisi İlkeleri',
        };
    }
    else {
        // Prime numbers
        const primes = [17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
        const nonPrimes = [15, 21, 27, 33, 35, 39, 45, 49, 51, 55, 57, 63, 65, 69, 75, 77, 85, 91, 95];
        const prime = primes[Math.floor(Math.random() * primes.length)];
        const comps = shuffle(nonPrimes).slice(0, 3);
        const choices = shuffle([String(prime), String(comps[0]), String(comps[1]), String(comps[2])]);
        return {
            text: 'Aşağıdaki sayılardan hangisi bir ASAL sayıdır?',
            subCategory: 'Matematik (Asal Sayılar)',
            options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
            correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(String(prime)))}`,
            explanation: `${prime} sadece 1'e ve kendisine bölünebilen bir asal sayıdır. Diğer sayılar başka bölenlere sahiptir.`,
            sourceOrVerification: 'Sayılar Teorisi',
        };
    }
}
function generateSportsQuestion() {
    const chosen = SPORTS_FACTS[Math.floor(Math.random() * SPORTS_FACTS.length)];
    const choices = shuffle([chosen.correct, ...chosen.distractors]);
    return {
        text: chosen.text,
        subCategory: 'Spor Dünyası',
        options: choices.map((t, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text: t })),
        correctOptionId: `opt_${String.fromCharCode(97 + choices.indexOf(chosen.correct))}`,
        explanation: chosen.exp,
        sourceOrVerification: chosen.src,
    };
}
// ---------------------------------------------------------------------------
// 3. MASTER PROCEDURAL GENERATOR
// ---------------------------------------------------------------------------
function generateGuaranteedUniqueCandidates(categoryId, difficulty, count, existingDbSignatures) {
    const results = [];
    const currentBatchSigs = new Set();
    // Determine category generator pool
    const generatorPool = [];
    if (categoryId === 'geography') {
        generatorPool.push(generateCapitalQuestion, generatePlateQuestion, generateCapitalQuestion);
    }
    else if (categoryId === 'history') {
        generatorPool.push(generateHistoryQuestion, generateHistoryQuestion);
    }
    else if (categoryId === 'physics_chemistry' || categoryId === 'science_tech') {
        generatorPool.push(generateElementQuestion, generateInventionQuestion);
    }
    else if (categoryId === 'literature') {
        generatorPool.push(generateLiteratureQuestion);
    }
    else if (categoryId === 'food_gastronomy') {
        generatorPool.push(generateFoodQuestion);
    }
    else if (categoryId === 'mathematics' || categoryId === 'logic_puzzles') {
        generatorPool.push(generateMathQuestion);
    }
    else if (categoryId === 'sports') {
        generatorPool.push(generateSportsQuestion);
    }
    else {
        // Mixed, general culture, and all other categories pull from diverse mix
        generatorPool.push(generateCapitalQuestion, generateHistoryQuestion, generatePlateQuestion, generateElementQuestion, generateLiteratureQuestion, generateInventionQuestion, generateFoodQuestion, generateSportsQuestion, generateMathQuestion);
    }
    let safetyAttempts = 0;
    while (results.length < count && safetyAttempts < 150) {
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
