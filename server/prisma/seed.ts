import 'dotenv/config';
import { prisma, db } from '../src/db/prismaClient';

async function main() {
  console.log('==============================================================');
  console.log('🚀 [Prisma ORM -> Supabase] Veri Gönderimi Başlatılıyor...');
  console.log(`🌐 Hedef Supabase: ${process.env.SUPABASE_URL || 'https://rjvbgofzsfescnfohzgu.supabase.co'}`);
  console.log('==============================================================');

  // 1. Ensure a sample MatchHistory record exists in Prisma ORM
  await prisma.matchHistory.create({
    data: {
      id: 'match_seed_opening_duel',
      roomCode: 'TV2026',
      mode: 'duel_1v1',
      categoryId: 'general',
      winnerId: 'bot_1',
      userId: 'bot_1',
      score: 480,
      correctAnswers: 5,
      totalQuestions: 5,
      rankingsJson: [
        { userId: 'bot_1', displayName: 'Bilgi Avcısı', score: 480, rank: 1 },
        { userId: 'bot_2', displayName: 'Zeka Fırtınası', score: 390, rank: 2 },
      ],
    },
  });

  // 2. Push all categories, questions, users, inventory items, notifications & match history via Prisma ORM to Supabase
  const syncResult = await db.pushAllDataViaPrismaToSupabase();

  console.log('✅ Prisma ORM Tablo Kayıt Sayıları:');
  console.log(`   • Categories (categories)               : ${syncResult.counts.categories}`);
  console.log(`   • Questions (questions)                 : ${syncResult.counts.questions}`);
  console.log(`   • Users (users)                         : ${syncResult.counts.users}`);
  console.log(`   • Inventory Items (user_inventory_items): ${syncResult.counts.userInventoryItems}`);
  console.log(`   • Notifications (user_notifications)    : ${syncResult.counts.userNotifications}`);
  console.log(`   • Match History (match_history)         : ${syncResult.counts.matchHistory}`);
  console.log(`☁️  Supabase Bulut Senkronizasyon Durumu    : ${syncResult.synced ? 'BAŞARILI (AKTİF)' : 'YEREL SNAPSHOT KAYDEDİLDİ'}`);
  console.log('==============================================================');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ [Prisma Seed Hatası]:', err);
    process.exit(1);
  });
