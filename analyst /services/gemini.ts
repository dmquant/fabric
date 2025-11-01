
import { GoogleGenAI, Type } from "@google/genai";
import { Task } from "../types";

// Fix: Initialize the GoogleGenAI client with a named apiKey parameter.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
// Fix: Use the recommended 'gemini-2.5-pro' model.
const model = "gemini-2.5-pro";

export const generatePlan = async (symbol: string, fmpData?: string): Promise<{ description: string }[]> => {
  const fmpContext = fmpData
    ? `
In conjunction with your web search, analyze the following structured financial data for the company. This includes annual/quarterly figures and the last four earnings call transcripts. Use this quantitative and qualitative data to identify specific trends, anomalies, or areas that require deeper investigation.
---
${fmpData}
---
`
    : '';

  const prompt = `You are a senior financial analyst. Your goal is to create a highly specific and timely research plan for the company with stock symbol "${symbol}".

**Step 1: Initial Triage & Analysis**
First, perform a preliminary web search to understand the latest news, market sentiment, recent analyst ratings, and any significant events (e.g., earnings announcements, M&A activity, regulatory news) for "${symbol}".
${fmpContext}

**Step 2: Generate the Research Plan**
Based on your initial web search and the provided financial data (if any), generate a detailed, step-by-step research plan. The plan should be dynamic and tailored to the most current information. Do not generate generic tasks. Instead, create tasks that directly investigate the specific findings from your initial analysis.

For example:
- If you find news about a new competitor, create a task to "Analyze the competitive threat posed by [New Competitor]'s recent product launch."
- If the financial data shows a sudden drop in quarterly margins, create a task to "Investigate the primary drivers for the margin contraction in the latest quarter, referencing management's commentary from the earnings call."
- If you see a major stock price movement, create a task to "Identify the catalyst for the recent significant stock price change."

If comprehensive financial data and earnings transcripts are not provided via context, ensure one of the primary research tasks is to locate and summarize them from the company's official investor relations website.

The plan must still cover core areas (Performance, Competition, Strategy, Risks, etc.), but each task should be specific and data-driven, informed by your initial triage.

**Output Format:**
Your final response MUST be a single JSON object inside a markdown code block. The JSON object must conform to this structure:
{
  "tasks": [
    { "description": "A clear, concise, and actionable research task." }
  ]
}
Do not include any other text or explanation outside of the JSON markdown block.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let text = response.text.trim();
    // Extract JSON from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
        text = jsonMatch[1];
    }

    const json = JSON.parse(text);
    if (json.tasks && Array.isArray(json.tasks)) {
      return json.tasks.filter((task: any) => typeof task.description === 'string');
    }
    throw new Error("Invalid plan structure received from API.");
  } catch (error) {
    console.error("Error generating research plan:", error);
    throw new Error(`Failed to generate a research plan for ${symbol}.`);
  }
};

export const executeResearch = async (taskDescription: string, symbol: string, fmpData?: string): Promise<string> => {
    const fmpContext = fmpData
    ? `
Use the following structured financial data and earnings call transcripts as context for your research. Refer to it to ground your answer in quantitative and qualitative facts where relevant. Do not simply repeat the data; use it to inform your analysis.
---
${fmpData}
---
`
    : '';

  const prompt = `Using the latest available information, perform the following research task for the company with stock symbol "${symbol}":

Task: ${taskDescription}

${fmpContext}

Provide a detailed, well-structured answer based on your research.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return response.text;
  } catch (error) {
    console.error(`Error executing research task "${taskDescription}":`, error);
    throw new Error(`Failed to execute research task: "${taskDescription}".`);
  }
};

export const executeGeneralResearch = async (symbol: string, fmpData?: string): Promise<string> => {
  const fmpContext = fmpData ? `
**Use the following structured financial data and transcripts as the primary source for any quantitative or qualitative analysis (e.g., summary table, financial metrics, management commentary).**
---
${fmpData}
---
` : '';

  const prompt = `Create a comprehensive, single-page stock analysis report in Markdown format for the company with stock symbol "${symbol}".
${fmpContext}
**Instructions:**
1. If structured financial data is provided, use it to populate the summary table. You can use web search to get the most current stock price if needed.
2. If structured data is not provided, use web search to find all necessary information.
3. The report must include:
    - A summary table with the latest stock price, change, 52-week high/low, market cap, and P/E ratio.
    - A short-term (1-6 months) and long-term (6+ months) factor analysis, listing key positive and negative factors.
    - A list of key upcoming events (e.g., earnings reports, product launches).
    - A summary of 3-4 recent, impactful news headlines.
    - A brief analysis of the most recent earnings call, if available.
    - A list of relevant keywords and tags for the company.
4. Format the report with clear headings, subheadings, bullet points, and tables for readability.
5. Use web search to gather qualitative information like news, upcoming events, and factor analysis.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: "You are a senior financial analyst tasked with creating insightful and well-structured investment reports.",
      },
    });
    return response.text;
  } catch (error) {
    console.error("Error during general research:", error);
    throw new Error(`Failed to perform general research for ${symbol}.`);
  }
};


const completedTasksToString = (tasks: Task[]): string => {
  return tasks
    .filter(task => task.status === 'completed' && task.result)
    .map(task => `### Task: ${task.description}\n\n${task.result}`)
    .join('\n\n---\n\n');
};

export const composeReport = async (tasks: Task[], symbol: string, fmpData?: string): Promise<string> => {
  const researchData = completedTasksToString(tasks);

  const fmpContext = fmpData ? `
Here is the structured financial data for the company, which includes earnings call transcripts:
---
${fmpData}
---
` : '';

  const prompt = `Synthesize the following quantitative and qualitative data into a comprehensive, professional-grade financial analysis report for the company with stock symbol "${symbol}". The report must be in Markdown format.

**Instructions:**
1.  **Integrate Data:** Seamlessly weave together the structured financial data (if provided) with the qualitative research findings. Do not just list the data; interpret it and use it to support your analysis.
2.  **Structure:** Create a logical flow, starting with an executive summary, followed by detailed sections.
3.  **Quarterly & Earnings Call Analysis:** Add a dedicated section to analyze the most recent quarterly performance. Synthesize key takeaways from the earnings call transcripts, connecting management's commentary and outlook with the financial results. Highlight any shifts in strategy, new guidance, or significant concerns raised in the Q&A session.
4.  **Core Sections:** Ensure the report includes analysis of the company's financial health, market position, competitive advantages, growth prospects, and key risks.
5.  **Keywords and Tags:** At the very end of the report, add a distinct section titled "Keywords and Tags" that lists relevant terms for the company (e.g., industry, sector, key technologies, competitors, products).
6.  **Tone:** Maintain an objective, data-driven, and analytical tone suitable for an investment report.

**Available Data:**

${fmpContext}

Here is the qualitative research data from web searches:
---
${researchData}
---
Now, generate the complete, final report.
`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: "You are a senior financial analyst tasked with creating insightful and well-structured investment reports.",
      },
    });
    return response.text;
  } catch (error) {
    console.error("Error composing report:", error);
    throw new Error(`Failed to compose the report for ${symbol}.`);
  }
};

const createHtmlPage = async (markdown: string, symbol: string, title: string, links?: {fileName: string, description: string}[]): Promise<string> => {
    const linksMarkdownSection = links && links.length > 0
        ? `\n\n---\n\n## Detailed Research Breakdowns\n\nBelow are links to detailed reports for each research task performed:\n\n${links.map(link => `*   [${link.description}](./${link.fileName})`).join('\n')}`
        : '';

    const fullMarkdown = markdown + linksMarkdownSection;

    const prompt = `
Convert the following Markdown financial report for "${symbol}" into a single, self-contained HTML file. The page title should be "${title}".

**Requirements:**
1.  **Styling:** Use Tailwind CSS via a CDN link (\`https://cdn.tailwindcss.com\`). The design should be modern, professional, and highly readable. Use a dark theme.
2.  **Typography:** Use the 'Inter' font for English text from Google Fonts. For Chinese characters, ensure a proper fallback font is used by including a Chinese-friendly font in the CSS font stack. For example: \`font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif;\`.
3.  **Charts:** Identify key financial data points or trends in the report and visualize them using charts. Use Chart.js (\`https://cdn.jsdelivr.net/npm/chart.js\`) for this.
4.  **Links**: If the markdown includes links to other local HTML files (e.g., \`[Link Text](./some_file.html)\`), they **must** be rendered as standard HTML \`<a>\` tags.
5.  **Structure:** The HTML should have a proper structure (\`<html>\`, \`<head>\`, \`<body>\`).
6.  **Self-Contained:** All CSS and JavaScript must be included directly in the HTML file using \`<style>\` and \`<script>\` tags or CDN links. Do not link to external local files.
7.  **Content:** The final HTML must render the full content of the markdown report, enhanced with the charts.

**Bilingual Functionality:**
1.  **Translate Content:** Translate all textual content from the Markdown report into **Simplified Chinese**. This includes all headings, paragraphs, table data, and text within charts (like axis labels and tooltips).
2.  **HTML Structure for Translation:** For every piece of text that needs translation, structure the HTML with both language versions. Use common classes for language-specific elements, like \`lang-en\` and \`lang-zh\`. For example:
    \`\`\`html
    <h1 class="lang-en">Stock Report</h1>
    <h1 class="lang-zh" style="display:none;">股票报告</h1>
    \`\`\`
    Apply this pattern consistently to all text elements.
3.  **Language Switch Button:** Add a language switch button to the top-right corner of the page (e.g., using fixed position). Style it nicely using Tailwind CSS. It should allow toggling between English ('EN') and Simplified Chinese ('中文').
4.  **Switching Logic (JavaScript):**
    -   Write a self-contained JavaScript function inside a \`<script>\` tag to handle the language switch.
    -   This function should select all elements with class \`lang-en\` and \`lang-zh\`.
    -   When the switch is clicked, it should show all elements for the selected language and hide all elements for the other language.
    -   The page must load in English by default.

**Crucial Chart Fix:** To prevent charts from growing uncontrollably in height, you **must** wrap each \`<canvas>\` element in a container \`<div>\` that has \`position: relative\` and a defined height (e.g., using a Tailwind class like \`h-80\` or \`h-96\`). Then, in your Chart.js options, set \`maintainAspectRatio: false\` and \`responsive: true\`. This is a critical requirement for a correct implementation.

**Markdown Report:**
---
${fullMarkdown}
---
`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: "You are an expert web developer specializing in creating beautiful and informative data visualizations using HTML, Tailwind CSS, and Chart.js.",
        temperature: 0.2,
      }
    });
    let html = response.text;
    if (html.startsWith("```html")) {
      html = html.substring(7);
    }
    if (html.endsWith("```")) {
      html = html.substring(0, html.length - 3);
    }
    return html.trim();

  } catch (error) {
    console.error("Error creating visualization:", error);
    throw new Error(`Failed to create visualization for ${symbol}.`);
  }
};


export const createVisualizationPackage = async (markdownReport: string, symbol: string, tasks?: Task[]): Promise<{ name: string; content: string }[]> => {
    if (tasks && tasks.length > 0) {
        const htmlFiles: { name: string; content: string }[] = [];
        // Filter only web-research tasks for individual pages
        const completedWebTasks = tasks.filter(t => t.status === 'completed' && t.result && typeof t.id === 'string' && t.id.startsWith('research-'));

        if (completedWebTasks.length > 0) {
            const taskHtmlPromises = completedWebTasks.map(async (task) => {
                const sanitizedDesc = task.description.toLowerCase().replace(/[\s\W]+/g, '_').replace(/^_|_$/g, '').substring(0, 30);
                const fileName = `task_${task.id}_${sanitizedDesc}.html`;

                const taskHtml = await createHtmlPage(
                    task.result!,
                    symbol,
                    `Task: ${task.description}`
                );
                return {
                    name: fileName,
                    content: taskHtml,
                    description: task.description
                };
            });

            const taskHtmlResults = await Promise.all(taskHtmlPromises);
            htmlFiles.push(...taskHtmlResults.map(r => ({ name: r.name, content: r.content })));

            const linksForIndex = taskHtmlResults.map(r => ({ fileName: r.name, description: r.description }));

            const indexHtml = await createHtmlPage(
                markdownReport,
                symbol,
                `Financial Report Summary for ${symbol}`,
                linksForIndex
            );

            htmlFiles.push({ name: 'index.html', content: indexHtml });
        } else {
             const indexHtml = await createHtmlPage(
                markdownReport,
                symbol,
                `Financial Report Summary for ${symbol}`
            );
            htmlFiles.push({ name: 'index.html', content: indexHtml });
        }


        return htmlFiles;
    } 
    else {
        const html = await createHtmlPage(
            markdownReport,
            symbol,
            `Financial Report for ${symbol}`
        );
        return [{ name: 'report.html', content: html }];
    }
};