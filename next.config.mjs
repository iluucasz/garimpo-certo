/** @type {import('next').NextConfig} */
const securityHeaders=[
 {key:'X-Content-Type-Options',value:'nosniff'},
 {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
 {key:'Strict-Transport-Security',value:'max-age=63072000'},
 {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
 {key:'X-Frame-Options',value:'SAMEORIGIN'},
 {key:'Content-Security-Policy-Report-Only',value:"default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; font-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'"},
]
const nextConfig={images:{unoptimized:true},async headers(){return[{source:'/:path*',headers:securityHeaders}]}}
export default nextConfig
