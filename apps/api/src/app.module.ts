import { Module } from '@nestjs/common';
import { ConfigModule } from './common/config/config.module.js';
import { CryptoModule } from './common/crypto/crypto.module.js';
import { DbModule } from './common/db/db.module.js';
import { GuardsModule } from './common/guards/guards.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CheckInModule } from './modules/checkin/checkin.module.js';
import { ConsentModule } from './modules/consent/consent.module.js';
import { DumpModule } from './modules/dump/dump.module.js';
import { EntitlementsModule } from './modules/entitlements/entitlements.module.js';
import { ExpressModule } from './modules/express/express.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { RecommendationModule } from './modules/recommendation/recommendation.module.js';
import { RulesModule } from './modules/rules/rules.module.js';
import { SafetyModule } from './modules/safety/safety.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { DevModule } from './platform/dev/dev.module.js';
import { EventsModule } from './platform/events/events.module.js';
import { JobsModule } from './platform/jobs/jobs.module.js';
import { MailModule } from './platform/mail/mail.module.js';
import { StorageModule } from './platform/storage/storage.module.js';

// Platform first, then modules one per line, alphabetical (WORKFLOW §3).
@Module({
  imports: [
    ConfigModule,
    CryptoModule,
    DbModule,
    EventsModule,
    GuardsModule,
    JobsModule,
    MailModule,
    StorageModule,
    AiModule,
    AuditModule,
    AuthModule,
    CheckInModule,
    ConsentModule,
    DevModule,
    DumpModule,
    EntitlementsModule,
    ExpressModule,
    HealthModule,
    RecommendationModule,
    RulesModule,
    SafetyModule,
    SessionsModule,
    TasksModule,
    UsersModule,
  ],
})
export class AppModule {}
