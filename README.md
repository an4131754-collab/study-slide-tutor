# Study Slide Tutor

Study Slide Tutor 是一個 Codex skill，用來把英文課堂簡報變成繁體中文助教式講解。

它不是單純翻譯工具，而是針對「看英文投影片很吃力，但需要讀懂、寫作業、準備考試」的情境設計。

## 功能

- 支援 PDF、PPTX、單張圖片、圖片資料夾。
- 會先整理出穩定的 `manifest.json`，包含頁碼、抽取文字、可用的頁面圖片與處理警告。
- 預設一次只教一頁，避免輸出太密集。
- 每頁先完整翻譯，再用白話講解。
- 重要專有名詞會保留英文原文。
- 會整理核心重點、可能考點、容易混淆的地方。
- 遇到公式、演算法、流程圖、數學、物理、網路或資料結構內容，會一步一步示範，不跳步。

## 安裝

把這個 repo clone 或複製到 Codex 的 skills 目錄。

Windows 範例：

```powershell
git clone https://github.com/an4131754-collab/study-slide-tutor.git C:\Users\USER\.codex\skills\study-slide-tutor
```

也可以手動把 `study-slide-tutor` 資料夾複製到：

```text
C:\Users\USER\.codex\skills\study-slide-tutor
```

安裝後，重新開啟 Codex 或開一個新的 thread，讓技能列表重新載入。

## 使用方式

在 Codex 裡可以這樣呼叫：

```text
Use $study-slide-tutor to teach me this English lecture deck in Traditional Chinese, page by page.
```

接著附上或指定 PDF、PPTX、圖片資料夾。

skill 會先準備整份簡報，然後從第 1 頁開始教。你說「下一頁」或「繼續」時，它會接著講下一頁。

## PDF 渲染與 Poppler

這個 skill 可以直接從很多 PDF 抽取文字，不一定需要額外安裝工具。

但如果投影片有圖表、公式、流程圖、版面配置，將 PDF 每頁轉成圖片會更可靠。Windows 建議用 Scoop 安裝 Poppler：

```powershell
scoop install poppler
```

準備腳本會自動偵測常見的 Scoop Poppler 路徑，例如：

```text
C:\Users\USER\scoop\apps\poppler\current\bin
```

可以用以下指令確認 Poppler 是否可用：

```powershell
pdftoppm -h
```

如果有顯示說明文字，就代表 Poppler 可以被找到。

## 內含檔案

```text
study-slide-tutor/
  SKILL.md
  agents/openai.yaml
  scripts/prepare_study_deck.mjs
```

`SKILL.md` 定義助教式講解規則與輸出格式。

`scripts/prepare_study_deck.mjs` 會把 PDF、PPTX 或圖片整理成頁面 manifest，讓 Codex 可以穩定地一頁一頁教。

## 注意事項

- 預設輸出在聊天中，不會另外產生 Markdown 筆記檔。
- 預設一次只教一頁。
- skill 會先讀完整 manifest 理解整份講義脈絡，但不會一次把多頁全部講完，除非你明確要求。
- 如果圖片文字看不清楚，skill 應該直接說看不清楚，不會自行猜測。
- 如果 PDF 無法渲染成圖片，仍可先用抽取文字教學，但含圖表或公式的頁面可能需要補充截圖或安裝 Poppler。
