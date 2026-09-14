import http from 'k6/http'
import { check, sleep } from 'k6'
export const options={scenarios:{browse:{executor:'ramping-vus',startVUs:1,stages:[{duration:'15s',target:10},{duration:'30s',target:10},{duration:'10s',target:0}]}},thresholds:{http_req_failed:['rate<0.01'],http_req_duration:['p(95)<500'],checks:['rate>0.99']}}
const base=__ENV.BASE_URL||'http://localhost:3000'
export default function(){const routes=['/','/buscar?q=headphone','/produto/headphone-quiet-pro','/api/v1/recommendations?seed=k6&limit=6'];for(const route of routes){const response=http.get(`${base}${route}`);check(response,{[`200 ${route}`]:(result)=>result.status===200})}const event=http.post(`${base}/api/v1/events`,JSON.stringify({name:'product_view',resource:'product',resourceId:'1',actor:'load-test'}),{headers:{'content-type':'application/json','x-mock-client':`vu-${__VU}`}});check(event,{'evento aceito':(result)=>[200,201,202].includes(result.status)});sleep(1)}
