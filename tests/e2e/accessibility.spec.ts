import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
const routes=['/','/buscar','/produto/headphone-quiet-pro','/admin/ranking','/admin/analytics']
for(const route of routes)test(`sem violações críticas em ${route}`,async({page})=>{await page.goto(route);await page.waitForLoadState('networkidle');const results=await new AxeBuilder({page}).disableRules(['color-contrast']).analyze();expect(results.violations.filter((item)=>['critical','serious'].includes(item.impact??''))).toEqual([])})
