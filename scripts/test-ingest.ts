// To run this script and test D1 ingestion locally:
// Required: npm i -D tsx
// Command: npx tsx scripts/test-ingest.ts

async function testIngestPipeline() {
    const mockRssItem = {
        sourceUrl: "https://congress.gov/api/v1/bills",
        title: "Senate Votes 51-49 to Advance Infrastructure Package",
        rawContent: "A major infrastructure package passed its initial hurdle in the Senate today. The bill, aiming to revitalize broadband and regional transportation, saw strong bipartisan division, ultimately securing the 51 votes needed.",
        type: "breaking"
    };

    console.log("Mocking incoming RSS / API data trigger...");
    console.log("Starting pipeline...");

    try {
        const res = await fetch("http://localhost:3000/api/ingest", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(mockRssItem)
        });

        const data = await res.json();
        console.log("Pipeline result:", data);
    } catch (err) {
        console.error("Pipeline request failed:", err);
    }
}

testIngestPipeline();
