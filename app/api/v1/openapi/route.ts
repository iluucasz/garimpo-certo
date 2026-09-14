import { ok } from '@/lib/server/api'
import { openApiDocument } from '@/lib/server/openapi-document'

export async function GET() {
  return ok(openApiDocument)
}
