from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import asyncio
from playwright.async_api import async_playwright

app = FastAPI()

class LoginRequest(BaseModel):
    email: str
    password: str

class SearchRequest(BaseModel):
    session_cookies: Optional[List[dict]] = None
    email: Optional[str] = None
    password: Optional[str] = None
    university_name: str

@app.get("/health")
async def health():
    return {"status": "ok"}

async def do_login(email: str, password: str):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=[
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ])
        context = await browser.new_context()
        page = await context.new_page()
        await page.goto("https://team-jba.jp/login")
        await page.wait_for_load_state("networkidle")
        await page.fill('input[name="login_id"]', email)
        await page.fill('input[name="password"]', password)
        await page.click('button[type="submit"]')
        await page.wait_for_load_state("networkidle")
        ok = "ログアウト" in (await page.content())
        cookies = await context.cookies()
        await browser.close()
        if not ok:
            raise HTTPException(status_code=401, detail="login_failed")
        return {"cookies": cookies}

@app.post("/login")
async def login(req: LoginRequest):
    return await do_login(req.email, req.password)

@app.post("/search")
async def search(req: SearchRequest):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=[
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ])
        context = await browser.new_context()
        if req.session_cookies:
            await context.add_cookies(req.session_cookies)
        elif req.email and req.password:
            # perform login first to get cookies
            page_tmp = await context.new_page()
            await page_tmp.goto("https://team-jba.jp/login")
            await page_tmp.wait_for_load_state("networkidle")
            await page_tmp.fill('input[name="login_id"]', req.email)
            await page_tmp.fill('input[name="password"]', req.password)
            await page_tmp.click('button[type="submit"]')
            await page_tmp.wait_for_load_state("networkidle")
        page = await context.new_page()
        await page.goto("https://team-jba.jp/organization/15250600/team/search")
        await page.wait_for_load_state("networkidle")
        await page.select_option('select[name="fiscal_year"]', "2025")
        await page.dispatch_event('select[name="fiscal_year"]', 'change')
        await page.check('input[name="team_gender_id[]"][value="1"]')
        await page.fill('input[name="team_name"]', req.university_name)
        await page.click('#w2ui-search-button')
        await page.wait_for_timeout(3000)
        links = await page.query_selector_all('table tbody tr td a')
        result = []
        for a in links:
            href = await a.get_attribute('href')
            text = (await a.text_content()) or ""
            if href and req.university_name in text:
                result.append({"text": text.strip(), "href": href})
        await browser.close()
        return {"teams": result}
