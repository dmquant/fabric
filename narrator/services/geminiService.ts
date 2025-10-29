import { GoogleGenAI, Modality, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getLegacyPrompt = (reportContent: string) => `
    Based on the following financial report content, generate a single, self-contained, BILINGUAL (English/Chinese) HTML file for a professional market analysis report. The design should be a modern, dark-themed, single-page report exactly matching the provided style guide.

    Report Content:
    ---
    ${reportContent}
    ---

    Follow these requirements STRICTLY:

    1.  **Frameworks & Libraries:**
        *   Use Tailwind CSS, Google Material Symbols, the Inter font, and **Chart.js**, all included via their respective CDNs.
        *   All CSS and JavaScript MUST be embedded within the HTML file. No external files.

    2.  **Bilingual Support (English & Chinese - CRITICAL):**
        *   For EVERY piece of text that will be visible (headings, paragraphs, table headers, table data, list items), you MUST provide both English and Simplified Chinese (zh-CN) translations.
        *   Embed these translations directly into HTML elements using two data attributes: \`data-lang-en\` for English and \`data-lang-zh\` for Chinese.
        *   The initial visible text of the element should be the English version.
        *   **Charts must also be bilingual.** This includes the chart title, axis labels, and dataset labels.
        *   Example: \`<h2 data-lang-en="Sector Performance" data-lang-zh="板块表现">Sector Performance</h2>\`

    3.  **Language Switching JavaScript Function:**
        *   Embed a JavaScript function named \`setLanguage(lang)\` in the final \`<script>\` tag.
        *   This function must be attached to the window object: \`window.setLanguage = function(lang) { ... }\`.
        *   The function must query all elements with \`[data-lang-en]\` and update their \`innerText\` to the correct language.
        *   It must update the language switcher button's text.
        *   **CRITICALLY, it must also re-render the chart with the correct language configuration.**

    4.  **Theme & Styling:**
        *   Use this EXACT dark theme color palette: \`--background-color: #1a1d23;\`, \`--surface-color: #242831;\`, \`--text-primary: #f0f2f5;\`, \`--text-secondary: #9da6b9;\`, \`--secondary-color: #d4af37;\`.
        *   Apply these variables in a \`:root\` style block.
        *   **Title Styling:** All section titles (\`<h2>\` tags) MUST use the secondary color for their text. Apply the class \`text-[var(--secondary-color)]\`.
        *   **Chart Styling:** The chart MUST match the dark theme.
            *   Set global defaults: \`Chart.defaults.color = 'var(--text-secondary)';\`
            *   For scales (axes), set grid color to \`borderColor: 'rgba(255, 255, 255, 0.1)'\`.
            *   Tooltip background should be \`backgroundColor: 'var(--surface-color)'\`.
            *   **IMPORTANT:** Disable all chart animations by adding \`animation: { duration: 0 }\` to the main chart options. This is essential for the screenshot functionality to work correctly.

    5.  **Page Structure:**
        *   **Header:** A simple header containing the main report title and a language switcher button.
        *   **Main Content:** A single \`<main>\` element containing sections. Each key part of the report (like a chart or a table) should be in its own \`<section>\` tag for screenshotting.
        *   **NO FOOTER:** DO NOT include a \`<footer>\` element.

    6.  **Data Presentation (VERY IMPORTANT):**
        *   The report should consist of a main title, a descriptive paragraph, at least one chart, and one detailed table.
        *   **Chart Section:**
            *   Create a section with an \`<h2>\` title and a container (\`bg-[var(--surface-color)] p-4 rounded-lg\`).
            *   Inside the container, place a single \`<canvas id="reportChart"></canvas>\` element.
            *   Choose an appropriate chart type (e.g., bar, line) to visualize a key metric from the report.
        *   **Table Section:**
            *   Create another section for the table with an \`<h2>\` title.
            *   The table should be inside a container with a dark background, e.g., \`bg-[var(--surface-color)] p-4 rounded-lg\`.
            *   Style the table EXACTLY as follows: \`w-full text-left\`, \`<thead>\` with \`border-b border-white/10\`, \`<th>\` styled with emphasis, \`<tbody>\` rows with \`border-b border-white/10\`.
            *   **CRITICAL DETAIL:** The VERY LAST \`<tr>\` in the table body MUST NOT have a bottom border. Use the \`last:border-b-0\` class.
            *   **Conditional Coloring:** Numeric cells representing change must be colored: positive values with \`text-green-400\`, negative with \`text-red-400\`.

    7.  **Final JavaScript Block:**
        *   The script tag before \`</body>\` should contain:
            1.  A global variable for the chart instance, e.g., \`let reportChartInstance;\`.
            2.  A function to render the chart, e.g., \`renderChart(lang)\`. This function MUST:
                a. Check if \`reportChartInstance\` exists and destroy it (\`reportChartInstance.destroy()\`).
                b. Define two complete chart configuration objects: one for English (\`chartConfigEn\`) and one for Chinese (\`chartConfigZh\`). These configs must include translated titles, labels, etc.
                c. Select the correct config based on the \`lang\` parameter.
                d. Get the canvas context: \`const ctx = document.getElementById('reportChart').getContext('2d');\`
                e. Create the new chart: \`reportChartInstance = new Chart(ctx, selectedConfig);\`
            3.  The \`window.setLanguage = function(lang) { ... }\` implementation, which must call \`renderChart(lang)\` in addition to its other tasks.
            4.  A variable to track the current language, e.g., \`let currentLanguage = 'en';\`.
            5.  An event listener for DOMContentLoaded that calls \`renderChart('en')\` to draw the initial chart.

    Output ONLY the complete, raw HTML code. Do not wrap it in markdown backticks.
  `;

const getLiquidGlassPrompt = (reportContent: string) => `
    Based on the following financial report content, generate a single, self-contained, BILINGUAL (English/Chinese) HTML file for a "Liquid Glass" style market report. The design MUST be a modern, dark, "glassmorphism" style, exactly replicating the aesthetic of the provided example but WITHOUT any charts.

    Report Content:
    ---
    ${reportContent}
    ---

    Follow these requirements STRICTLY:

    1.  **Frameworks & Libraries:**
        *   Use Tailwind CSS and Google Fonts (Inter). All must be included via CDN.
        *   Do NOT include Chart.js or any other charting library.
        *   All CSS and JavaScript MUST be embedded within the single HTML file. No external files.

    2.  **Bilingual Support (English & Chinese - CRITICAL):**
        *   For EVERY visible text element (headings, paragraphs, labels, list items), you MUST provide both English and Simplified Chinese (zh-CN) translations.
        *   Embed these translations directly into HTML elements using two data attributes: \`data-lang-en\` for English and \`data-lang-zh\` for Chinese.
        *   The initial visible text of the element should be the English version.
        *   Example: \`<h2 data-lang-en="Major Indexes" data-lang-zh="主要指数">Major Indexes</h2>\`

    3.  **Language Switching JavaScript Function:**
        *   Embed a JavaScript function named \`setLanguage(lang)\` in the final \`<script>\` tag.
        *   This function MUST be attached to the window object: \`window.setLanguage = function(lang) { ... }\`.
        *   The function must query all elements with \`[data-lang-en]\` and update their \`innerText\` to the correct language.
        *   It must update the language switcher button's text.

    4.  **Theme & Styling (Glassmorphism - VERY IMPORTANT):**
        *   **Body/Page Background:** A very dark gray, almost black: \`bg-[#101010]\`.
        *   **Font:** 'Inter' from Google Fonts. Body text color: \`text-gray-200\`.
        *   **Main Container:** Center the content with \`max-w-7xl mx-auto p-4 sm:p-6 lg:p-8\`.
        *   **Cards ("Glass Panels"):** All content sections must be inside cards.
            *   Layout: Use CSS Grid for the main layout of cards, e.g., \`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6\`.
            *   Styling: Apply these classes for the glass effect: \`bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6\`. The background color is a semi-transparent light gray.
        *   **Typography:**
            *   Report Title (\`<h1>\`): Large, bold, white, centered. E.g., \`text-3xl md:text-4xl font-bold text-white text-center\`.
            *   Section Titles (\`<h2>\`): Smaller, medium weight, gray, often with an emoji. E.g., \`text-lg font-medium text-gray-400 mb-4 flex items-center gap-2\`.
            *   Primary Values (Prices): Large, bold, white. E.g., \`text-3xl font-bold text-white\`.
            *   Secondary Text (Tickers, Volume): Small, light gray. E.g., \`text-sm text-gray-400\`.
        *   **Conditional Colors:**
            *   Positive values (gains): Use a vibrant green. E.g., \`bg-green-500/20 text-green-400\` for pills, or just \`text-green-400\` for text.
            *   Negative values (losses): Use a vibrant red. E.g., \`bg-red-500/20 text-red-400\` for pills, or just \`text-red-400\` for text.

    5.  **Component Structure (Replicate the example):**
        *   **Header:** Main title and subtitle.
        *   **Language Switcher:** A simple button at the top.
        *   **Card Sections:** Each logical group (e.g., "Major Indexes", "Top Gainers") must be in its own \`<section>\` tag for screenshotting.
        *   **Index/Stock Cards:**
            *   Should contain a heading (e.g., Dow Jones), a ticker, the main price, the change (value and percentage in a colored pill), and volume info.
            *   **DO NOT include any charts or canvas elements.**
        *   **List Cards (Gainers/Losers):**
            *   Use a container for list items. Each item is a flex row.
            *   Include rank, name/ticker, price, and percentage change (in a colored pill).
            *   Use a faint border between items: \`border-b border-white/10\`. The last item MUST NOT have a border (\`last:border-b-0\`).
        *   **NO FOOTER:** Do not include a \`<footer>\` element.

    6.  **Final JavaScript Block:**
        *   The script tag before \`</body>\` should contain:
            1.  The \`window.setLanguage = function(lang) { ... }\` implementation.
            2.  An event listener for DOMContentLoaded that sets the initial language.

    Output ONLY the complete, raw HTML code. Do not wrap it in markdown backticks.
`;

const getInfographicPrompt = (reportContent: string) => `
    Based on the following financial report content, generate a single, self-contained, BILINGUAL (English/Chinese) HTML file. The visual output MUST EXACTLY match the provided infographic-style example in terms of layout, colors, fonts, and components.

    Report Content to use for data:
    ---
    ${reportContent}
    ---

    Your task is to populate a new HTML structure with data from the report above, while strictly adhering to the style, layout, and components of the example below.

    Follow these rules STRICTLY:

    1.  **Bilingual Requirement (CRITICAL):**
        *   Every piece of visible text MUST have both English and Simplified Chinese (zh-CN) translations.
        *   Embed these translations using \`data-lang-en\` and \`data-lang-zh\` attributes. The visible text should initially be English.
        *   Example: \`<h2 data-lang-en="Market Summary" data-lang-zh="市场摘要">Market Summary</h2>\`

    2.  **Language Switching JavaScript & Button:**
        *   **Add a language switcher button** to the top of the page. It should be a floating button in the top-right corner. Style it with a semi-transparent background, white text, and rounded corners to fit the theme.
        *   The button's text must update based on the language. It should show "EN / ZH" when English is active and "英 / 中" when Chinese is active.
        *   Embed a JavaScript function named \`setLanguage(lang)\` in a \`<script>\` tag before \`</body>\`. This function will be called by the button.
        *   The script must contain the \`setLanguage\` function, which queries all elements with \`[data-lang-en]\` and updates their \`innerText\` based on the 'en' or 'zh' input.
        *   The script must also include the logic for the button to toggle between 'en' and 'zh' and call \`setLanguage\`.
        *   The \`setLanguage\` function MUST be attached to the window object: \`window.setLanguage = function(lang) { ... }\`.

    3.  **Styling and Structure:**
        *   Replicate the EXACT structure and styling from the example. Use Tailwind CSS, Google Fonts (Roboto), and Material Icons, all loaded from CDNs.
        *   Main body background: \`#3B4B5A\`.
        *   Card background: \`#E8EBF0\`.
        *   Use the same grid layout (\`lg:grid-cols-3\`), card design, headers with icons, tables, and lists.
        *   Positive numbers MUST be green (\`#22c55e\`), and negative numbers MUST be red (\`#ef4444\`). Apply this to text and icons (\`arrow_upward\`, \`arrow_downward\`).
        *   Include a footer with data sources (make it bilingual).

    **HTML Example to Replicate (use this for structure and style, NOT for data):**
    \`\`\`html
    <!DOCTYPE html>
    <html lang="en"><head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title>U.S. Financial Markets</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet"/>
    <style>
            body {
                font-family: 'Roboto', sans-serif;
                background-color: #3B4B5A;
            }
            .card {
                background-color: #E8EBF0;
                border-radius: 0.5rem;
                padding: 1.5rem;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .card-header {
                display: flex;
                align-items: center;
                margin-bottom: 1rem;
                font-weight: 700;
                color: #2c3e50;
                font-size: 1.125rem;
            }
            .card-header .material-icons {
                margin-right: 0.5rem;
                color: #3B4B5A;
            }
            .text-positive {
                color: #22c55e;
            }
            .text-negative {
                color: #ef4444;
            }
            .icon-up {
                color: #22c55e;
            }
            .icon-down {
                color: #ef4444;
            }
        </style>
    </head>
    <body class="p-4 md:p-8">
    <div class="max-w-7xl mx-auto">
    <h1 class="text-3xl md:text-4xl font-bold text-white text-center mb-8">U.S. FINANCIAL MARKETS: SEPT. 4, 2025 - RECORD HIGHS & SHIFTING WINDS</h1>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="lg:col-span-1 space-y-6">
    <div class="card">
    <div class="card-header">
    <span class="material-icons">trending_up</span>
    <h2>MARKET SUMMARY</h2>
    </div>
    </div>
    <div class="card">
    <div class="card-header">
    <span class="material-icons">bar_chart</span>
    <h2>INDEX PERFORMANCE</h2>
    </div>
    </div>
    <div class="card">
    <div class="card-header">
    <span class="material-icons">paid</span>
    <h2>COMMODITIES & CRYPTO</h2>
    </div>
    </div>
    </div>
    <div class="lg:col-span-2 space-y-6">
    <div class="card">
    <div class="card-header">
    <h2 class="mr-auto">KEY MARKET DRIVERS</h2>
    </div>
    </div>
    <div class="card">
    <div class="card-header">
    <span class="material-icons">star</span>
    <h2>MAGNIFICENT 7 PERFORMANCE</h2>
    </div>
    </div>
    <div class="card">
    <div class="card-header">
    <span class="material-icons">pie_chart</span>
    <h2>SECTOR PERFORMANCE & OUTLOOK</h2>
    </div>
    </div>
    </div>
    </div>
    <footer class="text-center text-xs text-gray-300 mt-8">
                Data as of September 4, 2025. Sources: Reuters, TradingEconomics.com, TwlerData.com, Finviz.com, Stockanalyis.com
            </footer>
    </div>
    </body></html>
    \`\`\`

    Output ONLY the complete, raw HTML code. Do not wrap it in markdown backticks.
    `;

const getDailyReportPrompt = (reportContent: string) => `
    Based on the following financial report content, generate a single, self-contained, BILINGUAL (English/Chinese) HTML file for a comprehensive "Daily Market Report". The design MUST be a modern, dark-themed, single-page report that combines various components from the provided style guide into one cohesive page. This report should NOT contain any charts or canvas elements.

    Report Content:
    ---
    ${reportContent}
    ---

    Follow these requirements STRICTLY:

    1.  **Frameworks & Libraries:**
        *   Use Tailwind CSS and Google Material Symbols. All must be included via CDN.
        *   Do NOT include Chart.js or any other charting library.
        *   All CSS and JavaScript MUST be embedded within the single HTML file. No external files.

    2.  **Bilingual Support (English & Chinese - CRITICAL):**
        *   For EVERY visible text element (headings, paragraphs, labels, list items), you MUST provide both English and Simplified Chinese (zh-CN) translations.
        *   Embed these translations directly into HTML elements using two data attributes: \`data-lang-en\` for English and \`data-lang-zh\` for Chinese.
        *   The initial visible text of the element should be the English version.
        *   Example: \`<h2 data-lang-en="Market Overview" data-lang-zh="市场概览">Market Overview</h2>\`

    3.  **Language Switching JavaScript Function:**
        *   Embed a JavaScript function named \`setLanguage(lang)\` in the final \`<script>\` tag.
        *   This function MUST be attached to the window object: \`window.setLanguage = function(lang) { ... }\`.
        *   The function must query all elements with \`[data-lang-en]\` and update their \`innerText\` to the correct language.
        *   It must update the language switcher button's text.

    4.  **Theme & Styling:**
        *   **Body/Page Background:** A dark blue-gray: \`bg-[#111a22]\`.
        *   **Font:** 'Inter' from Google Fonts. Body text color: \`text-[#92adc9]\` for secondary text and \`text-white\` for primary text.
        *   **Glassmorphism Cards:** For lists like Movers, use a semi-transparent background with a blur effect. E.g., \`bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4\`.
        *   **Typography:**
            *   Section Titles (\`<h2>\`): Large, bold, white. E.g., \`text-white text-2xl font-bold leading-tight tracking-tight\`.
        *   **Conditional Colors:**
            *   Positive values (gains): Use a vibrant green. E.g., \`text-green-400\`.
            *   Negative values (losses): Use a vibrant red. E.g., \`text-red-400\`.

    5.  **Page & Component Structure (Combine these sections in order):**
        *   **Header:** Include a main title for the report and a language switcher button.
        *   **Market Overview Section:**
            *   This section (\`<section>\`) should feature a large background image with a gradient overlay, similar to a hero banner.
            *   Inside, include a title like "Market Highlights" and a descriptive paragraph summarizing the day's key events.
        *   **Indexes Section:**
            *   This section (\`<section>\`) should display cards for major indexes (e.g., Nasdaq, S&P 500, Dow Jones).
            *   Each card should have a "glassmorphism" style.
            *   Inside each card, display the index name, its current value, and the daily change (value and percentage, colored appropriately).
        *   **Top Movers Section:**
            *   This section (\`<section>\`) should contain two sub-sections or lists: "Top Advancers" and "Top Decliners".
            *   Each list item should be a "glassmorphism" card showing the company name, ticker, and the percentage change (colored green for advancers, red for decliners).
        *   **Magnificent 7 Section:**
            *   This section (\`<section>\`) should list the "Magnificent 7" stocks.
            *   Each list item should display the company name, ticker, and a pill-shaped element showing the daily percentage change, with a background color corresponding to the change (e.g., \`bg-green-500/20\` for positive).
        *   **Sector Performance Section:**
            *   This section (\`<section>\`) should show the performance of various market sectors.
            *   For each sector, display its name, a horizontal progress bar indicating its performance, and the percentage change value.
            *   The progress bar should be green for positive performance and red for negative. E.g., \`<div class="h-2.5 rounded-full bg-green-500" style="width: 85%"></div>\`.
        *   **Commodities & Crypto Section:**
             *   This section (\`<section>\`) should have two sub-sections: "Commodities" and "Cryptocurrencies".
             *   Each item (e.g., Gold, WTI Crude Oil, Bitcoin) should be a card-like row containing an icon, the name, the price, and the daily change (value and percentage, colored appropriately).

    6.  **Final JavaScript Block:**
        *   The script tag before \`</body>\` should contain:
            1.  The \`window.setLanguage = function(lang) { ... }\` implementation.
            2.  An event listener for DOMContentLoaded that sets the initial language.

    Output ONLY the complete, raw HTML code. Do not wrap it in markdown backticks.
`;

const getNarrationScriptPrompt = (htmlContent: string) => `
    Based on the content of the following HTML financial report, generate a detailed and engaging bilingual (English and Chinese) narration script.
    The script should be suitable for a text-to-speech summary, like a professional financial news segment.

    **CRITICAL REQUIREMENTS:**
    1.  **Sequential Narration:** The script MUST follow the logical flow and structure of the HTML report. Narrate the sections (like Market Overview, Index Performance, Top Movers, etc.) in the exact order they appear in the provided HTML.
    2.  **Length:** Each language's script (both English and Chinese) MUST be approximately 60 seconds long when spoken at a natural pace. This translates to roughly 150 words per language. To achieve this, expand on the data in each section rather than just listing it.
    3.  **Format:** The output MUST be in the following format. First, provide the full English script under a heading \`English:\`. Then, provide the full Simplified Chinese script under a heading \`Chinese:\`. Do not interleave the languages.

    Example Format:
    English:
    Good morning, and welcome to your daily market wrap. We'll start with the overall market trend, which showed mixed signals across the board. The S&P 500 closed slightly higher... Moving on to the top performers, shares of Acme Corp surged over 15% on positive earnings news... In the commodities sector, gold prices remained steady... (and so on, following the HTML order to reach about 150 words)

    Chinese:
    早上好，欢迎收听您的每日市场总结。我们首先来看整体市场趋势，今天市场整体表现好坏参半。标准普尔500指数小幅收高... 接着是表现最好的股票，Acme公司的股价在利好财报消息的推动下飙升超过15%... 在大宗商品方面，黄金价格保持稳定... (and so on, following the HTML order to reach about 150 words)

    HTML Content:
    ---
    ${htmlContent}
    ---
`;

const get3dSceneDataPrompt = (reportContent: string, theme: string) => {
  if (theme === 'showroom') {
    return `
      Analyze the financial report and generate a structured JSON object for a 3D "art gallery/showroom" visualization. The output must be a single, raw JSON object. All text content (titles, labels, narration) MUST be in Simplified Chinese.

      Report Content:
      ---
      ${reportContent}
      ---

      JSON Structure Requirements:

      1.  **"theme" object:**
          - "name": "showroom".
          - "colors": { "wall": "#2d323b", "floor": "#4a505c", "ceiling": "#22262e", "accent": "#D4AF37", "slide_bg_start": "#252930", "slide_bg_end": "#1a1d23", "text_primary": "#E0E0E0", "text_secondary": "#cccccc", "footer_text": "#666" }. Use hex strings.

      2.  **"title" string:**
          - The main title of the report in Simplified Chinese.

      3.  **"speakers" array (CRITICAL):**
          - An array of EXACTLY TWO speaker objects.
          - Each object must have:
            - "name": A Chinese name for the analyst (e.g., "林悦" for female, "陈宇" for male).
            - "voice": A valid voice name from this list: "Kore" (Female), "Puck" (Male), "Charon" (Female), "Zephyr" (Male). Choose one male and one female voice.
            - "shirtColor": A hex color string for the character's shirt.

      4.  **"dialogue" array (CRITICAL):**
          - An array of dialogue turns to form a conversational, podcast-style narration.
          - Each object in the array represents one turn and MUST have:
            - "sceneId": The 'id' of the slide this dialogue refers to.
            - "speaker": The name of the speaker for this turn (must match a name from the "speakers" array).
            - "text": A 1-3 sentence narration script (in Chinese) for this speaker turn.
          - The dialogue should flow naturally, with speakers building on each other's points as they explain the slides. The dialogue must cover all slides.

      5.  **"slides" array (VERY IMPORTANT):**
          - An array of 10-12 slide objects to populate the showroom walls.
          - Each object represents a slide and MUST have:
              - "id": A unique lowercase string identifier (e.g., "market_summary").
              - "type": A string, either "chart" or "text".
              - "title": The slide's title (in Chinese).
          - If "type" is "text":
              - It must have a "content" property (array of strings in Chinese). Use bullet points '• ' where appropriate for lists.
          - If "type" is "chart":
              - It must have a "chartJsConfig" property.
              - **CRITICAL:** The "chartJsConfig" MUST be a complete and valid configuration object for Chart.js.
              - In "chartJsConfig.options", you MUST include "animation: { duration: 0 }", "responsive: false".
              - **STYLES:** The chart must be styled for a dark theme:
                - "plugins.legend.labels.color": "#dddddd"
                - "scales.x.ticks.color": "#cccccc"
                - "scales.x.grid.color": "rgba(255, 255, 255, 0.1)"
                - "scales.y.ticks.color": "#cccccc"
                - "scales.y.grid.color": "rgba(255, 255, 255, 0.1)"
    `;
  }
  
  return `
    Analyze the provided financial report and generate a structured BILINGUAL (English/Chinese) JSON object for a 3D "financial news studio" visualization. The output must be a single, raw JSON object, not wrapped in markdown.

    Report Content:
    ---
    ${reportContent}
    ---

    **JSON Structure Requirements:**
    The output MUST be a single JSON object with four top-level keys: "theme", "title", "narratorScript", and "dataRows".

    1.  **"theme" object:**
        Based on the selected theme ("${theme}"), define a color palette.
        -   **Cyberpunk Neon**: Use vibrant, glowing colors like magenta, cyan, and lime on a very dark background. (e.g., primary: "#ff00ff", secondary: "#00ffff", text: "#f0f0f0", positive: "#00ff00", negative: "#ff4444", background: "#0a0a1a", grid: "#440088")
        -   **Corporate Blue**: Use a clean, professional palette of blues, grays, and white. (e.g., primary: "#00529b", secondary: "#00a2e8", text: "#102030", positive: "#22a55e", negative: "#d44c4c", background: "#e8f0f5", grid: "#c0d0e0")
        -   **Lush Nature**: Use earthy tones like greens, browns, and amber. (e.g., primary: "#4caf50", secondary: "#8bc34a", text: "#ffffff", positive: "#8bc34a", negative: "#f44336", background: "#212b21", grid: "#445544")
        The theme object must contain: \`name\`, \`primary\`, \`secondary\`, \`text\`, \`positive\`, \`negative\`, \`background\`, \`grid\`. All values must be hex color strings. The 'name' must be the provided theme.

    2.  **"title" object:**
        - The main title of the report.
        - Properties: \`en\` (string), \`zh\` (string).

    3.  **"narratorScript" object:**
        - Lines of text for a scrolling narrator screen. It should be a concise summary of the report.
        - Properties: \`en\` (array of strings), \`zh\` (array of strings).

    4.  **"dataRows" array:**
        - An array of objects, where each object represents a thematic row of data points in the 3D scene.
        - **Use these specific category titles where applicable**: "Market Indexes", "Commodities", "Major Stocks", "Sector Performance", "Magnificent 7".
        - Each row object must have:
            - \`category\`: An object with \`en\` and \`zh\` string properties for the row's title.
            - \`items\`: An array of data point objects. Each item represents one 3D shape.
                - \`id\`: A unique lowercase string identifier (e.g., "dow_jones").
                - \`label\`: An object with \`en\` and \`zh\` string properties (e.g., "Dow Jones", "道琼斯").
                - \`value\`: A **number** representing the percentage change (e.g., for +0.47% use 0.47, for -5.5% use -5.5). The 3D object's height will be based on this value.
                - \`color\`: A hex color string for the 3D object.
  `;
};

const getAutoPresentationPrompt = (reportContent: string, language: 'en' | 'zh'): string => `
You are an AI assistant that transforms a detailed financial report into a script for a dynamic, narrated video presentation.
Based on the report content below, generate a structured JSON object.

Report Content:
---
${reportContent}
---

The JSON object must contain a single key: "scenes". "scenes" is an array of 6 to 8 scene objects.
The entire presentation should tell a coherent story, starting with a summary, moving to details, and ending with an outlook.

Each scene object in the array must have the following structure:
- "id": A unique string identifier (e.g., "scene_1_indices").
- "type": A string representing the scene layout. Choose from: "TITLE_CARD", "KEY_METRICS", "LIST", "BAR_CHART", "OUTLOOK", "SINGLE_FOCUS".
- "title": A short, impactful title for the scene (in ${language === 'en' ? 'English' : 'Simplified Chinese'}).
- "narration": A 1-2 sentence narration script for this scene (in ${language === 'en' ? 'English' : 'Simplified Chinese'}). This will be used for text-to-speech.
- "data": An object containing the data needed to render the scene. The structure of "data" depends on the "type":
  - For "TITLE_CARD": { "subtitle": "A short subtitle" }
  - For "KEY_METRICS": { "metrics": [{ "label": "Dow Jones", "value": "~46,590", "change": "-0.7%" }, { "label": "S&P 500", "value": "~6,699", "change": "-0.5%" }] } (Array of 2-3 metrics)
  - For "LIST": { "items": [{ "name": "Intuitive Surgical (ISRG)", "detail": "+13.9%" }, {"name": "Microsoft (MSFT)", "detail": "+0.6%"}] } (Array of items)
  - For "BAR_CHART": { "bars": [{ "label": "Technology", "value": -1.3, "color": "red" }, { "label": "Consumer Staples", "value": 0.8, "color": "green" }] } (Array of bars, value is a number for scaling, color can be 'red' or 'green')
  - For "OUTLOOK": { "points": [{ "title": "CPI Data", "detail": "Released Oct 24" }, {"title": "Fed FOMC Meeting", "detail": "Oct 28-29"}] } (Array of 2-3 future events)
  - For "SINGLE_FOCUS": { "label": "Netflix (NFLX)", "value": "-10%", "description": "Guidance disappoints investors" } (A single key data point)

CRITICAL: All text content ("title", "narration", and all strings within "data") MUST be in ${language === 'en' ? 'English' : 'Simplified Chinese'}.
Output ONLY the raw JSON object. Do not use markdown backticks.
`;

export const generateHtmlReport = async (reportContent: string, model: string, template: string): Promise<string> => {
  let prompt: string;
  switch (template) {
    case 'daily-report':
      prompt = getDailyReportPrompt(reportContent);
      break;
    case 'infographic':
      prompt = getInfographicPrompt(reportContent);
      break;
    case 'liquid-glass':
      prompt = getLiquidGlassPrompt(reportContent);
      break;
    case 'legacy':
    default:
      prompt = getLegacyPrompt(reportContent);
      break;
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    
    let htmlContent = response.text;
    
    // Clean up potential markdown formatting from the response
    if (htmlContent.startsWith('```html')) {
        htmlContent = htmlContent.substring(7);
    }
    if (htmlContent.endsWith('```')) {
        htmlContent = htmlContent.substring(0, htmlContent.length - 3);
    }

    return htmlContent.trim();
  } catch (error) {
    console.error("Error generating HTML report:", error);
    throw new Error("Failed to generate HTML report from Gemini API.");
  }
};

export const generateNarrationScript = async (htmlContent: string): Promise<string> => {
  const prompt = getNarrationScriptPrompt(htmlContent);
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Use a fast model for this task
      contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error generating narration script:", error);
    throw new Error("Failed to generate narration script from Gemini API.");
  }
};

export const generateSpeech = async (script: string, voice: string): Promise<{ data: string; mimeType: string; }> => {
  if (!script || !voice) {
    throw new Error("Script and voice must be provided.");
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: script }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });
    
    const audioPart = response.candidates?.[0]?.content?.parts?.[0];
    const base64Audio = audioPart?.inlineData?.data;
    const mimeType = audioPart?.inlineData?.mimeType;

    if (!base64Audio || !mimeType) {
      throw new Error("No audio data received from API.");
    }
    return { data: base64Audio, mimeType: mimeType };
  } catch (error) {
    console.error("Error generating speech:", error);
    throw new Error("Failed to generate speech from Gemini API.");
  }
};

export const generatePodcastSpeech = async (dialogue: any[], speakers: any[]): Promise<{ data: string; mimeType: string; }> => {
  if (!dialogue || dialogue.length === 0 || !speakers || speakers.length === 0) {
    throw new Error("Dialogue and speakers must be provided for podcast generation.");
  }
  
  const ttsPrompt = dialogue.map(turn => `${turn.speaker}: ${turn.text}`).join('\n');
  const fullPrompt = `TTS the following conversation:\n${ttsPrompt}`;
  
  const speakerVoiceConfigs = speakers.map(speaker => ({
    speaker: speaker.name,
    voiceConfig: {
      prebuiltVoiceConfig: { voiceName: speaker.voice }
    }
  }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: fullPrompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: speakerVoiceConfigs
          }
        }
      }
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.[0];
    const base64Audio = audioPart?.inlineData?.data;
    const mimeType = audioPart?.inlineData?.mimeType;

    if (!base64Audio || !mimeType) {
      throw new Error("No audio data received from API for podcast.");
    }
    return { data: base64Audio, mimeType: mimeType };
  } catch (error) {
    console.error("Error generating podcast speech:", error);
    throw new Error("Failed to generate podcast speech from Gemini API.");
  }
};


export const generate3dSceneData = async (reportContent: string, theme: string): Promise<any> => {
  const prompt = get3dSceneDataPrompt(reportContent, theme);
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text.trim();
    return JSON.parse(responseText);
  } catch (error) {
    console.error("Error generating 3D scene data:", error);
    throw new Error("Failed to generate 3D scene data from Gemini API. The model may have returned an invalid JSON format.");
  }
};

export const generateAutoPresentation = async (reportContent: string, language: 'en' | 'zh'): Promise<any> => {
    // 1. Generate the structured scene data and narration
    const sceneDataPrompt = getAutoPresentationPrompt(reportContent, language);
    const sceneDataResponse = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: sceneDataPrompt,
        config: { responseMimeType: 'application/json' }
    });
    const presentation = JSON.parse(sceneDataResponse.text.trim());

    // 2. Generate background images for each scene
    for (const scene of presentation.scenes) {
        const imagePrompt = `A sophisticated, abstract background image for a financial report slide. The topic is "${scene.title}". The mood should be professional and cinematic. Use dark tones with highlights related to the content. For example, use abstract red light trails for market downturns and green glowing particles for growth. Do not include any text in the image.`;
        
        try {
            const imageResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: imagePrompt }] },
                config: { responseModalities: [Modality.IMAGE] },
            });

            const imagePart = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart?.inlineData) {
                const base64ImageBytes: string = imagePart.inlineData.data;
                scene.backgroundImage = `data:image/jpeg;base64,${base64ImageBytes}`;
            } else {
                 scene.backgroundImage = 'bg-gray-900'; // Fallback
            }
        } catch (imgError) {
             console.error(`Failed to generate image for scene "${scene.title}":`, imgError);
             scene.backgroundImage = 'bg-gray-900'; // Fallback
        }
    }
    return presentation;
};