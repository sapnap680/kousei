import streamlit as st
import pandas as pd
import json
import asyncio
import re
import unicodedata
from difflib import SequenceMatcher
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils.dataframe import dataframe_to_rows
import io
import zipfile
from playwright.async_api import async_playwright
import time

# ページ設定
st.set_page_config(
    page_title="🏀 JBA選手データ照合システム（リアルタイム版）",
    page_icon="🏀",
    layout="wide"
)

class RealtimeJBAVerificationSystem:
    def __init__(self):
        self.jba_data = {}
        self.session_data = None
        
    async def login_to_jba(self, email, password):
        """JBAサイトにログイン"""
        try:
            async with async_playwright() as p:
                # ブラウザ起動オプションを追加
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                )
                context = await browser.new_context()
                page = await context.new_page()

                # ログインページにアクセス
                await page.goto("https://team-jba.jp/login")
                await page.wait_for_load_state("networkidle")

                # ログインフォームに入力（修正版）
                await page.fill('input[name="login_id"]', email)
                await page.fill('input[name="password"]', password)

                # ログインボタンをクリック
                await page.click('button[type="submit"]')
                await page.wait_for_load_state("networkidle")

                # ログイン成功確認
                if "ログアウト" in await page.text_content("body"):
                    # セッション情報を保存
                    cookies = await context.cookies()
                    self.session_data = {
                        "cookies": cookies,
                        "user_agent": await page.evaluate("() => navigator.userAgent")
                    }
                    await browser.close()
                    return True
                else:
                    await browser.close()
                    return False

        except Exception as e:
            st.error(f"ログインエラー: {str(e)}")
            return False
    
    async def search_team_by_university(self, university_name):
        """大学名でチームを検索"""
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                )
                context = await browser.new_context()
                
                # セッション情報を復元
                if self.session_data:
                    await context.add_cookies(self.session_data["cookies"])
                
                page = await context.new_page()
                
                # チーム検索ページにアクセス
                await page.goto("https://team-jba.jp/organization/15250600/team/search")
                await page.wait_for_load_state("networkidle")
                
                # 検索条件を設定
                # 年度: 2025
                await page.select_option('select[name="fiscal_year"]', "2025")
                await page.dispatch_event('select[name="fiscal_year"]', 'change')

                # 性別: 男子（チェックボックス）
                await page.check('input[name="team_gender_id[]"][value="1"]')

                # 検索範囲はデフォルトのまま（スキップ）
                
                # チーム名で検索
                await page.fill('input[name="team_name"]', university_name)
                
                # 検索ボタンをクリック
                await page.click('#w2ui-search-button')
                await page.wait_for_timeout(3000)
                
                # 検索結果を取得
                team_links = await page.query_selector_all('table tbody tr td a')
                team_urls = []
                
                for link in team_links:
                    href = await link.get_attribute('href')
                    if href and university_name in await link.text_content():
                        team_urls.append(href)
                
                await browser.close()
                return team_urls
                
        except Exception as e:
            st.error(f"チーム検索エラー: {str(e)}")
            return []
    
    async def get_team_members(self, team_url):
        """チームの選手・スタッフ情報を取得"""
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                )
                context = await browser.new_context()
                
                # セッション情報を復元
                if self.session_data:
                    await context.add_cookies(self.session_data["cookies"])
                
                page = await context.new_page()
                
                # チーム詳細ページにアクセス
                await page.goto(team_url)
                await page.wait_for_load_state("networkidle")
                
                # チーム名を取得
                team_name_element = await page.query_selector('h1, h2, .team-name')
                team_name = await team_name_element.text_content() if team_name_element else "Unknown Team"
                
                # メンバーリストテーブルを待機
                await page.wait_for_selector('#team-member-registration-list', timeout=10000)
                
                # メンバー情報を取得
                member_rows = await page.query_selector_all('#team-member-registration-list tbody tr')
                members = []
                
                for row in member_rows:
                    cells = await row.query_selector_all('td')
                    if len(cells) >= 5:
                        member_id = await cells[0].text_content()
                        name_element = await cells[1].query_selector('a')
                        name = await name_element.text_content() if name_element else await cells[1].text_content()
                        birth_date = await cells[2].text_content()
                        origin = await cells[3].text_content()
                        division = await cells[4].text_content()
                        status = await cells[5].text_content() if len(cells) > 5 else ""
                        
                        members.append({
                            "member_id": member_id.strip(),
                            "name": name.strip(),
                            "birth_date": birth_date.strip(),
                            "origin": origin.strip(),
                            "division": division.strip(),
                            "status": status.strip(),
                            "type": "player" if "選手" in division else "staff"
                        })
                
                await browser.close()
                return {
                    "team_name": team_name.strip(),
                    "team_url": team_url,
                    "members": members
                }
                
        except Exception as e:
            st.error(f"メンバー取得エラー: {str(e)}")
            return {"team_name": "Error", "team_url": team_url, "members": []}
    
    async def get_university_data(self, university_name):
        """大学のデータを取得"""
        st.info(f"🔍 {university_name}のチームを検索中...")
        
        # チームを検索
        team_urls = await self.search_team_by_university(university_name)
        
        if not team_urls:
            st.warning(f"⚠️ {university_name}のチームが見つかりませんでした")
            return None
        
        st.info(f"📊 {university_name}の選手・スタッフ情報を取得中...")
        
        # 各チームのメンバー情報を取得
        all_members = []
        for i, team_url in enumerate(team_urls):
            with st.spinner(f"チーム {i+1}/{len(team_urls)} を処理中..."):
                team_data = await self.get_team_members(team_url)
                if team_data and team_data["members"]:
                    all_members.extend(team_data["members"])
        
        return {
            "university_name": university_name,
            "members": all_members
        }
    
    def normalize_name(self, name):
        """名前の正規化"""
        if not name or pd.isna(name):
            return ""
        
        name = str(name)
        
        # 1. 全角・半角統一
        name = unicodedata.normalize('NFKC', name)
        
        # 2. 記号・スペースの正規化（全角スペースも含む）
        name = re.sub(r'[・･、，,\.\s　]+', '', name)
        
        # 3. 大文字小文字統一
        name = name.lower()
        
        # 4. よくある表記揺れの統一
        name = re.sub(r'[ー−‐—–]', '', name)  # 長音符、ハイフン、エムダッシュ、エンダッシュ除去
        
        return name
    
    def normalize_birth_date(self, birth_date):
        """生年月日の正規化"""
        if not birth_date or pd.isna(birth_date):
            return ""
        
        birth_date = str(birth_date)
        
        # 様々な日付形式に対応
        patterns = [
            r'(\d{4})[/\-年](\d{1,2})[/\-月](\d{1,2})[日]?',
            r'(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})',
            r'(\d{4})年(\d{1,2})月(\d{1,2})日'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, birth_date)
            if match:
                year, month, day = match.groups()
                return f"{year}/{int(month):02d}/{int(day):02d}"
        
        return birth_date
    
    def calculate_ultimate_similarity(self, name1, name2):
        """究極の類似度計算"""
        if not name1 or not name2:
            return 0.0
        
        # 正規化
        norm_name1 = self.normalize_name(name1)
        norm_name2 = self.normalize_name(name2)
        
        if norm_name1 == norm_name2:
            return 1.0
        
        # 1. 基本的な類似度
        basic_similarity = SequenceMatcher(None, norm_name1, norm_name2).ratio()
        
        # 2. 文字単位の類似度
        char_similarity = self.calculate_character_similarity(norm_name1, norm_name2)
        
        # 3. 部分文字列の類似度
        substring_similarity = self.calculate_substring_similarity(norm_name1, norm_name2)
        
        # 4. 音声類似度
        phonetic_similarity = self.calculate_phonetic_similarity(name1, name2)
        
        # 重み付き平均
        ultimate_similarity = (
            basic_similarity * 0.4 +
            char_similarity * 0.3 +
            substring_similarity * 0.2 +
            phonetic_similarity * 0.1
        )
        
        return ultimate_similarity
    
    def calculate_character_similarity(self, name1, name2):
        """文字単位の類似度"""
        if not name1 or not name2:
            return 0.0
        
        chars1 = set(name1)
        chars2 = set(name2)
        
        common_chars = chars1.intersection(chars2)
        total_chars = chars1.union(chars2)
        
        if not total_chars:
            return 0.0
        
        return len(common_chars) / len(total_chars)
    
    def calculate_substring_similarity(self, name1, name2):
        """部分文字列の類似度"""
        if not name1 or not name2:
            return 0.0
        
        max_ratio = 0.0
        
        # 様々な長さの部分文字列をチェック
        for length in range(2, min(len(name1), len(name2)) + 1):
            for i in range(len(name1) - length + 1):
                substring = name1[i:i+length]
                if substring in name2:
                    ratio = length / max(len(name1), len(name2))
                    max_ratio = max(max_ratio, ratio)
        
        return max_ratio
    
    def calculate_phonetic_similarity(self, name1, name2):
        """音声類似度（ひらがな・カタカナ対応）"""
        if not name1 or not name2:
            return 0.0
        
        # ひらがなをカタカナに変換
        def to_katakana(text):
            return text.translate(str.maketrans('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん', 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'))
        
        katakana1 = to_katakana(name1)
        katakana2 = to_katakana(name2)
        
        return SequenceMatcher(None, katakana1, katakana2).ratio()
    
    def calculate_raw_similarity(self, name1, name2):
        """元データの類似度計算（正規化なし）"""
        if not name1 or not name2:
            return 0.0
        
        # 元データの完全一致
        if name1 == name2:
            return 1.0
        
        # 基本的な類似度（正規化なし）
        basic_similarity = SequenceMatcher(None, name1, name2).ratio()
        
        # 文字単位の類似度（正規化なし）
        char_similarity = self.calculate_character_similarity(name1, name2)
        
        # 部分文字列の類似度（正規化なし）
        substring_similarity = self.calculate_substring_similarity(name1, name2)
        
        # 重み付き平均
        raw_similarity = (
            basic_similarity * 0.5 +
            char_similarity * 0.3 +
            substring_similarity * 0.2
        )
        
        return raw_similarity
    
    def detect_original_differences(self, name1, name2):
        """元のデータの違いを検出"""
        if not name1 or not name2:
            return []
        
        differences = []
        
        # 1. 文字単位での違いを検出
        for i, (char1, char2) in enumerate(zip(name1, name2)):
            if char1 != char2:
                differences.append(f"位置{i+1}: '{char1}' → '{char2}'")
        
        # 2. 長さの違い
        if len(name1) != len(name2):
            if len(name1) > len(name2):
                differences.append(f"余分な文字: '{name1[len(name2):]}'")
            else:
                differences.append(f"不足文字: '{name2[len(name1):]}'")
        
        # 3. 全角・半角の違い
        norm1 = unicodedata.normalize('NFKC', name1)
        norm2 = unicodedata.normalize('NFKC', name2)
        if norm1 != norm2:
            differences.append("全角・半角の違い")
        
        # 4. 記号・スペースの違い
        clean1 = re.sub(r'[・･、，,\.\s　]+', '', name1)
        clean2 = re.sub(r'[・･、，,\.\s　]+', '', name2)
        if clean1 != clean2:
            differences.append("記号・スペースの違い")
        
        return differences
    
    def find_all_possible_matches(self, excel_row, university_data, threshold=0.3):
        """すべての可能なマッチを検索（元データ直接比較）"""
        if not university_data or not university_data.get("members"):
            return []
        
        excel_name = excel_row.get('選手名', excel_row.get('名前', excel_row.get('氏名', '')))
        excel_birth = excel_row.get('生年月日', excel_row.get('誕生日', ''))
        excel_team = excel_row.get('チーム名', excel_row.get('所属', ''))
        
        matches = []
        
        for member in university_data["members"]:
            # 1. 元データの完全一致チェック（正規化なし）
            exact_match = excel_name == member["name"]
            
            # 2. 元データの類似度（正規化なし）
            name_similarity = self.calculate_raw_similarity(excel_name, member["name"])
            
            # 3. 元データの違いを詳細検出
            original_differences = self.detect_original_differences(excel_name, member["name"])
            
            # 生年月日の一致（元データ比較）
            birth_match = False
            if excel_birth and member["birth_date"]:
                birth_match = excel_birth == member["birth_date"]
            
            # チーム名の一致（ボーナス）
            team_bonus = 0.1 if excel_team and excel_team in member.get("team_name", "") else 0.0
            
            # 生年月日一致ボーナス
            birth_bonus = 0.2 if birth_match else 0.0
            
            # 最終スコア（元データの完全一致のみ1.0）
            if exact_match:
                final_score = 1.0
            else:
                final_score = name_similarity + team_bonus + birth_bonus
            
            if final_score >= threshold:
                matches.append({
                    "member": member,
                    "exact_match": exact_match,
                    "name_similarity": name_similarity,
                    "original_differences": original_differences,
                    "birth_match": birth_match,
                    "team_bonus": team_bonus,
                    "birth_bonus": birth_bonus,
                    "final_score": final_score
                })
        
        # スコアでソート
        matches.sort(key=lambda x: x["final_score"], reverse=True)
        return matches[:5]  # 上位5件まで
    
    def verify_excel_data(self, df, university_data, threshold=0.3):
        """エクセルデータを照合"""
        results = []
        
        for index, row in df.iterrows():
            matches = self.find_all_possible_matches(row, university_data, threshold)
            
            if not matches:
                results.append({
                    "index": index,
                    "excel_row": row,
                    "status": "未マッチ",
                    "matches": [],
                    "best_match": None
                })
            elif len(matches) == 1 and matches[0]["final_score"] >= 1.00:
                results.append({
                    "index": index,
                    "excel_row": row,
                    "status": "マッチ",
                    "matches": matches,
                    "best_match": matches[0]
                })
            else:
                results.append({
                    "index": index,
                    "excel_row": row,
                    "status": "複数候補",
                    "matches": matches,
                    "best_match": matches[0] if matches else None
                })
        
        return results
    
    def create_corrected_excel(self, df, results, university_name):
        """修正版エクセルを作成"""
        # 新しい列を追加
        df_copy = df.copy()
        df_copy['照合結果'] = ''
        df_copy['元データ'] = ''
        df_copy['JBA正解'] = ''
        df_copy['JBA正解生年月日'] = ''
        df_copy['JBA正解チーム名'] = ''
        df_copy['類似度'] = ''
        df_copy['修正提案'] = ''
        df_copy['詳細分析'] = ''
        df_copy['些細な違い'] = ''
        
        for result in results:
            index = result["index"]
            status = result["status"]
            best_match = result["best_match"]
            
            df_copy.at[index, '照合結果'] = status
            
            if best_match:
                member = best_match["member"]
                excel_name = df_copy.at[index, '選手名'] if '選手名' in df_copy.columns else df_copy.at[index, '名前']
                excel_birth = df_copy.at[index, '生年月日'] if '生年月日' in df_copy.columns else df_copy.at[index, '誕生日']
                
                # 元データとJBA正解を並べて表示
                df_copy.at[index, '元データ'] = f"{excel_name} {excel_birth}"
                df_copy.at[index, 'JBA正解'] = f"{member['name']} {member['birth_date']}"
                df_copy.at[index, 'JBA正解生年月日'] = member["birth_date"]
                df_copy.at[index, 'JBA正解チーム名'] = university_name
                df_copy.at[index, '類似度'] = f"{best_match['final_score']:.3f}"
                
                # 修正提案
                corrections = []
                if excel_name != member["name"]:
                    corrections.append(f"名前: {member['name']}")
                if excel_birth != member["birth_date"]:
                    corrections.append(f"生年月日: {member['birth_date']}")
                if not corrections:
                    corrections.append("修正不要")
                
                df_copy.at[index, '修正提案'] = "; ".join(corrections)
                
                # 詳細分析
                analysis = []
                if best_match.get("exact_match"):
                    analysis.append("完全一致")
                elif best_match["name_similarity"] < 1.0:
                    analysis.append(f"名前類似度: {best_match['name_similarity']:.3f}")
                if best_match["birth_match"]:
                    analysis.append("生年月日一致")
                if best_match["team_bonus"] > 0:
                    analysis.append("チーム名一致")
                
                df_copy.at[index, '詳細分析'] = "; ".join(analysis)
                
                # 元データの違いを詳細表示
                if best_match.get("original_differences"):
                    df_copy.at[index, '些細な違い'] = "; ".join(best_match["original_differences"])
                elif best_match["name_similarity"] < 1.0:
                    df_copy.at[index, '些細な違い'] = f"元データの表記が異なります（類似度: {best_match['name_similarity']:.3f}）"
            else:
                # JBAに登録されていない場合
                excel_name = df_copy.at[index, '選手名'] if '選手名' in df_copy.columns else df_copy.at[index, '名前']
                excel_birth = df_copy.at[index, '生年月日'] if '生年月日' in df_copy.columns else df_copy.at[index, '誕生日']
                
                df_copy.at[index, '元データ'] = f"{excel_name} {excel_birth}"
                df_copy.at[index, 'JBA正解'] = "JBA登録なし"
                df_copy.at[index, '修正提案'] = "JBAに登録されていません"
                df_copy.at[index, '詳細分析'] = "該当する選手が見つかりませんでした"
        
        return df_copy

def main():
    st.title("🏀 JBA選手データ照合システム（リアルタイム版）")
    st.markdown("**リアルタイムでJBAサイトからデータを取得し、エクセルファイルと照合します**")
    
    # システム初期化
    if 'verification_system' not in st.session_state:
        st.session_state.verification_system = RealtimeJBAVerificationSystem()
    
    system = st.session_state.verification_system
    
    # サイドバー
    with st.sidebar:
        st.header("🔐 JBAログイン情報")
        email = st.text_input("メールアドレス", type="default")
        password = st.text_input("パスワード", type="password")
        
        st.header("⚙️ 設定")
        threshold = st.slider("類似度閾値", 0.1, 1.0, 1.00, 0.05, help="1.00推奨：完全一致を求める場合に使用します")
    
    # メインコンテンツ
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.header("📄 エクセルファイル")
        uploaded_files = st.file_uploader(
            "エクセルファイルをアップロード（複数選択可能）",
            type=['xlsx', 'xls'],
            accept_multiple_files=True
        )
        
        if uploaded_files:
            st.success(f"✅ {len(uploaded_files)}個のファイルがアップロードされました")
            for file in uploaded_files:
                st.write(f"- {file.name}")
    
    with col2:
        st.header("🏫 大学名")
        university_input = st.text_area(
            "大学名を入力（カンマ区切り）",
            height=150,
            placeholder="例:\n白鴎大学\n早稲田大学\n慶應大学"
        )
        
        if university_input:
            universities = [uni.strip() for uni in university_input.split('\n') if uni.strip()]
            st.success(f"✅ {len(universities)}個の大学が指定されました")
            for uni in universities:
                st.write(f"- {uni}")
    
    # 実行ボタン
    if st.button("🚀 リアルタイムデータ照合を実行", type="primary"):
        if not email or not password:
            st.error("❌ JBAログイン情報を入力してください")
            return
        
        if not uploaded_files:
            st.error("❌ エクセルファイルをアップロードしてください")
            return
        
        if not university_input:
            st.error("❌ 大学名を入力してください")
            return
        
        universities = [uni.strip() for uni in university_input.split('\n') if uni.strip()]
        
        # プログレスバー
        progress_bar = st.progress(0)
        status_text = st.empty()
        
        try:
            # 1. ログイン
            status_text.text("🔐 JBAサイトにログイン中...")
            login_success = asyncio.run(system.login_to_jba(email, password))
            
            if not login_success:
                st.error("❌ ログインに失敗しました。メールアドレスとパスワードを確認してください")
                return
            
            progress_bar.progress(20)
            st.success("✅ ログイン成功")
            
            # 2. 各大学のデータを取得
            all_university_data = {}
            for i, university in enumerate(universities):
                status_text.text(f"📊 {university}のデータを取得中... ({i+1}/{len(universities)})")
                
                university_data = asyncio.run(system.get_university_data(university))
                if university_data:
                    all_university_data[university] = university_data
                
                progress = 20 + (i + 1) * 60 / len(universities)
                progress_bar.progress(int(progress))
            
            # 3. 各エクセルファイルを処理
            corrected_files = {}
            
            for file_index, uploaded_file in enumerate(uploaded_files):
                status_text.text(f"🔍 {uploaded_file.name}を処理中... ({file_index+1}/{len(uploaded_files)})")
                
                # エクセルファイルを読み込み
                df = pd.read_excel(uploaded_file)
                
                # 各大学のデータと照合
                all_results = []
                for university, university_data in all_university_data.items():
                    results = system.verify_excel_data(df, university_data, threshold)
                    all_results.extend(results)
                
                # 修正版エクセルを作成
                corrected_df = system.create_corrected_excel(df, all_results, ", ".join(universities))
                corrected_files[uploaded_file.name] = corrected_df
                
                progress = 80 + (file_index + 1) * 20 / len(uploaded_files)
                progress_bar.progress(int(progress))
            
            progress_bar.progress(100)
            status_text.text("✅ 処理完了")
            
            # 結果表示
            st.success("🎉 データ照合が完了しました！")
            
            # 結果タブ
            tab1, tab2, tab3, tab4 = st.tabs(["📊 統計", "✅ マッチ", "❌ 未マッチ", "⚠️ 複数候補"])
            
            with tab1:
                st.subheader("📊 照合結果統計")
                
                total_records = sum(len(df) for df in corrected_files.values())
                matched_count = sum(1 for results in [system.verify_excel_data(df, uni_data, threshold) for df, uni_data in [(pd.read_excel(f), uni_data) for f in uploaded_files for uni_data in all_university_data.values()]] for result in results if result["status"] == "マッチ")
                unmatched_count = sum(1 for results in [system.verify_excel_data(df, uni_data, threshold) for df, uni_data in [(pd.read_excel(f), uni_data) for f in uploaded_files for uni_data in all_university_data.values()]] for result in results if result["status"] == "未マッチ")
                multiple_count = sum(1 for results in [system.verify_excel_data(df, uni_data, threshold) for df, uni_data in [(pd.read_excel(f), uni_data) for f in uploaded_files for uni_data in all_university_data.values()]] for result in results if result["status"] == "複数候補")
                
                col1, col2, col3, col4 = st.columns(4)
                with col1:
                    st.metric("総件数", total_records)
                with col2:
                    st.metric("マッチ", matched_count, f"{matched_count/total_records*100:.1f}%" if total_records > 0 else "0%")
                with col3:
                    st.metric("未マッチ", unmatched_count, f"{unmatched_count/total_records*100:.1f}%" if total_records > 0 else "0%")
                with col4:
                    st.metric("複数候補", multiple_count, f"{multiple_count/total_records*100:.1f}%" if total_records > 0 else "0%")
            
            with tab2:
                st.subheader("✅ マッチした選手")
                for file_name, df in corrected_files.items():
                    matched_df = df[df['照合結果'] == 'マッチ']
                    if not matched_df.empty:
                        st.write(f"**{file_name}**")
                        st.dataframe(matched_df[['元データ', 'JBA正解', '類似度', '修正提案']])
            
            with tab3:
                st.subheader("❌ 未マッチの選手")
                for file_name, df in corrected_files.items():
                    unmatched_df = df[df['照合結果'] == '未マッチ']
                    if not unmatched_df.empty:
                        st.write(f"**{file_name}**")
                        st.dataframe(unmatched_df[['元データ', 'JBA正解', '詳細分析']])
            
            with tab4:
                st.subheader("⚠️ 複数候補がある選手")
                for file_name, df in corrected_files.items():
                    multiple_df = df[df['照合結果'] == '複数候補']
                    if not multiple_df.empty:
                        st.write(f"**{file_name}**")
                        st.dataframe(multiple_df[['元データ', 'JBA正解', '類似度', '詳細分析']])
            
            # ダウンロードボタン
            st.subheader("📥 修正版エクセルファイルをダウンロード")
            
            # ZIPファイルを作成
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
                for file_name, df in corrected_files.items():
                    # ファイル名を修正
                    base_name = file_name.rsplit('.', 1)[0]
                    corrected_name = f"{base_name}_修正版.xlsx"
                    
                    # Excelファイルを作成
                    excel_buffer = io.BytesIO()
                    with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
                        df.to_excel(writer, index=False, sheet_name='照合結果')
                        
                        # ワークブックを取得してスタイルを適用
                        workbook = writer.book
                        worksheet = writer.sheets['照合結果']
                        
                        # ヘッダーのスタイル
                        header_font = Font(bold=True, color="FFFFFF")
                        header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
                        
                        for cell in worksheet[1]:
                            cell.font = header_font
                            cell.fill = header_fill
                    
                    excel_buffer.seek(0)
                    zip_file.writestr(corrected_name, excel_buffer.getvalue())
            
            zip_buffer.seek(0)
            st.download_button(
                label="📦 修正版ファイルをZIPでダウンロード",
                data=zip_buffer.getvalue(),
                file_name="JBA照合結果_修正版ファイル.zip",
                mime="application/zip"
            )
            
        except Exception as e:
            st.error(f"❌ エラーが発生しました: {str(e)}")
            st.error("詳細なエラー情報を確認してください")

if __name__ == "__main__":
    main()