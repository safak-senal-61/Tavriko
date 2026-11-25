# Google ile Giriş (Tavriko'nun kendi OAuth istemcisi)

Tavriko artık Google girişinde Supabase'in yetkilendirme sunucusuna bağımlı değil.
Uygulama kendi Web istemcisiyle Google'a gider, kodu sunucu kendi istemci sırrıyla
değiş-tokuş eder ve oturumu yalnızca Tavriko sunucusu üretir.

## Akış (tarayıcı / Expo Web / mobil tarayıcı)

1. İstemci `GET /api/auth/google/start?platform=web|native` adresini açar.
2. Sunucu, imzalı bir `state` üretir ve tarayıcıyı Google'a yönlendirir
   (`scope=openid email profile`, `prompt=select_account`).
3. Google, `code` ile `/api/auth/google/callback` adresine döner.
4. Sunucu kodu `https://oauth2.googleapis.com/token` üzerinde değiş-tokuş eder,
   `userinfo` ile `sub`, `email`, `email_verified`, `name`, `picture` alır.
   `email_verified` olmayan hesaplar reddedilir.
5. `db.loginOrRegisterGoogle()` çağrılır; `googleId` olarak Google'ın `sub`
   değeri saklanır.
6. Uygulamaya 120 saniyelik, tek kullanımlık bir kod verilir:
   - Web: `303 /app#code=<kod>`
   - Native: `303 tavriko://auth-callback#code=<kod>`
7. İstemci `POST /api/auth/google/exchange { code }` ile `{ token, user }` alır.
   Kod Redis'te (Upstash) tutulur ve okunduğu anda silinir.

Oturum jetonu hiçbir zaman URL'de taşınmaz; URL'de yalnızca tek kullanımlık kod bulunur.

## Yerel SDK (tarayıcısız) yolu

`POST /api/auth/google/id-token { idToken }` yalnızca şu kitlelerden (`aud`) birine
düzenlenmiş jetonları kabul eder:

- `GOOGLE_ANDROID_CLIENT_ID` — Android istemcisi (paket adı + SHA-1 ile eşleşir)
- `GOOGLE_CLIENT_ID` / `GOOGLE_WEB_CLIENT_ID` — Web istemcisi

Jeton `https://oauth2.googleapis.com/tokeninfo` ile doğrulanır; imza, `iss`,
`aud`, `exp` ve `email_verified` kontrol edilir. Yerel SDK'ya geçildiğinde istemci
bu uç noktayı kullanabilir.

## Google Cloud Console ayarları

Aynı proje (`reverberant-joy-509022-p7`) içinde:

| İstemci | Gerekli ayar |
| --- | --- |
| **Web application** (`GOOGLE_CLIENT_ID`) | Authorized redirect URIs: `https://tavriko-app.vercel.app/api/auth/google/callback`, önizleme adresleri ve gerekirse `http://localhost:4000/api/auth/google/callback` |
| **Android** (`GOOGLE_ANDROID_CLIENT_ID`) | Paket adı `com.tavriko.app`, SHA-1 `6E:15:F3:C4:49:AD:…:22:D8:21` (debug). Play'den kurulan sürümler için Play Console → App signing SHA-1 ile ikinci bir Android istemcisi gerekir. |

Authorized JavaScript origins yalnızca tarayıcıda Google JS SDK kullanılırsa gerekir;
mevcut akış sunucu taraflı olduğu için zorunlu değildir.

> Not: Bir istemcide kayıtlı olmayan dönüş adresi kullanılırsa Google
> `redirect_uri_mismatch` hatası verir. Bu hata kod kaynaklı değildir; konsolda
> adresin eklenmesi gerekir.

## Ortam değişkenleri

| Değişken | Açıklama |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Web application istemci kimliği (yoksa `GOOGLE_WEB_CLIENT_ID` okunur) |
| `GOOGLE_CLIENT_SECRET` | Web istemcisinin sırrı; yalnızca sunucuda |
| `GOOGLE_ANDROID_CLIENT_ID` | Yerel SDK kimlik jetonları için Android istemci kimliği |
| `GOOGLE_OAUTH_REDIRECT_URI` | Opsiyonel; dönüş adresini sabitler (yerel geliştirme/tünel) |
| `PUBLIC_APP_URL` | Dönüş adresi bundan türetilir (yoksa isteğin host'u) |

Bu değerler yoksa `/api/auth/google/start` 503 döner; uygulama kullanıcıya
"Google girişi tamamlanamadı" mesajını gösterir.

## Geriye dönük uyumluluk

- `/api/auth/google/callback` adresine `state` olmadan gelen Supabase PKCE kodları
  eskisi gibi `/app#code=<kod>` adresine iletilir; kurulu eski sürümler çalışmaya
  devam eder.
- `POST /api/auth/google { accessToken }` eski istemciler için korunur ve yalnızca
  Supabase'in doğruladığı Google kimliğini kabul eder.
