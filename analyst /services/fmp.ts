const BASE_URL = 'https://financialmodelingprep.com/api/v3';

async function fetchFmp(endpoint: string, apiKey: string) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${BASE_URL}${endpoint}${separator}apikey=${apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData['Error Message'] || `FMP API error: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching from FMP endpoint ${endpoint}:`, error);
        throw error;
    }
}

const formatForPrompt = (title: string, data: any): string => {
    if (!data || (Array.isArray(data) && data.length === 0)) {
        return `\n## ${title}\n\nNo data available.\n`;
    }
    return `\n## ${title}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`;
};

async function fetchAndFormatTranscripts(symbol: string, apiKey: string): Promise<string> {
    const calendar = await fetchFmp(`/historical-earning-calendar/${symbol}?limit=4`, apiKey);
    if (!Array.isArray(calendar) || calendar.length === 0) {
        return `\n## Last 4 Earnings Call Transcripts\n\nNo earnings calendar found to retrieve transcripts.\n`;
    }

    const transcriptContents = await Promise.all(calendar.map(async (event) => {
        const announcementDate = new Date(event.date);
        let year = announcementDate.getFullYear();
        const month = announcementDate.getMonth(); // 0-11
        let quarter;

        // Determine the quarter the earnings report is for based on the announcement date.
        // Q1 (Jan-Mar) reports on Q4 of prev year.
        // Q2 (Apr-Jun) reports on Q1 of curr year.
        // Q3 (Jul-Sep) reports on Q2 of curr year.
        // Q4 (Oct-Dec) reports on Q3 of curr year.
        if (month >= 0 && month <= 2) { // Jan-Mar
            quarter = 4;
            year = year - 1;
        } else if (month >= 3 && month <= 5) { // Apr-Jun
            quarter = 1;
        } else if (month >= 6 && month <= 8) { // Jul-Sep
            quarter = 2;
        } else { // Oct-Dec
            quarter = 3;
        }

        try {
            const transcriptData = await fetchFmp(`/earning_call_transcript/${symbol}?year=${year}&quarter=${quarter}`, apiKey);
            if (transcriptData && transcriptData.length > 0 && transcriptData[0].content) {
                return `### Transcript for Q${quarter} ${year}\n\n${transcriptData[0].content}\n`;
            }
            return `### Transcript for Q${quarter} ${year}\n\nNot available.\n`;
        } catch (e) {
            return `### Transcript for Q${quarter} ${year}\n\nError fetching: ${e instanceof Error ? e.message : 'Unknown error'}\n`;
        }
    }));
    
    return `\n## Last 4 Earnings Call Transcripts\n\n${transcriptContents.join('\n---\n')}`;
}


export const fetchAllFmpData = async (symbol: string, apiKey: string): Promise<string> => {
    try {
        const limit = 10; // Fetch up to 10 periods (years/quarters)
        
        const endpoints = [
            // Annual Data
            `/income-statement/${symbol}?period=annual&limit=${limit}`,
            `/balance-sheet-statement/${symbol}?period=annual&limit=${limit}`,
            `/cash-flow-statement/${symbol}?period=annual&limit=${limit}`,
            `/ratios/${symbol}?period=annual&limit=${limit}`,
            `/key-metrics/${symbol}?period=annual&limit=${limit}`,
            `/enterprise-values/${symbol}?period=annual&limit=${limit}`,
            `/revenue-by-segment?symbol=${symbol}&period=annual`,
            // Quarterly Data
            `/income-statement/${symbol}?period=quarter&limit=${limit}`,
            `/balance-sheet-statement/${symbol}?period=quarter&limit=${limit}`,
            `/cash-flow-statement/${symbol}?period=quarter&limit=${limit}`,
            `/ratios/${symbol}?period=quarter&limit=${limit}`,
            `/key-metrics/${symbol}?period=quarter&limit=${limit}`,
            `/enterprise-values/${symbol}?period=quarter&limit=${limit}`,
            `/revenue-by-segment?symbol=${symbol}&period=quarter`,
        ];
        
        const dataPromises = endpoints.map(ep => fetchFmp(ep, apiKey));
        const transcriptsPromise = fetchAndFormatTranscripts(symbol, apiKey);
        
        const [results, transcripts] = await Promise.all([
            Promise.all(dataPromises),
            transcriptsPromise
        ]);

        const [
            incomeAnnual,
            balanceAnnual,
            cashflowAnnual,
            ratiosAnnual,
            metricsAnnual,
            enterpriseAnnual,
            segmentAnnual,
            incomeQuarterly,
            balanceQuarterly,
            cashflowQuarterly,
            ratiosQuarterly,
            metricsQuarterly,
            enterpriseQuarterly,
            segmentQuarterly
        ] = results;


        let combinedData = '--- QUANTITATIVE & QUALITATIVE FINANCIAL DATA ---\n';
        // Annual Data
        combinedData += formatForPrompt('Annual Income Statements', incomeAnnual);
        combinedData += formatForPrompt('Annual Balance Sheets', balanceAnnual);
        combinedData += formatForPrompt('Annual Cash Flow Statements', cashflowAnnual);
        combinedData += formatForPrompt('Annual Financial Ratios', ratiosAnnual);
        combinedData += formatForPrompt('Annual Key Metrics', metricsAnnual);
        combinedData += formatForPrompt('Annual Enterprise Values', enterpriseAnnual);
        combinedData += formatForPrompt('Annual Revenue by Segment', segmentAnnual);
        // Quarterly Data
        combinedData += formatForPrompt('Quarterly Income Statements', incomeQuarterly);
        combinedData += formatForPrompt('Quarterly Balance Sheets', balanceQuarterly);
        combinedData += formatForPrompt('Quarterly Cash Flow Statements', cashflowQuarterly);
        combinedData += formatForPrompt('Quarterly Financial Ratios', ratiosQuarterly);
        combinedData += formatForPrompt('Quarterly Key Metrics', metricsQuarterly);
        combinedData += formatForPrompt('Quarterly Enterprise Values', enterpriseQuarterly);
        combinedData += formatForPrompt('Quarterly Revenue by Segment', segmentQuarterly);
        // Earnings Call Transcripts
        combinedData += transcripts;
        combinedData += '--- END FINANCIAL DATA ---\n';

        return combinedData;

    } catch (error) {
        // Re-throw the original error to preserve its specific message for better handling upstream.
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('An unknown error occurred while fetching FMP data.');
    }
};