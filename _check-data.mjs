import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
neonConfig.webSocketConstructor = ws
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const products = await pool.query(`select id, slug, name, brand_id, description, canonical_image_id from products`)
console.log('=== PRODUCTS ===')
console.table(products.rows)

const images = await pool.query(`select product_id, source_url, is_primary from product_images`)
console.log('=== PRODUCT IMAGES ===', images.rows.length)
console.table(images.rows)

const cats = await pool.query(`select * from categories`)
console.log('=== CATEGORIES ===', cats.rows.length)

const brands = await pool.query(`select * from brands`)
console.log('=== BRANDS ===', brands.rows.length)

const productCats = await pool.query(`select * from product_categories`)
console.log('=== PRODUCT_CATEGORIES ===', productCats.rows.length)

const tags = await pool.query(`select * from tags`)
console.log('=== TAGS ===', tags.rows.length)

const attrs = await pool.query(`select * from product_attributes`)
console.log('=== PRODUCT_ATTRIBUTES ===', attrs.rows.length)

await pool.end()
process.exit(0)
