declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BREVO_API_KEY?: string;
    EMAIL_FROM?: string;
    APP_ORIGIN?: string;
    BUCKET?: R2Bucket;
  }
}
