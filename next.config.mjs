/** @type {import('next').NextConfig} */
const securityHeaders=[
 {key:'X-Content-Type-Options',value:'nosniff'},
 {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
 {key:'Strict-Transport-Security',value:'max-age=63072000'},
 {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
 {key:'X-Frame-Options',value:'SAMEORIGIN'},
 {key:'Content-Security-Policy-Report-Only',value:"default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; font-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'"},
]
// Otimização de imagens (WebP, tamanhos por dispositivo, cache de 7 dias).
// Só os hosts abaixo podem passar pelo otimizador; um provedor novo com outro CDN precisa ser adicionado aqui,
// senão suas imagens falham. NEXT_IMAGE_UNOPTIMIZED=1 desliga tudo e serve as imagens originais.
const images={
  unoptimized:process.env.NEXT_IMAGE_UNOPTIMIZED==='1',
  deviceSizes:[640,828,1080,1200],
  minimumCacheTTL:60*60*24*7,
  qualities:[60,75],
  remotePatterns:[
    {protocol:'https',hostname:'cf.shopee.com.br',search:''},
    {protocol:'https',hostname:'**.susercontent.com',search:''},
    {protocol:'https',hostname:'**.public.blob.vercel-storage.com',search:''},
    {protocol:'https',hostname:'images.unsplash.com'},
  ],
}
// Só um booleano (nunca as credenciais) é inlinado no bundle, para o cliente saber se o login com Google existe.
const env={NEXT_PUBLIC_GOOGLE_LOGIN:process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET?'1':''}
// Em máquinas com pouca memória livre o build com todos os núcleos pode falhar ("Zone Allocation failed").
// NEXT_BUILD_CPUS=3 limita os workers; na Vercel a variável não existe e nada muda.
const experimental=process.env.NEXT_BUILD_CPUS?{cpus:Number(process.env.NEXT_BUILD_CPUS)}:undefined
const nextConfig={images,env,experimental,async headers(){return[{source:'/:path*',headers:securityHeaders}]}}
export default nextConfig
