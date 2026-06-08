# Study Slide Tutor

Study Slide Tutor 是一個 Codex skill，用來把英文課堂簡報變成繁體中文助教式講解。

它不是單純翻譯工具，而是針對「看英文投影片很吃力，但需要讀懂、寫作業、準備考試」的情境設計。

## 功能

- 支援 PDF、PPTX、單張圖片、圖片資料夾。
- 會先整理出穩定的輕量 `manifest.json`，包含頁碼、文字檔路徑、圖片路徑與處理警告。
- PDF 每頁文字會存到 `page-text/page-0001.txt`，不會塞進 manifest 裡。
- PDF 預設按需產生頁面圖片，不會一開始把整份 PDF 全部轉成 PNG。
- 如果本機可用 MarkItDown，會額外把文件轉成 `document.md`，讓 AI 更容易讀取標題、列表、表格與文字結構。
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

但如果投影片有圖表、公式、流程圖、版面配置，將 PDF 當前頁轉成圖片會更可靠。Windows 建議用 Scoop 安裝 Poppler：

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

預設準備 PDF 時不會全頁轉圖：

```powershell
node C:\Users\USER\.codex\skills\study-slide-tutor\scripts\prepare_study_deck.mjs `
  --input path-to-file.pdf `
  --out-dir path-to-output-folder
```

教第 N 頁前，按需產生第 N 頁到第 N+5 頁圖片：

```powershell
node C:\Users\USER\.codex\skills\study-slide-tutor\scripts\prepare_study_deck.mjs `
  --manifest path-to-output-folder\manifest.json `
  --ensure-page 12 `
  --prefetch-pages 5
```

如果你真的想一次產生全部頁面圖片，仍可手動指定：

```powershell
node C:\Users\USER\.codex\skills\study-slide-tutor\scripts\prepare_study_deck.mjs `
  --input path-to-file.pdf `
  --out-dir path-to-output-folder `
  --render-pdf always
```

## Markdown 轉換與 MarkItDown

這個 skill 會優先嘗試使用 Microsoft 的 MarkItDown，把 PDF、PPTX 等檔案轉成 Markdown。

Markdown 對 AI 比較友善，因為它比原始 PDF 更接近純文字，也能保留標題、列表、表格等結構。轉換成功時，`manifest.json` 會包含：

```json
{
  "markdownStatus": "ready",
  "markdownPath": ".../document.md"
}
```

如果你已經下載 Microsoft MarkItDown 原始碼，可以讓準備腳本直接使用那份 source checkout：

```powershell
node C:\Users\USER\.codex\skills\study-slide-tutor\scripts\prepare_study_deck.mjs `
  --input path-to-file.pdf `
  --out-dir path-to-output-folder `
  --markitdown-source C:\path\to\markitdown
```

以 PDF 為例，腳本會優先使用較小的 `markitdown[pdf]` 依賴，不會一律拉完整的 `markitdown[all]`。PPTX 則使用 `markitdown[pptx]`。這樣比較適合日常讀講義，速度與成功率都會比較好。

也可以直接安裝 MarkItDown 指令：

```powershell
pip install "markitdown[all]"
```

如果你有 `uvx`，腳本也會在可用時嘗試較精簡的格式，例如 PDF：

```powershell
uvx --from "markitdown[pdf]" markitdown path-to-file.pdf -o document.md
```

MarkItDown 不是必須安裝。沒有 MarkItDown 時，skill 仍會用 PDF 文字抽取與 Poppler 頁面圖片繼續運作。

實際教學時，最適合 AI 的格式是混合使用：

- `manifest.json`：只當索引，記錄頁碼、路徑、狀態與大小。
- `page-text/page-0001.txt`：教某一頁時才讀該頁文字，並預設讀前 2 頁文字補上下文。
- `pages/page-0001.png`：看方塊圖、公式、箭頭、版面與圖片內容，預設按需產生。
- `document.md`：讀標題、段落、列表、表格，用來理解整份文件結構。

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
- skill 會先讀 manifest 索引理解頁面狀態，但不會一次讀完整講義文字。
- 教第 N 頁時，skill 會讀第 N 頁與前 2 頁的 `page-text`，避免上下文斷掉。
- 如果 `document.md` 產生成功，skill 會用 Markdown 理解文字結構，再看當頁圖片確認圖表、公式與版面。
- 如果圖片文字看不清楚，skill 應該直接說看不清楚，不會自行猜測。
- 如果 PDF 無法渲染成圖片，仍可先用 `page-text` 教學，但含圖表或公式的頁面可能需要補充截圖或安裝 Poppler。
