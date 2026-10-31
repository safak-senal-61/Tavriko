# Implementation Plan: Bilgi Yarışması, Supabase, Upstash Redis, Telegram Bot ve Evren Türkiye GLM 5.3

Bu plan, kullanıcı tarafından bildirilen zaman çubuğu, geri sayım ve cevap seçimi kritik hatalarını kökten çözmeyi; Supabase, Upstash Redis ve Evren Türkiye GLM-5.3 servislerini kurumsal mimariye tam entegre etmeyi hedefler.

## 1. Kritik Oyun Hatalarının Giderilmesi (Zaman Çubuğu, Geri Sayım, Cevap Durum Makinesi)
- **Problem Analizi:**
  - `QuizArenaScreen.tsx` içinde `Animated.timing` ve bağımsız `setInterval(1000)` farklı zaman kaynakları kullanmaktaydı ve percentage width animasyonu re-render'larda takılıyordu.
  - Süre dolduğunda butonların `disabled` durumu sunucu tarafından otoriter kontrol edilmiyordu; istemci doğrudan API'ye geç istek atabiliyordu.
- **Çözüm:**
  - Tek zaman kaynağı (`endTime = startTime + totalTimeMs`), her karede `remainingMs = Math.max(0, endTime - Date.now())` hesaplanması.
  - Yüksek akıcılıkta 60 FPS görsel çubuk genişliği: `${(remainingMs / totalMs) * 100}%`.
  - Kesin 5 durumlu soru durum makinesi: `'answerable' | 'submitting' | 'correct' | 'incorrect' | 'timed_out'`.
  - Sunucu tarafında `questionExpiresAt` doğrulaması ve atomik cevap idempotency kilidi (`ALREADY_ANSWERED` ve `EXPIRED`).

## 2. Supabase Entegrasyonu
- PostgreSQL veritabanı şeması: `server/migrations/001_initial_schema.sql`.
- Tablolar: `categories`, `questions`, `matches`, `match_players`, `match_answers`, `review_history`.
- Row Level Security (RLS) politikaları.
- Sunucu tarafı: `server/src/db/supabaseClient.ts` (service role `SUPABASE_SECRET_KEY`).
- İstemci tarafı: `client/src/services/supabaseClient.ts` (`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).

## 3. Upstash Redis Entegrasyonu
- Paket: `@upstash/redis` (REST HTTP API).
- Kullanım alanları:
  - Aktif maç/soru bitiş zamanları (`match:<id>:q:<qid>:expires`).
  - Çift cevap engelleme atomik kilitleri (`lock:ans:<id>:<qid>:<player>`).
  - Tekrar önleme (anti-repeat) görülen soru kümeleri (`seen:<player>:<cat>`).
  - API hız sınırlama (rate-limit).
- Geriye uyumlu in-memory Redis fallback motoru.

## 4. GLM 5.3 — Evren Türkiye LLM Entegrasyonu
- Altyapı: T.C. Cumhurbaşkanlığı Savunma Sanayii Başkanlığı EVREN platformu / LLMTR OpenAI-uyumlu API (`https://llmtr.com/v1/chat/completions`).
- Model: `evren/glm-5.3-fp8` (veya ortam değişkeniyle `EVREN_LLM_MODEL`).
- 10 Noktalı Soru Doğrulayıcı ile sıkı entegrasyon.
- Soru üretim durum kayıtları ve `pending_review` statüsü.

## 5. Telegram Bot & Yönetici Onay Akışı
- `/kategori`, `/soru_uret`, `/bekleyenler`, `/istatistik` komutları.
- GLM 5.3 ile soru üretip Telegram inline butonlarıyla (`✅ Onayla`, `❌ Reddet`, `✏️ Düzenle`, `🔄 Yeniden Üret`, `🔍 Doğrula`) yöneticiye sunma.
- Yetki denetimi (`TELEGRAM_ADMIN_IDS`).
- Supabase denetim geçmişi (audit trail).

## 6. Doğrulama ve Testler
- Zamanlayıcı, senkronizasyon ve cevap kilitleme testleri.
- Upstash Redis kilit ve süre aşımı testleri.
- Supabase veri katmanı ve RLS testleri.
- Evren Türkiye GLM 5.3 soru üretim ve doğrulama testleri.
- Tüm monorepo testlerinin (`shared`, `server`, `client`) çalıştırılması.
